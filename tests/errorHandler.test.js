const jwt = require("jsonwebtoken");
const multer = require("multer");
const errorHandler = require("../src/middleware/errorHandler");

const { resetDb, request, app, prisma } = require("./helpers");

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
}

describe("global error handler tests", () => {
  it("returns 404 for unknown route", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Not found");
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send('{"email": "broken"');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid JSON in request body");
  });
    it("handles MulterError", () => {
    const err = new multer.MulterError("LIMIT_FILE_SIZE");
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: err.message,
    });
  });

  it("handles JsonWebTokenError", () => {
    const err = new jwt.JsonWebTokenError("bad token");
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid token",
    });
  });

  it("handles TokenExpiredError", () => {
    const err = new jwt.TokenExpiredError("expired", new Date());
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid token",
    });
  });

  it("logs and handles unexpected errors", () => {
    const err = new Error("Unexpected error");

    const req = {
      log: {
        error: vi.fn(),
      },
    };

    const res = mockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(req.log.error).toHaveBeenCalledWith(
      { err },
      "unhandled error"
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal server error",
    });
  });
});

