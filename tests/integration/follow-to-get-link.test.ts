import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";
import { followCheckQueue } from "../../apps/api/src/queues/follow-check.queue";
import { processFollowCheckJob } from "../../apps/worker/src/processors/follow-check.processor";

describe("Follow-to-Get-Link Compliant Workflow", () => {
  let userId: string;
  let accountId: string;
  let automationId: string;
  let executionId: string;
  const originalFetch = global.fetch;

  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN!;
  const APP_SECRET = process.env.META_APP_SECRET!;

  function signPayload(body: string): string {
    const signature = createHmac("sha256", APP_SECRET).update(body).digest("hex");
    return `sha256=${signature}`;
  }

  beforeEach(async () => {
    await cleanDatabase();

    const user = await prisma.user.create({
      data: {
        email: "follow_test@replyza.buzz",
        passwordHash: "$argon2id$mock_hash_for_test",
      },
    });
    userId = user.id;

    const encryptedToken = encryptToken("EAAB_test_follow_gate_token_12345");
    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: "ig_biz_user_555",
        username: "superbrand",
        encryptedAccessToken: encryptedToken,
        status: "ACTIVE",
      },
    });
    accountId = account.id;

    // Create follow-gated automation
    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Follow-Gated VIP Coupon",
        mediaId: "post_reels_999",
        triggerType: "KEYWORD",
        keywords: ["VIP"],
        publicReplyText: "Check your DMs {{username}} to unlock VIP!",
        dmMessageText: "Hey {{first_name}}! Thanks for asking.",
        dmLink: "https://superbrand.com/vip-coupon",
        followRequired: true,
        followInstructionText: "Follow @superbrand and tap the button below! 👇",
        followSuccessText: "Woohoo thanks for following {{first_name}}! Here is your coupon:",
        followFallbackText: "You are not following @superbrand yet! Please follow and tap again.",
        status: "ACTIVE",
      },
    });
    automationId = auto.id;

    // Create initial comment event and execution
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: "comment_user_111",
        mediaId: "post_reels_999",
        commenterInstagramId: "commenter_user_111",
        commenterUsername: "jessica_fan",
        commentText: "VIP please!!",
        eventPayload: {},
      },
    });

    const execution = await prisma.automationExecution.create({
      data: {
        automationId,
        webhookEventId: webhookEvent.id,
        status: "PROCESSING",
        publicReplyStatus: "SUCCESS",
        privateReplyStatus: "SUCCESS",
        metaReplyId: "reply_123",
        metaPrivateReplyId: "dm_msg_123",
      },
    });
    executionId = execution.id;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("1. Ingests messaging webhook Quick Reply click with FOLLOW_CHECK payload", async () => {
    const rawPayload = {
      object: "instagram",
      entry: [
        {
          id: "ig_biz_user_555",
          time: 1700000000,
          messaging: [
            {
              sender: { id: "igsid_messaging_user_888" },
              recipient: { id: "ig_biz_user_555" },
              timestamp: 1700000000,
              message: {
                mid: "m_quick_reply_tap_123",
                text: "I've followed! ✅",
                quick_reply: {
                  payload: `FOLLOW_CHECK:${executionId}`,
                },
              },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(rawPayload);

    const res = await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(bodyString))
      .send(bodyString)
      .expect(200);

    expect(res.text).toBe("EVENT_RECEIVED");

    // Verify job enqueued in followCheckQueue
    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    const queuedJob = jobs.find((j) => j.data.executionId === executionId);
    expect(queuedJob).toBeDefined();
    expect(queuedJob?.data.igsid).toBe("igsid_messaging_user_888");
  });

  it("2. Processor sends success DM with link when user is following", async () => {
    let sentMessageText = "";
    let recipientId = "";

    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();

      // Check follower status endpoint
      if (urlStr.includes("fields=is_user_follow_business")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "igsid_messaging_user_888",
            is_user_follow_business: true,
            name: "Jessica Fan",
            username: "jessica_fan",
          }),
        } as Response;
      }

      // Send DM endpoint
      if (urlStr.includes("/messages") && init?.method === "POST") {
        const body = new URLSearchParams(init.body as string);
        const recipient = JSON.parse(body.get("recipient") || "{}");
        const message = JSON.parse(body.get("message") || "{}");

        recipientId = recipient.id;
        sentMessageText = message.text;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            message_id: "m_final_link_delivery_777",
          }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "Not found" }),
      } as Response;
    });

    const mockJob: any = {
      data: {
        executionId,
        igsid: "igsid_messaging_user_888",
        instagramUserId: "ig_biz_user_555",
      },
    };

    await processFollowCheckJob(mockJob);

    // Assertions
    expect(recipientId).toBe("igsid_messaging_user_888");
    expect(sentMessageText).toContain("Woohoo thanks for following Jessica Fan!");
    expect(sentMessageText).toContain("https://superbrand.com/vip-coupon");

    // Execution marked COMPLETED
    const updated = await prisma.automationExecution.findUnique({
      where: { id: executionId },
    });
    expect(updated?.status).toBe("COMPLETED");
  });

  it("3. Processor sends fallback retry when user is not following", async () => {
    let sentMessageText = "";
    let sentQuickReplies: any[] = [];

    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();

      if (urlStr.includes("fields=is_user_follow_business")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "igsid_messaging_user_888",
            is_user_follow_business: false, // NOT FOLLOWING
            name: "Jessica Fan",
            username: "jessica_fan",
          }),
        } as Response;
      }

      if (urlStr.includes("/messages") && init?.method === "POST") {
        const body = new URLSearchParams(init.body as string);
        const message = JSON.parse(body.get("message") || "{}");
        sentMessageText = message.text;
        sentQuickReplies = message.quick_replies || [];

        return {
          ok: true,
          status: 200,
          json: async () => ({
            message_id: "m_retry_fallback_888",
          }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "Not found" }),
      } as Response;
    });

    const mockJob: any = {
      data: {
        executionId,
        igsid: "igsid_messaging_user_888",
        instagramUserId: "ig_biz_user_555",
      },
    };

    await processFollowCheckJob(mockJob);

    expect(sentMessageText).toContain("You are not following @superbrand yet!");
    expect(sentQuickReplies).toHaveLength(1);
    expect(sentQuickReplies[0].payload).toBe(`FOLLOW_CHECK:${executionId}`);
  });
});
