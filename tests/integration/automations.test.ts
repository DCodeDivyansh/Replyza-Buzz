import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";

describe("Automation CRUD, Status Transitions & Strict Ownership Isolation", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

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

  it("should enforce CRUD, status transitions and cross-user ownership isolation", async () => {
    const userA = await registerAndLogin("usera@example.com");
    const userB = await registerAndLogin("userb@example.com");

    // Seed Instagram accounts directly in DB for each user
    const accountA = await prisma.instagramAccount.create({
      data: {
        userId: userA.userId,
        instagramUserId: "ig_user_a_123",
        username: "usera_official",
        encryptedAccessToken: "mock_iv:mock_tag:mock_enc",
      },
    });

    const accountB = await prisma.instagramAccount.create({
      data: {
        userId: userB.userId,
        instagramUserId: "ig_user_b_456",
        username: "userb_official",
        encryptedAccessToken: "mock_iv:mock_tag:mock_enc",
      },
    });

    // 1. User A creates automation -> starts as DRAFT
    const createPayload = {
      instagramAccountId: accountA.id,
      name: "Promo Giveaway",
      mediaId: "post_media_001",
      mediaPermalink: "https://www.instagram.com/p/abc123xyz/",
      mediaType: "IMAGE",
      triggerType: "KEYWORD",
      keywords: ["win", "prize"],
      publicReplyText: "Check your DMs! Sent you the entry link.",
      dmMessageText: "Here is your VIP giveaway link: https://example.com/win",
      dmLink: "https://example.com/win",
    };

    const createRes = await request(app)
      .post("/api/v1/automations")
      .set("Authorization", `Bearer ${userA.token}`)
      .send(createPayload)
      .expect(201);

    const autoA = createRes.body.data;
    expect(autoA.id).toBeDefined();
    expect(autoA.name).toBe("Promo Giveaway");
    expect(autoA.status).toBe("DRAFT");

    // 2. User A reads their automations
    const listA = await request(app)
      .get("/api/v1/automations")
      .set("Authorization", `Bearer ${userA.token}`)
      .expect(200);
    expect(listA.body.data).toHaveLength(1);
    expect(listA.body.data[0].id).toBe(autoA.id);

    // 3. User A updates automation fields
    const updateRes = await request(app)
      .patch(`/api/v1/automations/${autoA.id}`)
      .set("Authorization", `Bearer ${userA.token}`)
      .send({
        name: "Updated Promo Giveaway",
        keywords: ["win", "prize", "contest"],
      })
      .expect(200);
    expect(updateRes.body.data.name).toBe("Updated Promo Giveaway");
    expect(updateRes.body.data.keywords).toEqual(["win", "prize", "contest"]);

    // 4. Status transitions: DRAFT -> ACTIVE -> PAUSED -> ACTIVE
    const actRes = await request(app)
      .patch(`/api/v1/automations/${autoA.id}/status`)
      .set("Authorization", `Bearer ${userA.token}`)
      .send({ status: "ACTIVE" })
      .expect(200);
    expect(actRes.body.data.status).toBe("ACTIVE");

    const pauseRes = await request(app)
      .patch(`/api/v1/automations/${autoA.id}/status`)
      .set("Authorization", `Bearer ${userA.token}`)
      .send({ status: "PAUSED" })
      .expect(200);
    expect(pauseRes.body.data.status).toBe("PAUSED");

    // 5. STRICT OWNERSHIP ISOLATION
    // User B must NOT be able to view User A's automation
    await request(app)
      .get(`/api/v1/automations/${autoA.id}`)
      .set("Authorization", `Bearer ${userB.token}`)
      .expect(404);

    // User B must NOT be able to edit User A's automation
    await request(app)
      .patch(`/api/v1/automations/${autoA.id}`)
      .set("Authorization", `Bearer ${userB.token}`)
      .send({ name: "Hacked by User B" })
      .expect(404);

    // User B must NOT be able to change status of User A's automation
    await request(app)
      .patch(`/api/v1/automations/${autoA.id}/status`)
      .set("Authorization", `Bearer ${userB.token}`)
      .send({ status: "ACTIVE" })
      .expect(404);

    // User B must NOT be able to delete User A's automation
    await request(app)
      .delete(`/api/v1/automations/${autoA.id}`)
      .set("Authorization", `Bearer ${userB.token}`)
      .expect(404);

    // User B must NOT be able to create an automation with User A's Instagram account ID
    const stolenAccountRes = await request(app)
      .post("/api/v1/automations")
      .set("Authorization", `Bearer ${userB.token}`)
      .send({
        ...createPayload,
        instagramAccountId: accountA.id, // User A's account!
        mediaId: "different_post",
      })
      .expect(404);
    expect(stolenAccountRes.body.message).toContain("Instagram account not found");

    // User B's automation list must be empty
    const listB = await request(app)
      .get("/api/v1/automations")
      .set("Authorization", `Bearer ${userB.token}`)
      .expect(200);
    expect(listB.body.data).toHaveLength(0);

    // 6. User A deletes their automation
    await request(app)
      .delete(`/api/v1/automations/${autoA.id}`)
      .set("Authorization", `Bearer ${userA.token}`)
      .expect(200);

    const postDeleteList = await request(app)
      .get("/api/v1/automations")
      .set("Authorization", `Bearer ${userA.token}`)
      .expect(200);
    expect(postDeleteList.body.data).toHaveLength(0);
  });
});
