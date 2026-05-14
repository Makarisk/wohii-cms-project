const express = require("express");
const app = express();
const path = require("path");
const authRouter = require("./routes/auth");

const errorHandler = require("./middleware/errorHandler");

const questionsRouter = require("./routes/questions");

const pinoHttp = require("pino-http");
const logger = require("./lib/logger");

app.use(express.static(path.join(__dirname, "..", "public")));
// Middleware to parse JSON bodies
app.use(express.json());

app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url.startsWith("/uploads") },
}));


// Routes
app.use("/api/auth", authRouter);
app.use("/api/questions", questionsRouter);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

module.exports = app;