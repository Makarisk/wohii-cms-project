const { resetDb, registerAndLogin, request, app, prisma } = require("./helpers");

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth middleware tests", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).get("/api/questions");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });

  it("returns 401 when Authorization header does not start with Bearer", async () => {
    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", "Token abc");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });

  it("returns 403 for malformed token", async () => {
    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", "Bearer bad-token");

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  it("accepts valid Bearer token", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});