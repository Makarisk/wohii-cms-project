const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const crypto = require("crypto");
const { sendConfirmationEmail } = require("../lib/email");

const {
  ValidationError,
  ConflictError,
  UnauthorizedError,
} = require("../lib/errors");

const SECRET = process.env.JWT_SECRET;

const captchaStore = new Map();

function createCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const captchaId = crypto.randomBytes(16).toString("hex");

  captchaStore.set(captchaId, {
    answer: String(a + b),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  return {
    captchaId,
    question: `${a} + ${b} = ?`,
  };
}

function validateCaptcha(captchaId, captchaAnswer) {
  const savedCaptcha = captchaStore.get(captchaId);

  if (!savedCaptcha) {
    throw new ValidationError("Captcha is required");
  }

  if (savedCaptcha.expiresAt < Date.now()) {
    captchaStore.delete(captchaId);
    throw new ValidationError("Captcha expired. Please try again.");
  }

  if (String(captchaAnswer).trim() !== savedCaptcha.answer) {
    throw new ValidationError("Captcha answer is incorrect");
  }

  captchaStore.delete(captchaId);
}
// Here we will add all routes related to authentication
// GET /api/auth/captcha
router.get("/captcha", (req, res) => {
  res.json(createCaptcha());
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name, captchaId, captchaAnswer } = req.body;

  if (!email || !password || !name || !captchaId || !captchaAnswer) {
    throw new ValidationError("email, password, name and captcha are required");
  }
  validateCaptcha(captchaId, captchaAnswer);
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email },});

  if (existingUser) {
    throw new ConflictError("Email already registered");
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

    // Create email confirmation token
  const confirmationToken = crypto.randomBytes(32).toString("hex");

  // Create the user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      emailConfirmed: false,
      emailConfirmationToken: confirmationToken,
      emailConfirmationExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });

    // Send confirmation email
  await sendConfirmationEmail(user.email, confirmationToken);

  res.status(201).json({
    message: "User registered successfully. Please check your email to confirm your account.",
  });
});

// GET /api/auth/confirm-email?token=...
router.get("/confirm-email", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({
      message: "Confirmation token is required",
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      emailConfirmationToken: token,
      emailConfirmationExpiry: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    return res.status(400).json({
      message: "Invalid or expired confirmation token",
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailConfirmed: true,
      emailConfirmationToken: null,
      emailConfirmationExpiry: null,
    },
  });

  res.json({
    message: "Email confirmed successfully. You can now log in.",
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError("email and password are required");
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid credentials");
  }

  // Verify the password
  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  // Block login before email confirmation
  if (!user.emailConfirmed && user.emailConfirmationToken) {
    return res.status(403).json({
      message: "Please confirm your email before logging in.",
    });
  }

  // Generate a token only after email is confirmed
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });

  res.json({ token });
});

module.exports = router; 
