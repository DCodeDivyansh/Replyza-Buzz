import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";

describe("Meta Webhook Verification, Signatures, Deduplication & Matching", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN!;
  const APP_SECRET = process.env.META_APP_SECRET!;

  function signPayload(body: string): string {
    const signature = createHmac("sha256", APP_SECRET).update(body).digest("hex");
    return `sha256=${signature}`;
  }

  it("1. Webhook GET verification (challenge, bad token, missing params)", async () => {
    const challenge = "1158201444";

    // Valid challenge
    const res = await request(app)
      .get("/api/v1/webhooks/instagram")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": challenge,
      })
      .expect(200);

    expect(res.text).toBe(challenge);

    // Bad token -> 403
    await request(app)
      .get("/api/v1/webhooks/instagram")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong_token",
        "hub.challenge": challenge,
      })
      .expect(403);

    // Missing params -> 400
    await request(app)
      .get("/api/v1/webhooks/instagram")
      .query({ "hub.mode": "subscribe" })
      .expect(400);
  });

  it("2. Webhook POST signature verification (valid, invalid, missing)", async () => {
    const rawBody = JSON.stringify({
      object: "instagram",
      entry: [],
    });

    // Missing signature header -> 401
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .send(rawBody)
      .expect(401);

    // Invalid signature -> 401
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", "sha256=0000000000000000000000000000000000000000000000000000000000000000")
      .send(rawBody)
      .expect(401);

    // Valid signature -> 200
    const validSig = signPayload(rawBody);
    const successRes = await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", validSig)
      .send(rawBody)
      .expect(200);

    expect(successRes.text).toBe("EVENT_RECEIVED");
  });

  it("3. Deduplication, keyword matching, media mismatch and status filtering", async () => {
    // Setup User and Instagram Account
    const user = await prisma.user.create({
      data: {
        email: "creator@example.com",
        passwordHash: "mock_hash",
      },
    });

    const account = await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: "ig_page_100",
        username: "top_creator",
        encryptedAccessToken: "mock_iv:mock_tag:mock_enc",
      },
    });

    // Create Active Keyword Automation on Media ID "media_999"
    const keywordAuto = await prisma.automation.create({
      data: {
        instagramAccountId: account.id,
        name: "Keyword Auto",
        mediaId: "media_999",
        triggerType: "KEYWORD",
        keywords: ["link", "guide"],
        publicReplyText: "Sent link!",
        dmMessageText: "Here is your link",
        status: "ACTIVE",
      },
    });

    function createCommentPayload(commentId: string, mediaId: string, text: string) {
      return JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: "ig_page_100",
            time: Date.now(),
            changes: [
              {
                field: "comments",
                value: {
                  id: commentId,
                  text: text,
                  media: { id: mediaId },
                  from: { id: "follower_555", username: "fan1" },
                },
              },
            ],
          },
        ],
      });
    }

    // A. Matching Keyword: "Can you send the LINK, please?" (case + punctuation test)
    const matchBody = createCommentPayload("c_001", "media_999", "Can you send the LINK, please?");
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(matchBody))
      .send(matchBody)
      .expect(200);

    // Verify webhook_event and automation_execution created
    const event1 = await prisma.webhookEvent.findFirst({
      where: { commentId: "c_001" },
      include: { execution: true },
    });
    expect(event1).not.toBeNull();
    expect(event1?.execution).not.toBeNull();
    expect(event1?.execution?.automationId).toBe(keywordAuto.id);
    expect(event1?.execution?.status).toBe("PENDING");

    // B. Deduplication: Send exact same comment again
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(matchBody))
      .send(matchBody)
      .expect(200);

    const eventsCount = await prisma.webhookEvent.count({
      where: { commentId: "c_001" },
    });
    expect(eventsCount).toBe(1); // No duplicate row created

    // C. Non-matching comment on same media
    const noMatchBody = createCommentPayload("c_002", "media_999", "Nice photo!");
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(noMatchBody))
      .send(noMatchBody)
      .expect(200);

    const event2 = await prisma.webhookEvent.findFirst({
      where: { commentId: "c_002" },
      include: { execution: true },
    });
    expect(event2).not.toBeNull();
    expect(event2?.execution).toBeNull(); // No execution because keywords did not match!
    expect(event2?.status).toBe("PROCESSED");

    // D. Media Mismatch
    const wrongMediaBody = createCommentPayload("c_003", "media_different_888", "send link");
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(wrongMediaBody))
      .send(wrongMediaBody)
      .expect(200);

    const event3 = await prisma.webhookEvent.findFirst({
      where: { commentId: "c_003" },
      include: { execution: true },
    });
    expect(event3?.execution).toBeNull();

    // E. Paused automation should NOT trigger
    await prisma.automation.update({
      where: { id: keywordAuto.id },
      data: { status: "PAUSED" },
    });

    const pausedBody = createCommentPayload("c_004", "media_999", "I need the link");
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(pausedBody))
      .send(pausedBody)
      .expect(200);

    const event4 = await prisma.webhookEvent.findFirst({
      where: { commentId: "c_004" },
      include: { execution: true },
    });
    expect(event4?.execution).toBeNull();
  });
});
