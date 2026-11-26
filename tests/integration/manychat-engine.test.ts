import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";
import { matchCommentKeywords, signFollowCheckPayload } from "@replyza/shared";
import { automationQueue } from "../../apps/api/src/queues/automation.queue";
import { followCheckQueue } from "../../apps/api/src/queues/follow-check.queue";
import { processAutomationJob } from "../../apps/worker/src/processors/automation.processor";
import { processFollowCheckJob } from "../../apps/worker/src/processors/follow-check.processor";
import { recoverOrphanedRecords } from "../../apps/worker/src/services/outbox-dispatcher.service";

const APP_SECRET = process.env.META_APP_SECRET!;

function signWebhook(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

function buildCommentPayload(params: {
  igUserId: string;
  commentId: string;
  mediaId: string;
  fromId: string;
  fromUsername: string;
  text: string;
}) {
  return JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: params.igUserId,
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field: "comments",
            value: {
              id: params.commentId,
              text: params.text,
              from: { id: params.fromId, username: params.fromUsername },
              media: { id: params.mediaId, media_product_type: "REELS" },
            },
          },
        ],
      },
    ],
  });
}

describe("ManyChat Automation Engine (End-to-End & Edge Cases)", () => {
  let userId: string;
  let accountId: string;
  const igUserId = "ig_biz_mc_100";
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanDatabase();
    await automationQueue.drain();
    await followCheckQueue.drain();

    const user = await prisma.user.create({
      data: {
        email: `mc_test_${Date.now()}_${Math.random()}@replyza.buzz`,
        passwordHash: "$argon2id$mock",
      },
    });
    userId = user.id;

    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: igUserId,
        username: "replyza_brand",
        encryptedAccessToken: encryptToken("EAAB_mc_test_token"),
        status: "ACTIVE",
      },
    });
    accountId = account.id;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("1. Concurrent identical comment webhooks (10x burst) produce exactly 1 execution and 1 send per action", async () => {
    await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Burst Test",
        mediaId: "media_burst_1",
        triggerType: "KEYWORD",
        keywordMatchMode: "CONTAINS",
        keywords: ["LINK"],
        publicReplyText: "Sent!",
        dmMessageText: "Here is your link",
        dmLink: "https://replyza.buzz/guide",
        status: "ACTIVE",
      },
    });

    const commentId = `comment_burst_${Date.now()}`;
    const body = buildCommentPayload({
      igUserId,
      commentId,
      mediaId: "media_burst_1",
      fromId: "fan_1",
      fromUsername: "fan_one",
      text: "LINK please!",
    });
    const sig = signWebhook(body);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post("/api/v1/webhooks/instagram")
          .set("Content-Type", "application/json")
          .set("x-hub-signature-256", sig)
          .send(body)
      )
    );

    expect(responses.every((r) => r.status === 200)).toBe(true);

    const webhookEvents = await prisma.webhookEvent.findMany({ where: { commentId } });
    expect(webhookEvents).toHaveLength(1);

    const executions = await prisma.automationExecution.findMany({
      where: { webhookEventId: webhookEvents[0].id },
    });
    expect(executions).toHaveLength(1);

    const actions = await prisma.deliveryAction.findMany({
      where: { executionId: executions[0].id },
    });
    expect(actions).toHaveLength(2);
    expect(actions.map((a) => a.actionType).sort()).toEqual(["HOOK_DM", "PUBLIC_REPLY"]);
  });

  it("2. Overlapping automations precedence: media-specific > all-media > oldest active", async () => {
    const oldestAllMedia = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "All Media Oldest",
        mediaId: null,
        triggerType: "ANY_COMMENT",
        keywords: [],
        publicReplyText: "All media reply",
        dmMessageText: "All media DM",
        status: "ACTIVE",
        createdAt: new Date(Date.now() - 120_000),
      },
    });

    const specificMedia = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Specific Media",
        mediaId: "media_specific_99",
        triggerType: "ANY_COMMENT",
        keywords: [],
        publicReplyText: "Specific reply",
        dmMessageText: "Specific DM",
        status: "ACTIVE",
        createdAt: new Date(Date.now() - 60_000),
      },
    });

    // Specific media should win over all-media even though all-media is older
    const body1 = buildCommentPayload({
      igUserId,
      commentId: `c_prec_1_${Date.now()}`,
      mediaId: "media_specific_99",
      fromId: "fan_prec_1",
      fromUsername: "fan_prec",
      text: "hello",
    });
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(body1))
      .send(body1)
      .expect(200);

    const execSpecific = await prisma.automationExecution.findFirst({
      where: { automationId: specificMedia.id },
    });
    expect(execSpecific).toBeDefined();

    // Unmatched media should fall back to oldest active all-media automation
    const body2 = buildCommentPayload({
      igUserId,
      commentId: `c_prec_2_${Date.now()}`,
      mediaId: "media_other_100",
      fromId: "fan_prec_2",
      fromUsername: "fan_prec_2",
      text: "hello",
    });
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(body2))
      .send(body2)
      .expect(200);

    const execAll = await prisma.automationExecution.findFirst({
      where: { automationId: oldestAllMedia.id },
    });
    expect(execAll).toBeDefined();
  });

  it("3. Cooldown enforcement: blocks duplicate triggers from same user within cooldownSeconds, allows other users", async () => {
    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Cooldown Auto",
        mediaId: "media_cd_1",
        triggerType: "ANY_COMMENT",
        keywords: [],
        publicReplyText: "Reply!",
        dmMessageText: "DM!",
        cooldownSeconds: 3600,
        status: "ACTIVE",
      },
    });

    const first = buildCommentPayload({
      igUserId,
      commentId: `c_cd_1_${Date.now()}`,
      mediaId: "media_cd_1",
      fromId: "fan_same_user",
      fromUsername: "same_user",
      text: "first",
    });
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(first))
      .send(first)
      .expect(200);

    // Same user comments again within 3600s -> skipped by cooldown
    const second = buildCommentPayload({
      igUserId,
      commentId: `c_cd_2_${Date.now()}`,
      mediaId: "media_cd_1",
      fromId: "fan_same_user",
      fromUsername: "same_user",
      text: "second",
    });
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(second))
      .send(second)
      .expect(200);

    // Different user comments -> allowed
    const third = buildCommentPayload({
      igUserId,
      commentId: `c_cd_3_${Date.now()}`,
      mediaId: "media_cd_1",
      fromId: "fan_other_user",
      fromUsername: "other_user",
      text: "third",
    });
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(third))
      .send(third)
      .expect(200);

    const executions = await prisma.automationExecution.findMany({
      where: { automationId: auto.id },
    });
    expect(executions).toHaveLength(2);
  });

  it("4. Keyword modes (CONTAINS, EXACT, ANY) handle punctuation and emojis accurately", () => {
    expect(matchCommentKeywords("FREE!! 🔥", "CONTAINS", ["free"]).matched).toBe(true);
    expect(matchCommentKeywords("freebie", "CONTAINS", ["free"]).matched).toBe(false);
    expect(matchCommentKeywords("LINK!", "EXACT", ["link"]).matched).toBe(true);
    expect(matchCommentKeywords("send link please", "EXACT", ["link"]).matched).toBe(false);
    expect(matchCommentKeywords("literally anything 😊", "ANY", []).matched).toBe(true);
  });

  it("5. Independent failure matrix: PUBLIC_REPLY 400 does not block HOOK_DM; DUPLICATE_ACTION marks SENT; 429 retries only failed action", async () => {
    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Failure Matrix Auto",
        mediaId: "media_matrix_1",
        triggerType: "ANY_COMMENT",
        keywords: [],
        publicReplyText: "Public!",
        dmMessageText: "Hook!",
        dmLink: "https://replyza.buzz/m",
        deliveryMode: "BUTTON",
        buttonLabel: "Get Link",
        followRequired: false,
        status: "ACTIVE",
      },
    });

    const wh = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_mat_1_${Date.now()}`,
        mediaId: "media_matrix_1",
        commenterInstagramId: "fan_mat_1",
        commenterUsername: "fan_mat",
        commentText: "go",
        eventPayload: {},
      },
    });

    const exec = await prisma.automationExecution.create({
      data: {
        automationId: auto.id,
        webhookEventId: wh.id,
        status: "PENDING",
      },
    });

    // Case A: PUBLIC_REPLY permanent 400, HOOK_DM succeeds -> PARTIAL (DM still delivered!)
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const u = url.toString();
      if (u.includes("/replies")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: "Cannot reply to deleted comment", code: 100 } }),
        } as Response;
      }
      if (u.includes("/messages")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ message_id: "dm_hook_ok_1" }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await expect(
      processAutomationJob({
        data: {
          executionId: exec.id,
          automationId: auto.id,
          instagramAccountId: accountId,
          webhookEventId: wh.id,
          commentId: wh.commentId,
          commenterUsername: "fan_mat",
          commentText: "go",
          actionType: "PUBLIC_REPLY",
        },
      } as any)
    ).rejects.toThrow(/Cannot reply to deleted comment/);

    await processAutomationJob({
      data: {
        executionId: exec.id,
        automationId: auto.id,
        instagramAccountId: accountId,
        webhookEventId: wh.id,
        commentId: wh.commentId,
        commenterUsername: "fan_mat",
        commentText: "go",
        actionType: "HOOK_DM",
      },
    } as any);

    const afterA = await prisma.automationExecution.findUnique({ where: { id: exec.id } });
    expect(afterA?.publicReplyStatus).toBe("FAILED");
    expect(afterA?.privateReplyStatus).toBe("SUCCESS");
    expect(afterA?.status).toBe("PARTIAL");

    // Case B: DUPLICATE_ACTION on another execution's HOOK_DM marks DeliveryAction SENT
    const wh2 = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_mat_2_${Date.now()}`,
        mediaId: "media_matrix_1",
        commenterInstagramId: "fan_mat_2",
        commenterUsername: "fan_mat_2",
        commentText: "go",
        eventPayload: {},
      },
    });
    const exec2 = await prisma.automationExecution.create({
      data: { automationId: auto.id, webhookEventId: wh2.id, status: "PENDING" },
    });

    let msgCalls = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      if (url.toString().includes("/messages")) {
        msgCalls++;
        if (msgCalls === 1) {
          return {
            ok: false,
            status: 429,
            json: async () => ({ error: { message: "Rate limit", code: 4 } }),
          } as Response;
        }
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: { message: "This comment has already been replied to", code: 100, error_subcode: 2534005 },
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ id: "pub_2" }) } as Response;
    });

    // First attempt hits 429 -> throws for BullMQ retry and resets DeliveryAction to PENDING
    await expect(
      processAutomationJob({
        data: {
          executionId: exec2.id,
          automationId: auto.id,
          instagramAccountId: accountId,
          webhookEventId: wh2.id,
          commentId: wh2.commentId,
          commenterUsername: "fan_mat_2",
          commentText: "go",
          actionType: "HOOK_DM",
        },
      } as any)
    ).rejects.toThrow(/Rate limit/);

    // Second attempt hits DUPLICATE_ACTION -> treated as SENT
    await processAutomationJob({
      data: {
        executionId: exec2.id,
        automationId: auto.id,
        instagramAccountId: accountId,
        webhookEventId: wh2.id,
        commentId: wh2.commentId,
        commenterUsername: "fan_mat_2",
        commentText: "go",
        actionType: "HOOK_DM",
      },
    } as any);

    const dmAction2 = await prisma.deliveryAction.findUnique({
      where: { executionId_actionType: { executionId: exec2.id, actionType: "HOOK_DM" } },
    });
    expect(dmAction2?.status).toBe("SENT");
  });

  it("6. Follow-gate disabled skips verification; enabled caps NOT_FOLLOWING at 3 retries; desktop text consent & dmMeFallback work", async () => {
    // 6a. followRequired=false skips verification on tap
    const noGateAuto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "No Gate Auto",
        mediaId: "media_nogate",
        triggerType: "KEYWORD",
        keywords: ["GUIDE"],
        publicReplyText: "Check DM",
        dmMessageText: "Here is your guide:",
        dmLink: "https://replyza.buzz/nogate",
        followRequired: false,
        dmMeFallbackEnabled: true,
        status: "ACTIVE",
      },
    });
    const whNoGate = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_ng_${Date.now()}`,
        mediaId: "media_nogate",
        commenterInstagramId: "igsid_ng_1",
        commenterUsername: "ng_user",
        commentText: "GUIDE",
        eventPayload: {},
      },
    });
    const execNoGate = await prisma.automationExecution.create({
      data: {
        automationId: noGateAuto.id,
        webhookEventId: whNoGate.id,
        status: "PROCESSING",
        conversationState: "AWAITING_TAP",
        commenterIgsid: "igsid_ng_1",
      },
    });

    // Desktop text consent ("YES") while AWAITING_TAP enqueues followCheckQueue
    const consentBody = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: igUserId,
          time: Math.floor(Date.now() / 1000),
          messaging: [
            {
              sender: { id: "igsid_ng_1" },
              recipient: { id: igUserId },
              timestamp: Math.floor(Date.now() / 1000),
              message: {
                mid: `m_consent_${Date.now()}`,
                text: "YES",
              },
            },
          ],
        },
      ],
    });
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(consentBody))
      .send(consentBody)
      .expect(200);

    const queuedFollowJobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(queuedFollowJobs.some((j) => j.data.executionId === execNoGate.id)).toBe(true);

    // Process follow-check job -> must NOT call is_user_follow_business GET endpoint
    let followGetCalled = false;
    let sentLinkText = "";
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        followGetCalled = true;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        const params = new URLSearchParams(init.body as string);
        sentLinkText = JSON.parse(params.get("message") || "{}").text || "";
        return { ok: true, status: 200, json: async () => ({ message_id: "m_ng_sent" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await processFollowCheckJob({
      data: { executionId: execNoGate.id, igsid: "igsid_ng_1", instagramUserId: igUserId },
    } as any);
    expect(followGetCalled).toBe(false);
    expect(sentLinkText).toContain("https://replyza.buzz/nogate");

    // 6b. NOT_FOLLOWING retry cap at 3
    const gateAuto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Gate Auto",
        mediaId: "media_gate",
        triggerType: "ANY_COMMENT",
        keywords: [],
        publicReplyText: "Check DM",
        dmMessageText: "Follow first",
        dmLink: "https://replyza.buzz/vip",
        followRequired: true,
        followFallbackText: "Not following yet!",
        status: "ACTIVE",
      },
    });
    const whGate = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_g_${Date.now()}`,
        mediaId: "media_gate",
        commenterInstagramId: "igsid_gate_1",
        commenterUsername: "gate_user",
        commentText: "hi",
        eventPayload: {},
      },
    });
    const execGate = await prisma.automationExecution.create({
      data: {
        automationId: gateAuto.id,
        webhookEventId: whGate.id,
        status: "PROCESSING",
        followCheckRetryCount: 3,
      },
    });

    let dmCountAfterCap = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "igsid_gate_1", is_user_follow_business: false }),
        } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        dmCountAfterCap++;
        return { ok: true, status: 200, json: async () => ({ message_id: "m_should_not_send" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await processFollowCheckJob({
      data: { executionId: execGate.id, igsid: "igsid_gate_1", instagramUserId: igUserId },
    } as any);
    const gateAfter = await prisma.automationExecution.findUnique({ where: { id: execGate.id } });
    expect(gateAfter?.followCheckStatus).toBe("FAILED");
    expect(gateAfter?.conversationState).toBe("FAILED");
    expect(gateAfter?.followCheckRetryCount).toBe(3);
    expect(dmCountAfterCap).toBe(1); // final closing message only, no retry increment

    // 6c. dmMeFallbackEnabled inbound DM keyword match
    await followCheckQueue.drain();
    let dmFallbackReplied = false;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("/messages") && init?.method === "POST") {
        dmFallbackReplied = true;
        return { ok: true, status: 200, json: async () => ({ message_id: "m_dm_fallback_ok" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    const dmFallbackBody = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: igUserId,
          time: Math.floor(Date.now() / 1000),
          messaging: [
            {
              sender: { id: "igsid_dm_me_user" },
              recipient: { id: igUserId },
              timestamp: Math.floor(Date.now() / 1000),
              message: {
                mid: `m_dm_me_${Date.now()}`,
                text: "GUIDE please",
              },
            },
          ],
        },
      ],
    });
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(dmFallbackBody))
      .send(dmFallbackBody)
      .expect(200);

    const dmFallbackJobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    const dmJob = dmFallbackJobs.find((j) => j.data.igsid === "igsid_dm_me_user");
    expect(dmJob).toBeDefined();
    await processFollowCheckJob(dmJob as any);

    expect(dmFallbackReplied).toBe(true);
  });

  it("7. Stale SENDING delivery action (worker killed mid-job) is reconciled to NEEDS_REVIEW without duplicate resend", async () => {
    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Stale Sending Auto",
        mediaId: "media_stale",
        triggerType: "ANY_COMMENT",
        keywords: [],
        publicReplyText: "Hi",
        dmMessageText: "DM",
        status: "ACTIVE",
      },
    });
    const wh = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_stale_${Date.now()}`,
        mediaId: "media_stale",
        commenterInstagramId: "fan_stale",
        commenterUsername: "fan_stale",
        commentText: "yo",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId: auto.id,
        webhookEventId: wh.id,
        status: "PROCESSING",
      },
    });

    const threeMinutesAgo = new Date(Date.now() - 180_000);
    await prisma.$executeRaw`
      INSERT INTO "delivery_actions" ("id", "executionId", "actionType", "status", "attempts", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${exec.id}::uuid, 'HOOK_DM'::"DeliveryActionType", 'SENDING'::"DeliveryActionStatus", 1, ${threeMinutesAgo}, ${threeMinutesAgo})
    `;

    await recoverOrphanedRecords();

    const reconciled = await prisma.deliveryAction.findUnique({
      where: { executionId_actionType: { executionId: exec.id, actionType: "HOOK_DM" } },
    });
    expect(reconciled?.status).toBe("NEEDS_REVIEW");
    expect(reconciled?.lastErrorCode).toBe("STALE_SENDING");
  });
});
