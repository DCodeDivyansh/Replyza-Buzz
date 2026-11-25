import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { encryptToken } from "@replyza/shared";
import { cleanDatabase } from "../setup";
import { deliverProducts } from "../../apps/worker/src/services/product-delivery.service";

describe("Multi-Product Automation & Delivery Engine", () => {
  let userId: string;
  let userToken: string;
  let accountId: string;

  beforeEach(async () => {
    await cleanDatabase();

    await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "multiproduct@replyza.buzz",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
      .expect(201);

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "multiproduct@replyza.buzz", password: "StrongPassword123!" })
      .expect(200);

    userId = loginRes.body.data.user.id;
    userToken = loginRes.body.data.accessToken;

    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: "ig_multi_123",
        username: "creator_shop",
        encryptedAccessToken: encryptToken(
          "dummy_token",
          process.env.META_TOKEN_ENCRYPTION_KEY!
        ),
        status: "ACTIVE",
        webhookSubscribed: true,
      },
    });
    accountId = account.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Creates, reorders, and updates an automation with multiple products", async () => {
    const createRes = await request(app)
      .post("/api/v1/automations")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        instagramAccountId: accountId,
        name: "Skincare Haul",
        mediaId: "media_haul_1",
        triggerType: "KEYWORD",
        keywordMatchMode: "CONTAINS",
        keywordMatchLogic: "ALL_KEYWORDS",
        keywords: ["SKIN", "LINK"],
        publicReplyEnabled: true,
        publicReplyText: "Sent all links to your DMs!",
        dmMessageText: "Here are my top picks:",
        productDeliveryMode: "SEPARATE_MESSAGES",
        deliveryMode: "BUTTON",
        buttonLabel: "Send Links",
        products: [
          {
            name: "Cleanser",
            affiliateUrl: "https://aff.example.com/cleanser?tag=1",
            price: "₹499",
            ctaLabel: "Shop Now",
          },
          {
            name: "Sunscreen",
            affiliateUrl: "https://aff.example.com/sunscreen?tag=2",
            price: "₹699",
            ctaLabel: "Buy Now",
          },
        ],
      })
      .expect(201);

    const automation = createRes.body.data;
    expect(automation.products).toHaveLength(2);
    expect(automation.products[0].name).toBe("Cleanser");
    expect(automation.products[1].name).toBe("Sunscreen");

    // Reorder products on PATCH
    const updateRes = await request(app)
      .patch(`/api/v1/automations/${automation.id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        products: [
          {
            name: "Sunscreen",
            affiliateUrl: "https://aff.example.com/sunscreen?tag=2",
            price: "₹699",
            ctaLabel: "Buy Now",
          },
          {
            name: "Cleanser",
            affiliateUrl: "https://aff.example.com/cleanser?tag=1",
            price: "₹499",
            ctaLabel: "Shop Now",
          },
        ],
      })
      .expect(200);

    expect(updateRes.body.data.products[0].name).toBe("Sunscreen");
    expect(updateRes.body.data.products[1].name).toBe("Cleanser");
  });

  it("2. Delivers multiple products sequentially and as Generic Cards via mocked Meta Graph API", async () => {
    const sentPayloads: Array<Record<string, unknown>> = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const bodyStr = String(init?.body || "");
      const params = new URLSearchParams(bodyStr);
      const msgJson = params.get("message");
      if (msgJson) {
        sentPayloads.push(JSON.parse(msgJson));
      }
      return new Response(JSON.stringify({ message_id: `mid_${sentPayloads.length}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const products = [
      {
        name: "Product A",
        affiliateUrl: "https://aff.example.com/a?tag=1",
        imageUrl: "https://cdn.example.com/a.jpg",
        price: "$20",
        ctaLabel: "Shop A",
      },
      {
        name: "Product B",
        affiliateUrl: "https://aff.example.com/b?tag=2",
        imageUrl: "https://cdn.example.com/b.jpg",
        price: "$35",
        ctaLabel: "Shop B",
      },
    ];

    // SEPARATE_MESSAGES
    await deliverProducts({
      executionId: "exec-1",
      instagramUserId: "ig_multi_123",
      accessToken: "token",
      isPrivateReply: false,
      recipientIgsid: "igsid_user_1",
      baseText: "Here are your links:",
      products,
      productDeliveryMode: "SEPARATE_MESSAGES",
      baseContext: { firstName: "Alex", username: "alex", keyword: "LINK" },
    });

    expect(sentPayloads).toHaveLength(3); // intro + Product A + Product B
    expect(String(sentPayloads[1].text)).toContain("https://aff.example.com/a?tag=1");
    expect(String(sentPayloads[2].text)).toContain("https://aff.example.com/b?tag=2");

    // GENERIC_CARDS
    sentPayloads.length = 0;
    await deliverProducts({
      executionId: "exec-2",
      instagramUserId: "ig_multi_123",
      accessToken: "token",
      isPrivateReply: false,
      recipientIgsid: "igsid_user_2",
      baseText: "Top picks:",
      products,
      productDeliveryMode: "GENERIC_CARDS",
      baseContext: { firstName: "Alex", username: "alex", keyword: "LINK" },
    });

    const cardMsg = sentPayloads.find((p) => Boolean(p.attachment));
    expect(cardMsg).toBeDefined();
    const attachment = cardMsg!.attachment as {
      type: string;
      payload: { template_type: string; elements: Array<{ title: string }> };
    };
    expect(attachment.payload.template_type).toBe("generic");
    expect(attachment.payload.elements).toHaveLength(2);
    expect(attachment.payload.elements[0].title).toBe("Product A");
  });
});
