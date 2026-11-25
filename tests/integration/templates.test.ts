import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app";
import { cleanDatabase } from "../setup";

describe("Automation Templates API", () => {
  let userId: string;
  let userToken: string;

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

    const auth = await registerAndLogin("templates_test@replyza.buzz");
    userId = auth.userId;
    userToken = auth.token;
  });

  it("1. Lists system templates by default", async () => {
    const res = await request(app)
      .get("/api/v1/templates")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(9);

    const templateNames = res.body.data.map((t: { name: string }) => t.name);
    expect(templateNames).toContain("Friendly Link Delivery");
    expect(templateNames).toContain("Professional Product Details");
    expect(templateNames).toContain("Multi-Product Roundup");
    expect(templateNames).toContain("Affiliate Favorites Collection");
    expect(templateNames).toContain("Follow-to-Get-Link");
  });

  it("2. Allows creating and retrieving a custom template", async () => {
    const createPayload = {
      name: "VIP Webinar Invite",
      category: "Webinars",
      description: "Delivers private webinar registration link",
      triggerType: "KEYWORD",
      keywords: ["WEBINAR", "REGISTER"],
      publicReplyText: "Check your DMs {{username}} for your ticket! 🎟️",
      dmMessageText: "Hey {{first_name}}! Here is your exclusive pass to the webinar:",
      dmLink: "https://example.com/webinar",
      followRequired: true,
      followInstructionText: "Follow @brand and tap below to claim your ticket!",
      followSuccessText: "Ticket confirmed for {{first_name}}! Link:",
    };

    const createRes = await request(app)
      .post("/api/v1/templates")
      .set("Authorization", `Bearer ${userToken}`)
      .send(createPayload)
      .expect(201);

    expect(createRes.body.success).toBe(true);
    const createdId = createRes.body.data.id;
    expect(createdId).toBeDefined();

    // Retrieve by ID
    const getRes = await request(app)
      .get(`/api/v1/templates/${createdId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    expect(getRes.body.data.name).toBe("VIP Webinar Invite");
    expect(getRes.body.data.followRequired).toBe(true);
    expect(getRes.body.data.keywords).toEqual(["WEBINAR", "REGISTER"]);

    // Appears in list
    const listRes = await request(app)
      .get("/api/v1/templates")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    const custom = listRes.body.data.find((t: { id: string }) => t.id === createdId);
    expect(custom).toBeDefined();
    expect(custom.isSystem).toBe(false);

    // Delete custom template
    await request(app)
      .delete(`/api/v1/templates/${createdId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
  });

  it("3. Prevents deleting system templates", async () => {
    // Attempt to delete system template ID
    await request(app)
      .delete("/api/v1/templates/00000000-0000-0000-0000-000000000001")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(404);
  });
});
