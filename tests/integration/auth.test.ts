import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";

describe("Authentication Lifecycle & Security", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  const testUser = {
    email: "sarah@example.com",
    password: "StrongPassword123!",
    confirmPassword: "StrongPassword123!",
  };

  it("1. Password hashing & register/login", async () => {
    // Registration
    const regRes = await request(app)
      .post("/api/v1/auth/register")
      .send(testUser)
      .expect(201);

    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(regRes.body.data.user.id).toBeDefined();

    // Verify Argon2 password hashing in database
    const dbUser = await prisma.user.findUnique({
      where: { email: testUser.email.toLowerCase() },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.passwordHash).toBeDefined();
    expect(dbUser?.passwordHash).not.toBe(testUser.password);
    expect(dbUser?.passwordHash.startsWith("$argon2")).toBe(true);

    // Duplicate registration should fail
    const dupRes = await request(app)
      .post("/api/v1/auth/register")
      .send(testUser)
      .expect(409);
    expect(dupRes.body.success).toBe(false);

    // Login with wrong password
    const wrongRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: "WrongPassword999!" })
      .expect(401);
    expect(wrongRes.body.success).toBe(false);

    // Login with correct password
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.user.email).toBe(testUser.email.toLowerCase());

    // Verify Set-Cookie header contains replyza_refresh
    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const refreshCookie = (cookies as unknown as string[]).find((c) =>
      c.startsWith("replyza_refresh=")
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
  });

  it("2. Access-token validation against the session (/auth/me)", async () => {
    await request(app).post("/api/v1/auth/register").send(testUser).expect(201);
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    const token = loginRes.body.data.accessToken;

    // Valid Bearer token
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe(testUser.email.toLowerCase());

    // Missing token
    await request(app).get("/api/v1/auth/me").expect(401);

    // Invalid token
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid_token_xyz")
      .expect(401);
  });

  it("3. CSRF protection on refresh and logout", async () => {
    await request(app).post("/api/v1/auth/register").send(testUser).expect(201);
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    const cookieHeader = (loginRes.headers["set-cookie"] as unknown as string[])[0];

    // Refresh without x-csrf-protection header should be rejected
    const noCsrfRefresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [cookieHeader])
      .expect(403);
    expect(noCsrfRefresh.body.message).toContain("CSRF");

    // Logout without x-csrf-protection header should be rejected
    const noCsrfLogout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", [cookieHeader])
      .expect(403);
    expect(noCsrfLogout.body.message).toContain("CSRF");
  });

  it("4. Refresh-token rotation, reuse detection and logout", async () => {
    await request(app).post("/api/v1/auth/register").send(testUser).expect(201);
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    const initialCookie = (loginRes.headers["set-cookie"] as unknown as string[])[0];

    // 1st Refresh: should rotate token and return new cookie
    const refresh1Res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [initialCookie])
      .set("x-csrf-protection", "1")
      .expect(200);

    expect(refresh1Res.body.success).toBe(true);
    expect(refresh1Res.body.data.accessToken).toBeDefined();

    const rotatedCookie = (refresh1Res.headers["set-cookie"] as unknown as string[])[0];
    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie).not.toBe(initialCookie);

    // 2nd Refresh with rotated token: succeeds
    const refresh2Res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [rotatedCookie])
      .set("x-csrf-protection", "1")
      .expect(200);
    expect(refresh2Res.body.success).toBe(true);

    const activeCookie = (refresh2Res.headers["set-cookie"] as unknown as string[])[0];

    // Reuse detection: Present the INITIAL (already rotated) token again
    const reuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [initialCookie])
      .set("x-csrf-protection", "1")
      .expect(401);
    expect(reuseRes.body.message).toMatch(/reuse|revoked/i);

    // Because reuse was detected, the entire token family must have been revoked!
    // Active cookie should now also fail!
    const postReuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [activeCookie])
      .set("x-csrf-protection", "1")
      .expect(401);
    expect(postReuseRes.body.success).toBe(false);

    // Test clean logout on fresh session
    const freshLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    const freshCookie = (freshLogin.headers["set-cookie"] as unknown as string[])[0];

    await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", [freshCookie])
      .set("x-csrf-protection", "1")
      .expect(200);

    // After logout, refresh should fail
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [freshCookie])
      .set("x-csrf-protection", "1")
      .expect(401);
  });
});
