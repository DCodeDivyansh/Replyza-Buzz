import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { generateAccessToken } from "../../apps/api/src/utils/jwt";
import { cleanDatabase } from "../setup";

describe("Affiliate Products API", () => {
  let userToken: string;
  let otherUserToken: string;

  beforeEach(async () => {
    await cleanDatabase();

    const owner = await prisma.user.create({
      data: {
        email: "products_owner@replyza.buzz",
        passwordHash: "test_hash_not_used",
      },
    });
    const other = await prisma.user.create({
      data: {
        email: "products_other@replyza.buzz",
        passwordHash: "test_hash_not_used",
      },
    });

    await prisma.refreshToken.createMany({
      data: [
        {
          userId: owner.id,
          tokenHash: `hash_${owner.id}`,
          familyId: owner.id,
          expiresAt: new Date(Date.now() + 3600_000),
        },
        {
          userId: other.id,
          tokenHash: `hash_${other.id}`,
          familyId: other.id,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      ],
    });

    userToken = generateAccessToken(owner.id, owner.id);
    otherUserToken = generateAccessToken(other.id, other.id);
  });

  it("1. Creates, edits, duplicates, and deletes a product while preserving affiliate query params", async () => {
    const affiliateUrl =
      "https://affiliate.example.com/dp/B001?tag=replyza-20&utm_source=instagram&ref=reel1";

    const createRes = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        name: "Vitamin C Serum",
        brand: "GlowLab",
        affiliateUrl,
        price: "₹1,499",
        discountPrice: "₹999",
        couponCode: "GLOW20",
        category: "Skincare",
        ctaLabel: "Shop Now",
      })
      .expect(201);

    const product = createRes.body.data;
    expect(product.affiliateUrl).toBe(affiliateUrl);
    expect(product.couponCode).toBe("GLOW20");

    // Edit
    const patchRes = await request(app)
      .patch(`/api/v1/products/${product.id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ discountPrice: "₹899" })
      .expect(200);
    expect(patchRes.body.data.discountPrice).toBe("₹899");
    expect(patchRes.body.data.affiliateUrl).toBe(affiliateUrl);

    // Duplicate
    const dupRes = await request(app)
      .post(`/api/v1/products/${product.id}/duplicate`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(201);
    expect(dupRes.body.data.name).toContain("(Copy)");
    expect(dupRes.body.data.affiliateUrl).toBe(affiliateUrl);

    // Ownership isolation (IDOR check)
    await request(app)
      .get(`/api/v1/products/${product.id}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .expect(404);

    await request(app)
      .delete(`/api/v1/products/${product.id}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .expect(404);

    // Delete by owner
    await request(app)
      .delete(`/api/v1/products/${product.id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
  });

  it("2. Rejects malformed URLs and supports bulk import", async () => {
    await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        name: "Broken Product",
        affiliateUrl: "not-a-valid-url",
      })
      .expect(400);

    const bulkRes = await request(app)
      .post("/api/v1/products/bulk")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        rawText:
          "Product 1 | https://affiliate-link-1.com?tag=a\nProduct 2 | https://affiliate-link-2.com?tag=b",
        extractMetadata: false,
      })
      .expect(201);

    expect(bulkRes.body.data).toHaveLength(2);
    expect(bulkRes.body.data[0].name).toBe("Product 1");
    expect(bulkRes.body.data[0].affiliateUrl).toBe("https://affiliate-link-1.com?tag=a");
  });

  it("3. Gracefully handles blocked/private metadata import URLs", async () => {
    const res = await request(app)
      .post("/api/v1/products/import-metadata")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ url: "http://127.0.0.1:4000/secret" })
      .expect(200);

    expect(res.body.data.extracted).toBe(false);
    expect(res.body.data.warning).toBeDefined();
  });
});
