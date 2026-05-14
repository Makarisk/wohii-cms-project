const path = require("path");
const {
  resetDb,
  registerAndLogin,
  createQuestion,
  request,
  app,
  prisma,
} = require("./helpers");

const questionsRouter = require("../src/routes/questions");
const { formatQuestion } = questionsRouter;

beforeEach(resetDb);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("question tests", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/questions");

    expect(res.status).toBe(401);
  });

  it("returns 200 list with pagination shape", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.any(Array));
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
    expect(res.body.total).toEqual(expect.any(Number));
    expect(res.body.totalPages).toEqual(expect.any(Number));
  });

  it("returns 404 for unknown question", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .get("/api/questions/99999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
  });

  it("returns 400 for invalid question body", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "",
        answer: "Some answer",
      });

    expect(res.status).toBe(400);
  });

  it("creates a question successfully", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "What is the deepest lake on Earth?",
        answer: "Lake Baikal",
        keywords: "geography,lakes",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(Number));
    expect(res.body.question).toBe("What is the deepest lake on Earth?");
    expect(res.body.answer).toBe("Lake Baikal");
    expect(res.body.keywords).toContain("geography");
  });

  it("returns 403 when editing someone else's question", async () => {
    const aliceToken = await registerAndLogin("alice@test.io", "Alice");
    const question = await createQuestion(aliceToken, {
      question: "Alice question",
      answer: "Alice answer",
    });

    const bobToken = await registerAndLogin("bob@test.io", "Bob");

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${bobToken}`)
      .send({
        question: "Hijacked question",
        answer: "Hijacked answer",
      });

    expect(res.status).toBe(403);

    const after = await prisma.question.findUnique({
      where: { id: question.id },
    });

    expect(after.question).toBe("Alice question");
    expect(after.answer).toBe("Alice answer");
  });

  it("returns 403 when deleting someone else's question", async () => {
    const aliceToken = await registerAndLogin("alice@test.io", "Alice");
    const question = await createQuestion(aliceToken, {
      question: "Alice question",
      answer: "Alice answer",
    });

    const bobToken = await registerAndLogin("bob@test.io", "Bob");

    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${bobToken}`);

    expect(res.status).toBe(403);

    const after = await prisma.question.findUnique({
      where: { id: question.id },
    });

    expect(after).not.toBeNull();
  });
    it("passes database errors from GET one question to the error handler", async () => {
    const token = await registerAndLogin();

    vi.spyOn(prisma.question, "findUnique").mockRejectedValueOnce(
        new Error("Database failure")
    );

    const res = await request(app)
        .get("/api/questions/1")
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    });

  //This covers successful GET /api/questions/:qId
    it("returns one existing question", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token, {
        question: "Single question?",
        answer: "Single answer",
        keywords: "single,test",
    });

    const res = await request(app)
        .get(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(question.id);
    expect(res.body.question).toBe("Single question?");
    expect(res.body.keywords).toContain("single");
    });

    //This covers the keyword ? ... : ... branch in GET /api/questions
    it("filters questions by keyword", async () => {
    const token = await registerAndLogin();

    await createQuestion(token, {
        question: "Question about Node",
        answer: "Node",
        keywords: "nodejs,backend",
    });

    await createQuestion(token, {
        question: "Question about Finland",
        answer: "Helsinki",
        keywords: "geography,finland",
    });

    const res = await request(app)
        .get("/api/questions?keyword=finland")
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].question).toBe("Question about Finland");
    });

    //This covers the happy path of PUT /api/questions/:qId
    it("updates own question successfully", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token, {
        question: "Old question",
        answer: "Old answer",
        keywords: "old",
    });

    const res = await request(app)
        .put(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
        question: "Updated question",
        answer: "Updated answer",
        keywords: "updated,new",
        });

    expect(res.status).toBe(200);
    expect(res.body.question).toBe("Updated question");
    expect(res.body.answer).toBe("Updated answer");
    expect(res.body.keywords).toContain("updated");
    });

    //This covers the validation branch in PUT.
    it("returns 400 for invalid update body", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token);

    const res = await request(app)
        .put(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
        question: "",
        answer: "",
        });

    expect(res.status).toBe(400);
    });

    //This covers the happy path of DELETE /api/questions/:qId.
    it("deletes own question successfully", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token);

    const res = await request(app)
        .delete(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Question deleted successfully");

    const after = await prisma.question.findUnique({
        where: { id: question.id },
    });

    expect(after).toBeNull();
    });

    //test image upload
    it("rejects non-image upload", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
        .post("/api/questions")
        .set("Authorization", `Bearer ${token}`)
        .field("question", "Question with invalid file")
        .field("answer", "Answer")
        .attach("image", path.join(__dirname, "image fake test.txt"));

    expect(res.status).toBe(400);
    });

    // Cover successful image upload
    it("creates a question with image upload", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
        .post("/api/questions")
        .set("Authorization", `Bearer ${token}`)
        .field("question", "Question with image")
        .field("answer", "Answer with image")
        .field("keywords", "image,test")
        .attach("image", path.join(__dirname, "image_test.png"));

    expect(res.status).toBe(201);
    expect(res.body.imageUrl).toEqual(expect.stringContaining("/uploads/"));
    });

    //Cover parseKeywords
    it("creates a question without keywords", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
        .post("/api/questions")
        .set("Authorization", `Bearer ${token}`)
        .send({
        question: "Question without keywords",
        answer: "Answer",
        });

    expect(res.status).toBe(201);
    expect(res.body.keywords).toEqual([]);
    });

    //Cover PUT with unknown id
    it("returns 404 when updating unknown question", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
        .put("/api/questions/99999")
        .set("Authorization", `Bearer ${token}`)
        .send({
        question: "Updated",
        answer: "Updated answer",
        });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
    });

    //Cover DELETE unknown id
    it("returns 404 when deleting unknown question", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
        .delete("/api/questions/99999")
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
    });  

    // Covers the second findUnique check inside PUT route
    it("returns 404 if question disappears before update handler", async () => {
    const token = await registerAndLogin();

    const created = await createQuestion(token, {
        question: "Temporary question",
        answer: "Temporary answer",
    });

    const dbQuestion = await prisma.question.findUnique({
        where: { id: created.id },
    });

    vi.spyOn(prisma.question, "findUnique")
        .mockResolvedValueOnce(dbQuestion) // for isOwner middleware
        .mockResolvedValueOnce(null); // for existingQuestion inside PUT route

    const res = await request(app)
        .put(`/api/questions/${created.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
        question: "Updated question",
        answer: "Updated answer",
        });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
    });

    // Covers the second findUnique check inside DELETE route
    it("returns 404 if question disappears before delete handler", async () => {
    const token = await registerAndLogin();

    const created = await createQuestion(token, {
        question: "Temporary delete question",
        answer: "Temporary delete answer",
    });

    const dbQuestion = await prisma.question.findUnique({
        where: { id: created.id },
    });

    vi.spyOn(prisma.question, "findUnique")
        .mockResolvedValueOnce(dbQuestion) // for isOwner middleware
        .mockResolvedValueOnce(null); // for question check inside DELETE route

    const res = await request(app)
        .delete(`/api/questions/${created.id}`)
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
    });

    // Covers DELETE catch block / next(error)
    it("passes database errors from DELETE to the error handler", async () => {
    const token = await registerAndLogin();

    const created = await createQuestion(token, {
        question: "Question to delete",
        answer: "Answer to delete",
    });

    vi.spyOn(prisma.question, "delete").mockRejectedValueOnce(
        new Error("Delete failed")
    );

    const res = await request(app)
        .delete(`/api/questions/${created.id}`)
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    });

    it("passes database errors from GET questions list to the error handler", async () => {
    const token = await registerAndLogin();

    vi.spyOn(prisma.question, "findMany").mockRejectedValueOnce(
        new Error("Database failure")
    );

    const res = await request(app)
        .get("/api/questions")
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    });

    it("updates own question with image upload", async () => {
    const token = await registerAndLogin();

    const question = await createQuestion(token, {
        question: "Old image question",
        answer: "Old answer",
        keywords: "old",
    });

    const res = await request(app)
        .put(`/api/questions/${question.id}`)
        .set("Authorization", `Bearer ${token}`)
        .field("question", "Updated image question")
        .field("answer", "Updated answer")
        .field("keywords", "updated,image")
        .attach("image", path.join(__dirname, "image_test.png"));

    expect(res.status).toBe(200);
    expect(res.body.question).toBe("Updated image question");
    expect(res.body.answer).toBe("Updated answer");
    expect(res.body.imageUrl).toEqual(expect.stringContaining("/uploads/"));
    });

    it("creates a question with keywords as an array", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
        .post("/api/questions")
        .set("Authorization", `Bearer ${token}`)
        .send({
        question: "Question with array keywords",
        answer: "Answer",
        keywords: ["array", "keywords"],
        });

    expect(res.status).toBe(201);
    expect(res.body.keywords).toContain("array");
    expect(res.body.keywords).toContain("keywords");
    });

    it("uses fallback values when user and attempts are missing", () => {
    const result = formatQuestion({
    id: 1,
    question: "Q",
    answer: "A",
    keywords: [],
    });

    expect(result.userName).toBeNull();
    expect(result.solved).toBe(false);
    });

    it("uses empty keywords array when keywords are missing", () => {
    const result = formatQuestion({
        id: 1,
        question: "Q",
        answer: "A",
    });

    expect(result.keywords).toEqual([]);
    });         

});