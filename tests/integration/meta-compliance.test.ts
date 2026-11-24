/**
 * Meta Platform Compliance & Data Deletion Integration Tests
 *
 * Requirements:
 * - POST /api/v1/meta/data-deletion (Meta signed_request verification, user data removal, confirmation code)
 * - POST /api/v1/auth/delete-account (Cascade user account deletion)
 * - checkTokenExpirations processor verification
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { encryptToken } from "../../packages/shared/src/token-encryption";
import { checkTokenExpirations } from "../../apps/worker/src/processors/token-expiry.processor";
import { cleanDatabase } from "../setup";

function createSignedRequest(payloadObj: Record<string, unknown>, secret: string): string {
  const payloadStr = JSON.stringify(payloadObj);
  const encodedPayload = Buffer.from(payloadStr)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const hmac = crypto.createHmac("sha256", secret).update(encodedPayload).digest();
  const encodedSig = hmac
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${encodedSig}.${encodedPayload}`;
}

describe("Meta Compliance & Data Deletion", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("1. Verifies Meta signed_request and deletes account data", async () => {
    const user = await prisma.user.create({
      data: {
        email: "meta_delete_test@example.com",
        passwordHash: "argon2_test_hash",
      },
    });

    const key = process.env.META_TOKEN_ENCRYPTION_KEY!;
    const account = await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: "meta_user_998877",
        username: "meta_shop_delete",
        encryptedAccessToken: encryptToken("token_to_delete", key),
      },
    });

    const secret = process.env.META_APP_SECRET || "dummy_secret_for_tests_123456789";
    const signedRequest = createSignedRequest(
      {
        user_id: "meta_user_998877",
        algorithm: "HMAC-SHA256",
        issued_at: Math.floor(Date.now() / 1000),
      },
      secret
    );

    const res = await request(app)
      .post("/api/v1/meta/data-deletion")
      .send({ signed_request: signedRequest })
      .expect(200);

    expect(res.body.url).toBeDefined();
    expect(res.body.confirmation_code).toBeDefined();
    expect(res.body.url).toContain(res.body.confirmation_code);

    // Assert Instagram account was deleted from DB
    const deletedAcc = await prisma.instagramAccount.findUnique({
      where: { id: account.id },
    });
    expect(deletedAcc).toBeNull();
  });

  it("2. Rejects invalid signed_request signature", async () => {
    const badSignedRequest = createSignedRequest(
      { user_id: "attacker_id" },
      "wrong_secret_attacker"
    );

    const res = await request(app)
      .post("/api/v1/meta/data-deletion")
      .send({ signed_request: badSignedRequest })
      .expect(403);

    expect(res.body.message).toContain("signature");
  });

  it("3. User can permanently delete their own account via /auth/delete-account", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "user_delete_me@example.com",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
      .expect(201);

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "user_delete_me@example.com", password: "StrongPassword123!" })
      .expect(200);

    const token = loginRes.body.data.accessToken as string;

    const deleteRes = await request(app)
      .post("/api/v1/auth/delete-account")
      .set("Authorization", `Bearer ${token}`)
      .set("x-csrf-protection", "1")
      .expect(200);

    expect(deleteRes.body.success).toBe(true);

    // Verify user no longer exists in DB
    const userInDb = await prisma.user.findUnique({
      where: { email: "user_delete_me@example.com" },
    });
    expect(userInDb).toBeNull();
  });

  it("4. checkTokenExpirations processor flags expiring and expired accounts", async () => {
    const user = await prisma.user.create({
      data: {
        email: "token_expiry_user@example.com",
        passwordHash: "argon2_test_hash",
      },
    });

    const key = process.env.META_TOKEN_ENCRYPTION_KEY!;

    // 1. Expired account (yesterday)
    const expiredAcc = await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: "ig_expired_1",
        encryptedAccessToken: encryptToken("expired_tok", key),
        tokenExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
    });

    // 2. Expiring soon account (in 3 days)
    const expiringSoonAcc = await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: "ig_expiring_soon_2",
        encryptedAccessToken: encryptToken("soon_tok", key),
        tokenExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
    });

    // 3. Fresh account (in 60 days)
    await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: "ig_fresh_3",
        encryptedAccessToken: encryptToken("fresh_tok", key),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
    });

    const stats = await checkTokenExpirations();
    expect(stats.checked).toBe(3);
    expect(stats.expired).toBe(1);
    expect(stats.expiringSoon).toBe(1);

    // Assert expired account was updated to NEEDS_RECONNECT
    const refreshedExpired = await prisma.instagramAccount.findUnique({
      where: { id: expiredAcc.id },
    });
    expect(refreshedExpired?.status).toBe("NEEDS_RECONNECT");

    // Fresh accounts remain ACTIVE
    const refreshedSoon = await prisma.instagramAccount.findUnique({
      where: { id: expiringSoonAcc.id },
    });
    expect(refreshedSoon?.status).toBe("ACTIVE");
  });
});
