/**
 * Instagram OAuth Callback Integration Tests
 *
 * Requirements:
 * - Mock global fetch for Meta Graph API calls.
 * - Test success, Meta 36008 error, no assigned accounts, account owned by another user.
 * - Assert redirect_uri is sent on token exchange.
 * - Test both POST (JSON API) and GET (Browser 302 redirect flow).
 *
 * Meta Documentation Reference:
 * https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { createInstagramOAuthState } from "../../apps/api/src/utils/instagram-oauth-state";
import { decryptToken } from "../../packages/shared/src/token-encryption";
import { cleanDatabase } from "../setup";

describe("Instagram OAuth Callback Integration", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("POST /api/v1/instagram/oauth/callback (JSON API)", () => {
    it("1. Successfully connects Instagram account and asserts redirect_uri is sent on exchange", async () => {
      const user = await prisma.user.create({
        data: {
          email: "oauth_test@replyza.com",
          passwordHash: "argon2_dummy_hash",
        },
      });

      const state = createInstagramOAuthState(user.id);
      let capturedExchangeUrl: string | null = null;

      global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const urlStr = input.toString();

        if (urlStr.includes("/oauth/access_token")) {
          capturedExchangeUrl = urlStr;
          return new Response(
            JSON.stringify({
              access_token: "mock_meta_access_token_12345",
              token_type: "bearer",
              expires_in: 5184000, // 60 days
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (urlStr.includes("/me/assigned_instagram_accounts")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "meta_ig_acc_999",
                  username: "cool_store_official",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("Not found", { status: 404 });
      });

      const res = await request(app)
        .post("/api/v1/instagram/oauth/callback")
        .send({
          code: "valid_auth_code_from_meta",
          state: state,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.instagramUserId).toBe("meta_ig_acc_999");
      expect(res.body.data.username).toBe("cool_store_official");

      // Assert redirect_uri was sent on code exchange
      expect(capturedExchangeUrl).not.toBeNull();
      const parsedUrl = new URL(capturedExchangeUrl!);
      expect(parsedUrl.searchParams.get("redirect_uri")).toBeTruthy();
      expect(parsedUrl.searchParams.get("code")).toBe("valid_auth_code_from_meta");

      // Verify persisted account in DB with encrypted token
      const savedAccount = await prisma.instagramAccount.findUnique({
        where: { instagramUserId: "meta_ig_acc_999" },
      });
      expect(savedAccount).not.toBeNull();
      expect(savedAccount?.userId).toBe(user.id);
      expect(savedAccount?.username).toBe("cool_store_official");
      expect(savedAccount?.tokenExpiresAt).not.toBeNull();

      // Verify token was properly encrypted
      const key = process.env.META_TOKEN_ENCRYPTION_KEY!;
      const decrypted = decryptToken(savedAccount!.encryptedAccessToken, key);
      expect(decrypted).toBe("mock_meta_access_token_12345");
    });

    it("2. Handles Meta 36008-style permission error gracefully", async () => {
      const user = await prisma.user.create({
        data: {
          email: "oauth_err@replyza.com",
          passwordHash: "argon2_dummy_hash",
        },
      });

      const state = createInstagramOAuthState(user.id);

      global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const urlStr = input.toString();

        if (urlStr.includes("/oauth/access_token")) {
          return new Response(
            JSON.stringify({
              access_token: "mock_token_with_missing_perms",
              token_type: "bearer",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (urlStr.includes("/me/assigned_instagram_accounts")) {
          // Meta 36008: (#36008) User does not have an assigned Instagram account
          return new Response(
            JSON.stringify({
              error: {
                message: "(#36008) User does not have an assigned Instagram account.",
                type: "OAuthException",
                code: 36008,
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("Not found", { status: 404 });
      });

      const res = await request(app)
        .post("/api/v1/instagram/oauth/callback")
        .send({
          code: "code_with_36008",
          state: state,
        })
        .expect(502);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Unable to connect Instagram");
    });

    it("3. Handles no assigned Instagram accounts returned from Meta", async () => {
      const user = await prisma.user.create({
        data: {
          email: "no_accounts@replyza.com",
          passwordHash: "argon2_dummy_hash",
        },
      });

      const state = createInstagramOAuthState(user.id);

      global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const urlStr = input.toString();

        if (urlStr.includes("/oauth/access_token")) {
          return new Response(
            JSON.stringify({
              access_token: "mock_token_empty_accounts",
              token_type: "bearer",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (urlStr.includes("/me/assigned_instagram_accounts")) {
          return new Response(
            JSON.stringify({
              data: [], // No accounts assigned
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("Not found", { status: 404 });
      });

      const res = await request(app)
        .post("/api/v1/instagram/oauth/callback")
        .send({
          code: "code_empty_accounts",
          state: state,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("No Instagram accounts were assigned");
    });

    it("4. Prevents account takeover when Instagram account is already owned by another user", async () => {
      const userA = await prisma.user.create({
        data: {
          email: "user_a@replyza.com",
          passwordHash: "argon2_dummy_hash",
        },
      });

      const userB = await prisma.user.create({
        data: {
          email: "user_b@replyza.com",
          passwordHash: "argon2_dummy_hash",
        },
      });

      await prisma.instagramAccount.create({
        data: {
          userId: userA.id,
          instagramUserId: "ig_exclusive_123",
          username: "exclusive_brand",
          encryptedAccessToken: "enc_token_user_a",
        },
      });

      const stateB = createInstagramOAuthState(userB.id);

      global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const urlStr = input.toString();

        if (urlStr.includes("/oauth/access_token")) {
          return new Response(
            JSON.stringify({
              access_token: "mock_token_for_user_b",
              token_type: "bearer",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (urlStr.includes("/me/assigned_instagram_accounts")) {
          return new Response(
            JSON.stringify({
              data: [{ id: "ig_exclusive_123", username: "exclusive_brand" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("Not found", { status: 404 });
      });

      const res = await request(app)
        .post("/api/v1/instagram/oauth/callback")
        .send({
          code: "code_takeover_attempt",
          state: stateB,
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already connected to another Replyza user");

      const accountCheck = await prisma.instagramAccount.findUnique({
        where: { instagramUserId: "ig_exclusive_123" },
      });
      expect(accountCheck?.userId).toBe(userA.id);
    });
  });

  describe("GET /api/v1/instagram/oauth/callback (Browser Redirect Flow)", () => {
    it("5. Successfully redirects to frontend on successful OAuth", async () => {
      const user = await prisma.user.create({
        data: {
          email: "browser_redirect@replyza.com",
          passwordHash: "argon2_dummy_hash",
        },
      });

      const state = createInstagramOAuthState(user.id);

      global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const urlStr = input.toString();

        if (urlStr.includes("/oauth/access_token")) {
          return new Response(
            JSON.stringify({
              access_token: "mock_token_browser_flow",
              token_type: "bearer",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (urlStr.includes("/me/assigned_instagram_accounts")) {
          return new Response(
            JSON.stringify({
              data: [{ id: "ig_browser_user", username: "browser_shopper" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("Not found", { status: 404 });
      });

      const res = await request(app)
        .get("/api/v1/instagram/oauth/callback")
        .query({
          code: "code_browser_ok",
          state: state,
        })
        .expect(302);

      expect(res.headers.location).toContain("/instagram?instagram=connected");
    });
  });
});
