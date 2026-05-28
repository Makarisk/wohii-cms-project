const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { ValidationError, NotFoundError } = require("../lib/errors");
const { z } = require("zod");

const QuestionInput = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
});


const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new ValidationError("Only image files are allowed"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.originalname.toLowerCase().endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new ValidationError("Only CSV files are allowed"));
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords ? question.keywords.map((k) => k.name) : [],
    userName: question.user ? question.user.name : null,
    solved: question.attempts ? question.attempts.length > 0 : false,
    attemptCount: question._count?.attempts ?? 0,
    user: undefined,
    attempts: undefined,
    _count: undefined,
  };
} 

router.use(authenticate);

function parseKeywords(keywords) {
  if (Array.isArray(keywords)) return keywords;

  if (typeof keywords === "string") {
    return keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }

  return [];
}

function parseCsvKeywords(keywords) {
  if (!keywords) return [];

  return keywords
    .split(";")
    .map((k) => k.trim())
    .filter(Boolean);
}

// // GET /api/questions, /api/questions?page=1&limit=5
router.get("/", async (req, res, next) => {
  try {
        
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
    const skip = (page - 1) * limit;
    const { keyword } = req.query;

    const where = keyword
      ? { keywords: { some: { name: keyword } } }
      : {};

    const [questions, total] = await Promise.all([prisma.question.findMany({
      where,
      include: { 
        user: true,
        keywords: true,
        attempts: {
          where: {
            userId: req.user.userId,
            correct: true,
          },
          take: 1,
        },
        _count: { select: { attempts: true } },
      
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }), prisma.question.count({where})]);

    res.json({
        data: questions.map(formatQuestion),
        page,
        limit,
        total,
        totalPages: Math.ceil(total/limit),
    })    
    
  } catch (error) {
    next(error);
  }
});

// POST /api/questions/import-csv
router.post("/import-csv", csvUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError("CSV file is required");
    }

    const csvText = req.file.buffer.toString("utf8");

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      throw new ValidationError("CSV file is empty");
    }

    const createdQuestions = [];

    for (const record of records) {
      const question = record.question;
      const answer = record.answer;
      const keywordsArray = parseCsvKeywords(record.keywords);

      if (!question || !answer) {
        throw new ValidationError("Each CSV row must contain question and answer");
      }

      const newQuestion = await prisma.question.create({
        data: {
          question,
          answer,
          imageUrl: null,
          userId: req.user.userId,
          keywords: {
            connectOrCreate: keywordsArray.map((kw) => ({
              where: { name: kw },
              create: { name: kw },
            })),
          },
        },
        include: {
          keywords: true,
          user: true,
        },
      });

      createdQuestions.push(formatQuestion(newQuestion));
    }

    res.status(201).json({
      message: "Questions imported successfully",
      count: createdQuestions.length,
      data: createdQuestions,
    });
  } catch (error) {
    next(error);
  }
});

// GET /questions/:qId
router.get("/:qId", async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);

    const question = await prisma.question.findUnique({
      where: { id: qId },
      include: { 
        user: true,
        keywords: true,
        attempts: { 
          where: { 
            userId: req.user.userId, 
            correct: true,
        },  
        take: 1,
       },
        _count: { select: { attempts: true } },
      },  
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    res.json(formatQuestion(question));
  } catch (error) {
    next(error);
  }
});

// POST /questions
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const { question, answer, keywords } = QuestionInput.parse(req.body);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const keywordsArray = parseKeywords(keywords);

    const newQuestion = await prisma.question.create({
      data: {
        question,
        answer,
        imageUrl,
        userId: req.user.userId,
        keywords: {
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),  
        },
      },
      include: { keywords: true, user: true },  

    });

    res.status(201).json(formatQuestion(newQuestion));
  } catch (error) {
    next(error);
  }
});

// PUT /questions/:qId
router.put("/:qId", upload.single("image"), isOwner, async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);
    const { question, answer, keywords } = QuestionInput.parse(req.body);
    const keywordsArray = parseKeywords(keywords);

    const existingQuestion = await prisma.question.findUnique({
      where: { id: qId },
      
    });

    if (!existingQuestion) {
      throw new NotFoundError("Question not found");
    }

    const data = {
      question,
      answer,
      keywords: {
        set: [],
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },    
    };

    if (req.file) {
      data.imageUrl = `/uploads/${req.file.filename}`;
    }
    const updatedQuestion = await prisma.question.update({
      where: { id: qId },
      include: { user: true, keywords: true },
      data,
    });

    res.json(formatQuestion(updatedQuestion));
  } catch (error) {
    next(error);
  }
});

// DELETE /questions/:qId
router.delete("/:qId", isOwner, async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);

    const question = await prisma.question.findUnique({
      where: { id: qId },
      include: { user: true, keywords: true },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    await prisma.question.delete({
      where: { id: qId },
      
    });

    res.json({
      message: "Question deleted successfully",
      question: formatQuestion(question),
    });
  } catch (error) {
    next(error);
  }
});

// POST /questions/:qId/attempt
router.post("/:qId/attempt", async (req, res) => {
  const qId = Number(req.params.qId);
  const { submittedAnswer } = req.body || {};

  if (!submittedAnswer) {
    throw new ValidationError("submittedAnswer is mandatory");
  }

  const question = await prisma.question.findUnique({
    where: { id: qId },
  });

  if (!question) {
    throw new NotFoundError("Question not found");
  }

  const correct =
    submittedAnswer.trim().toLowerCase() ===
    question.answer.trim().toLowerCase();

  const attempt = await prisma.attempt.create({
    data: {
      submittedAnswer,
      correct,
      userId: req.user.userId,
      questionId: qId,
    },
  });
  const attemptCount = await prisma.attempt.count({
    where: { questionId: qId },
  });

  res.status(201).json({
    id: attempt.id,
    questionId: qId,
    correct,
    submittedAnswer: attempt.submittedAnswer,
    correctAnswer: question.answer,
    attemptCount,
    createdAt: attempt.createdAt,
  });
});

router.use((err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err?.message === "Only image files are allowed" ||
    err?.message === "Only CSV files are allowed"
  ) {
    return res.status(400).json({ msg: err.message });
  }

  next(err);
});

module.exports = router;
module.exports.formatQuestion = formatQuestion;