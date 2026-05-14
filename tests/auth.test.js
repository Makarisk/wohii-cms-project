const bcrypt = require("bcrypt");
const { resetDb, request, app, prisma } = require("./helpers");

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth tests", () => {
  it("registers, hashes the password, returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "a@test.io",
        password: "pw12345",
        name: "A",
      });
      
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));

    const user = await prisma.user.findUnique({
      where: { email: "a@test.io" },
    });

    expect(user).not.toBeNull();
    expect(user.password).not.toBe("pw12345");
    expect(await bcrypt.compare("pw12345", user.password)).toBe(true);
  });

  it("returns 400 when registration data is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@test.io" });

    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate email", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "a@test.io",
        password: "pw12345",
        name: "A",
      });

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "a@test.io",
        password: "pw12345",
        name: "A",
      });

    expect(res.status).toBe(409);
  });

  it("logs in with valid credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "a@test.io",
        password: "pw12345",
        name: "A",
      });

    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "a@test.io",
        password: "pw12345",
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("returns 400 when login data is missing", async () => {
    const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "a@test.io" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("email and password are required");
    });

  it("returns 401 for wrong credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "a@test.io",
        password: "pw12345",
        name: "A",
      });

    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "a@test.io",
        password: "wrong-password",
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("uses the same error message for missing user and wrong password", async () => {
    const missingUser = await request(app)
      .post("/api/auth/login")
      .send({
        email: "missing@test.io",
        password: "pw12345",
      });

    await request(app)
      .post("/api/auth/register")
      .send({
        email: "a@test.io",
        password: "pw12345",
        name: "A",
      });

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({
        email: "a@test.io",
        password: "wrong-password",
      });

    expect(missingUser.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(missingUser.body.message).toBe(wrongPassword.body.message);
  });
});