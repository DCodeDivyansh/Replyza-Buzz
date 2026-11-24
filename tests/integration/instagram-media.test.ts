import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { redisConnection } from "../../apps/api/src/queues/automation.queue";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";

describe("Instagram Media Library API & Caching", () => {
  let userId: string;
  let userToken: string;
  let accountId: string;
  const originalFetch = global.fetch;

  async function registerAndLogin(email: string) {
    await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password: "StrongPassword123!", confirmPassword: "StrongPassword123!" })
      .expect(201);

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "StrongPassword123!" })
      .expect(200);

    return {
      userId: loginRes.body.data.user.id,
      token: loginRes.body.data.accessToken,
    };
  }

  beforeEach(async () => {
    await cleanDatabase();

    const auth = await registerAndLogin("media_test@replyza.buzz");
    userId = auth.userId;
    userToken = auth.token;

    // Create connected Instagram account
    const encryptedToken = encryptToken("EAAB_test_instagram_media_token_12345");
    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: "ig_user_media_test_100",
        username: "testcreator",
        encryptedAccessToken: encryptedToken,
        status: "ACTIVE",
      },
    });
    accountId = account.id;

    // Clear any redis cache keys
    const keys = await redisConnection.keys("ig:media:*");
    if (keys.length > 0) {
      await redisConnection.del(...keys);
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("1. Requires authentication and valid account ownership", async () => {
    // Unauthenticated
    await request(app)
      .get(`/api/v1/instagram/accounts/${accountId}/media`)
      .expect(401);

    // Another user's account -> 404
    const otherAuth = await registerAndLogin("other_user@replyza.buzz");

    await request(app)
      .get(`/api/v1/instagram/accounts/${accountId}/media`)
      .set("Authorization", `Bearer ${otherAuth.token}`)
      .expect(404);
  });

  it("2. Fetches media library from Meta and caches in Redis for 5 minutes", async () => {
    let metaFetchCount = 0;

    const mockMediaList = [
      {
        id: "17900000000000001",
        caption: "Summer collection drops today! Comment LINK for 20% off",
        media_type: "VIDEO",
        media_product_type: "REELS",
        thumbnail_url: "https://scontent.cdninstagram.com/reel_thumb.jpg",
        permalink: "https://www.instagram.com/reel/C123456/",
        timestamp: "2026-11-20T10:00:00+0000",
      },
      {
        id: "17900000000000002",
        caption: "Our best selling items",
        media_type: "IMAGE",
        media_product_type: "FEED",
        media_url: "https://scontent.cdninstagram.com/photo.jpg",
        permalink: "https://www.instagram.com/p/C789012/",
        timestamp: "2026-11-19T10:00:00+0000",
      },
    ];

    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      metaFetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: mockMediaList,
          paging: {
            cursors: {
              after: "cursor_page_2_abc",
            },
          },
        }),
      } as Response;
    });

    // First request: calls Meta API
    const res1 = await request(app)
      .get(`/api/v1/instagram/accounts/${accountId}/media`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    expect(res1.body.success).toBe(true);
    expect(res1.body.data).toHaveLength(2);
    expect(res1.body.data[0].id).toBe("17900000000000001");
    expect(res1.body.data[0].media_product_type).toBe("REELS");
    expect(res1.body.paging.cursors.after).toBe("cursor_page_2_abc");
    expect(metaFetchCount).toBe(1);

    // Second request: served immediately from Redis cache (Meta API is NOT called again)
    const res2 = await request(app)
      .get(`/api/v1/instagram/accounts/${accountId}/media`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    expect(res2.body.success).toBe(true);
    expect(res2.body.data).toHaveLength(2);
    expect(metaFetchCount).toBe(1); // Cached! No additional call to Meta
  });

  it("3. Detects expired/revoked OAuth token (Code 190) and updates account status", async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Error validating access token: Session has expired.",
            type: "OAuthException",
            code: 190,
            error_subcode: 463,
          },
        }),
      } as Response;
    });

    const res = await request(app)
      .get(`/api/v1/instagram/accounts/${accountId}/media`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(401);

    expect(res.body.code).toBe(190);

    // Verify account status updated in DB
    const updatedAccount = await prisma.instagramAccount.findUnique({
      where: { id: accountId },
    });
    expect(updatedAccount?.status).toBe("NEEDS_RECONNECT");
  });
});
