import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";

describe("Cuelinks Affiliate Integration API", () => {
  let userId: string;
  let authHeader: string;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanDatabase();

    const email = `cuelinks_${Date.now()}_${Math.random()}@replyza.buzz`;
    const password = "StrongPassword123!";
    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, confirmPassword: password })
      .expect(201);
    userId = reg.body.data.user.id;

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    authHeader = `Bearer ${login.body.data.accessToken}`;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects unauthenticated requests with 401", async () => {
    await request(app).get("/api/v1/integrations/cuelinks").expect(401);
    await request(app)
      .put("/api/v1/integrations/cuelinks")
      .send({ publisherId: "123" })
      .expect(401);
    await request(app)
      .post("/api/v1/integrations/cuelinks/convert")
      .send({ url: "https://amazon.in/dp/1" })
      .expect(401);
    await request(app).delete("/api/v1/integrations/cuelinks").expect(401);
  });

  it("returns 400 when converting without Cuelinks configured", async () => {
    await request(app)
      .post("/api/v1/integrations/cuelinks/convert")
      .set("Authorization", authHeader)
      .send({ url: "https://www.amazon.in/dp/B09G9BL5CP" })
      .expect(400);
  });

  it("saves, masks, encrypts at rest, updates, and deletes Cuelinks credentials", async () => {
    const initial = await request(app)
      .get("/api/v1/integrations/cuelinks")
      .set("Authorization", authHeader)
      .expect(200);
    expect(initial.body.data.connected).toBe(false);

    const secretKey = "my_super_secret_cuelinks_api_key";
    const saveRes = await request(app)
      .put("/api/v1/integrations/cuelinks")
      .set("Authorization", authHeader)
      .send({ publisherId: "pub_778899", apiKey: secretKey })
      .expect(200);

    expect(saveRes.body.data.connected).toBe(true);
    expect(saveRes.body.data.publisherId).toBe("pub_778899");
    expect(saveRes.body.data.hasApiKey).toBe(true);
    expect(JSON.stringify(saveRes.body)).not.toContain(secretKey);

    // Verify encrypted at rest in DB
    const dbRow = await prisma.affiliateIntegration.findUnique({
      where: { userId_provider: { userId, provider: "CUELINKS" } },
    });
    expect(dbRow?.apiKeyEncrypted).toBeTruthy();
    expect(dbRow?.apiKeyEncrypted).not.toContain(secretKey);
    expect(dbRow?.apiKeyEncrypted?.split(":")).toHaveLength(3);

    // GET never returns apiKey
    const getRes = await request(app)
      .get("/api/v1/integrations/cuelinks")
      .set("Authorization", authHeader)
      .expect(200);
    expect(getRes.body.data.hasApiKey).toBe(true);
    expect(JSON.stringify(getRes.body)).not.toContain(secretKey);

    // Updating publisherId without apiKey preserves existing encrypted key
    await request(app)
      .put("/api/v1/integrations/cuelinks")
      .set("Authorization", authHeader)
      .send({ publisherId: "pub_990011" })
      .expect(200);
    const dbAfter = await prisma.affiliateIntegration.findUnique({
      where: { userId_provider: { userId, provider: "CUELINKS" } },
    });
    expect(dbAfter?.publisherId).toBe("pub_990011");
    expect(dbAfter?.apiKeyEncrypted).toBe(dbRow?.apiKeyEncrypted);

    // Delete
    await request(app)
      .delete("/api/v1/integrations/cuelinks")
      .set("Authorization", authHeader)
      .expect(200);

    const afterDel = await request(app)
      .get("/api/v1/integrations/cuelinks")
      .set("Authorization", authHeader)
      .expect(200);
    expect(afterDel.body.data.connected).toBe(false);
  });

  it("converts URLs via deeplink, short-link API, timeout fallback, and prevents double-wrapping", async () => {
    // 1. Save without API key -> instant deeplink
    await request(app)
      .put("/api/v1/integrations/cuelinks")
      .set("Authorization", authHeader)
      .send({ publisherId: "12345" })
      .expect(200);

    const deepRes = await request(app)
      .post("/api/v1/integrations/cuelinks/convert")
      .set("Authorization", authHeader)
      .send({
        url: "https://www.flipkart.com/product/p/itm123",
        subid: "auto_reel_1",
      })
      .expect(200);

    expect(deepRes.body.data.method).toBe("deeplink");
    expect(deepRes.body.data.alreadyConverted).toBe(false);
    const deepUrl = new URL(deepRes.body.data.affiliateUrl);
    expect(deepUrl.hostname).toBe("linksredirect.com");
    expect(deepUrl.searchParams.get("pub_id")).toBe("12345");
    expect(deepUrl.searchParams.get("subid")).toBe("auto_reel_1");

    // 2. Double-wrap prevention
    const alreadyRes = await request(app)
      .post("/api/v1/integrations/cuelinks/convert")
      .set("Authorization", authHeader)
      .send({ url: deepRes.body.data.affiliateUrl })
      .expect(200);
    expect(alreadyRes.body.data.alreadyConverted).toBe(true);
    expect(alreadyRes.body.data.affiliateUrl).toBe(deepRes.body.data.affiliateUrl);

    // 3. Rejects javascript: URL
    await request(app)
      .post("/api/v1/integrations/cuelinks/convert")
      .set("Authorization", authHeader)
      .send({ url: "javascript:alert(1)" })
      .expect(400);

    // 4. With API key -> uses Cuelinks short-link API
    await request(app)
      .put("/api/v1/integrations/cuelinks")
      .set("Authorization", authHeader)
      .send({ publisherId: "12345", apiKey: "cue_api_key_test" })
      .expect(200);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ short_url: "https://clnk.in/short99" }),
    } as Response);

    const apiRes = await request(app)
      .post("/api/v1/integrations/cuelinks/convert")
      .set("Authorization", authHeader)
      .send({ url: "https://www.myntra.com/shirt/123" })
      .expect(200);

    expect(apiRes.body.data.method).toBe("api");
    expect(apiRes.body.data.affiliateUrl).toBe("https://clnk.in/short99");

    // 5. API failure/timeout -> falls back cleanly to deeplink
    global.fetch = vi.fn().mockRejectedValue(new Error("Request timeout"));

    const fallbackRes = await request(app)
      .post("/api/v1/integrations/cuelinks/convert")
      .set("Authorization", authHeader)
      .send({ url: "https://www.ajio.com/jeans/456" })
      .expect(200);

    expect(fallbackRes.body.data.method).toBe("deeplink");
    expect(fallbackRes.body.data.affiliateUrl).toContain("https://linksredirect.com/");
  });
});
