const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

// GET /questions
router.get("/", async (req, res, next) => {
  try {
    const questions = await prisma.question.findMany({
      orderBy: { id: "asc" },
    });
    res.json(questions);
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
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json(question);
  } catch (error) {
    next(error);
  }
});

// POST /questions
router.post("/", async (req, res, next) => {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        message: "question and answer are mandatory",
      });
    }

    const newQuestion = await prisma.question.create({
      data: {
        question,
        answer,
      },
    });

    res.status(201).json(newQuestion);
  } catch (error) {
    next(error);
  }
});

// PUT /questions/:qId
router.put("/:qId", async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);
    const { question, answer } = req.body;

    const existingQuestion = await prisma.question.findUnique({
      where: { id: qId },
    });

    if (!existingQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (!question || !answer) {
      return res.status(400).json({
        message: "question and answer are mandatory",
      });
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: qId },
      data: {
        question,
        answer,
      },
    });

    res.json(updatedQuestion);
  } catch (error) {
    next(error);
  }
});

// DELETE /questions/:qId
router.delete("/:qId", async (req, res, next) => {
  try {
    const qId = Number(req.params.qId);

    const question = await prisma.question.findUnique({
      where: { id: qId },
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    await prisma.question.delete({
      where: { id: qId },
    });

    res.json({
      message: "Question deleted successfully",
      question,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;