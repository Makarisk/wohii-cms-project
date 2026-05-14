const {
  resetDb,
  registerAndLogin,
  createQuestion,
  request,
  app,
  prisma,
} = require("./helpers");

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("attempt tests", () => {
  it("returns 400 when submittedAnswer is missing", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token);

    const res = await request(app)
      .post(`/api/questions/${question.id}/attempt`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("submittedAnswer is mandatory");
  });

  it("returns 404 for unknown question attempt", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .post("/api/questions/99999/attempt")
      .set("Authorization", `Bearer ${token}`)
      .send({
        submittedAnswer: "anything",
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
  });

  it("marks correct answer as correct", async () => {
    const token = await registerAndLogin();

    const question = await createQuestion(token, {
      question: "What is 2 + 2?",
      answer: "4",
      keywords: "math",
    });

    const res = await request(app)
      .post(`/api/questions/${question.id}/attempt`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        submittedAnswer: "4",
      });

    expect(res.status).toBe(201);
    expect(res.body.questionId).toBe(question.id);
    expect(res.body.correct).toBe(true);
    expect(res.body.submittedAnswer).toBe("4");
    expect(res.body.correctAnswer).toBe("4");
    expect(res.body.attemptCount).toBe(1);
  });

  it("marks wrong answer as incorrect", async () => {
    const token = await registerAndLogin();

    const question = await createQuestion(token, {
      question: "What is 2 + 2?",
      answer: "4",
      keywords: "math",
    });

    const res = await request(app)
      .post(`/api/questions/${question.id}/attempt`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        submittedAnswer: "5",
      });

    expect(res.status).toBe(201);
    expect(res.body.questionId).toBe(question.id);
    expect(res.body.correct).toBe(false);
    expect(res.body.submittedAnswer).toBe("5");
    expect(res.body.correctAnswer).toBe("4");
    expect(res.body.attemptCount).toBe(1);
  });

  it("increases attemptCount after several attempts", async () => {
    const token = await registerAndLogin();

    const question = await createQuestion(token, {
      question: "Capital of Finland?",
      answer: "Helsinki",
      keywords: "geography",
    });

    await request(app)
      .post(`/api/questions/${question.id}/attempt`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        submittedAnswer: "Turku",
      });

    const secondAttempt = await request(app)
      .post(`/api/questions/${question.id}/attempt`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        submittedAnswer: "Helsinki",
      });

    expect(secondAttempt.status).toBe(201);
    expect(secondAttempt.body.correct).toBe(true);
    expect(secondAttempt.body.attemptCount).toBe(2);
  });
});