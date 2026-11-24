/**
 * Instagram Accounts API Integration Tests
 *
 * Requirements:
 * - GET /api/v1/instagram/accounts
 * - DELETE /api/v1/instagram/accounts/:id
 * - POST /api/v1/instagram/accounts/:id/subscribe
 * - User isolation: User A cannot see, delete, or subscribe User B's accounts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { encryptToken } from "../../packages/shared/src/token-encryption";
import { cleanDatabase } from "../setup";

describe("Instagram Accounts Management API", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  async function createTestUserWithAccount(email: string, igId: string, username: string) {
    const registerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
      .expect(201);

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "StrongPassword123!" })
      .expect(200);

    const accessToken = loginRes.body.data.accessToken as string;
    const cookie = (loginRes.headers["set-cookie"] as unknown as string[])[0];
    const user = registerRes.body.data.user;

    const key = process.env.META_TOKEN_ENCRYPTION_KEY!;
    const account = await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: igId,
        username,
        encryptedAccessToken: encryptToken("mock_token_for_" + igId, key),
        status: "ACTIVE",
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    });

    return { user, account, accessToken, cookie };
  }

  it("1. Lists accounts with strict user isolation", async () => {
    const userA = await createTestUserWithAccount("user_a@example.com", "ig_user_a", "shop_a");
    const userB = await createTestUserWithAccount("user_b@example.com", "ig_user_b", "shop_b");

    // User A should only see Shop A
    const resA = await request(app)
      .get("/api/v1/instagram/accounts")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .expect(200);

    expect(resA.body.success).toBe(true);
    expect(resA.body.data).toHaveLength(1);
    expect(resA.body.data[0].instagramUserId).toBe("ig_user_a");
    expect(resA.body.data[0].status).toBe("ACTIVE");
    expect(resA.body.data[0].tokenExpiresAt).toBeDefined();

    // User B should only see Shop B
    const resB = await request(app)
      .get("/api/v1/instagram/accounts")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(200);

    expect(resB.body.success).toBe(true);
    expect(resB.body.data).toHaveLength(1);
    expect(resB.body.data[0].instagramUserId).toBe("ig_user_b");

    // Unauthenticated request should fail with 401
    await request(app).get("/api/v1/instagram/accounts").expect(401);
  });

  it("2. Re-subscribes account to Meta webhooks", async () => {
    const { account, accessToken } = await createTestUserWithAccount(
      "sub_user@example.com",
      "ig_sub_123",
      "subscribe_shop"
    );

    let capturedSubUrl: string | null = null;
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      capturedSubUrl = input.toString();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const res = await request(app)
      .post(`/api/v1/instagram/accounts/${account.id}/subscribe`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(capturedSubUrl).toContain("/ig_sub_123/subscribed_apps");
  });

  it("3. Disconnects (deletes) account with user isolation", async () => {
    const userA = await createTestUserWithAccount("del_a@example.com", "ig_del_a", "delete_shop_a");
    const userB = await createTestUserWithAccount("del_b@example.com", "ig_del_b", "delete_shop_b");

    // User B attempts to delete User A's account -> 404
    await request(app)
      .delete(`/api/v1/instagram/accounts/${userA.account.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    // User A deletes User A's account -> 200
    const delRes = await request(app)
      .delete(`/api/v1/instagram/accounts/${userA.account.id}`)
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .expect(200);

    expect(delRes.body.success).toBe(true);

    // Verify removed from database
    const inDb = await prisma.instagramAccount.findUnique({
      where: { id: userA.account.id },
    });
    expect(inDb).toBeNull();
  });
});
