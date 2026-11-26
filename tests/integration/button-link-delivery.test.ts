import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";
import { signFollowCheckPayload } from "@replyza/shared";
import { automationQueue } from "../../apps/api/src/queues/automation.queue";
import { followCheckQueue } from "../../apps/api/src/queues/follow-check.queue";
import { processAutomationJob } from "../../apps/worker/src/processors/automation.processor";
import { processFollowCheckJob } from "../../apps/worker/src/processors/follow-check.processor";
import { dispatchPendingOutboxEvents } from "../../apps/worker/src/services/outbox-dispatcher.service";

const APP_SECRET = process.env.META_APP_SECRET!;
const SESSION_SECRET = process.env.SESSION_SECRET!;

function signWebhook(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

function buildCommentWebhook(params: {
  igUserId: string;
  commentId: string;
  mediaId: string;
  commenterId: string;
  username: string;
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
              from: { id: params.commenterId, username: params.username },
              media: { id: params.mediaId },
            },
          },
        ],
      },
    ],
  });
}

function buildQuickReplyWebhook(params: {
  igUserId: string;
  senderId: string;
  mid: string;
  payload: string;
  title?: string;
}) {
  return JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: params.igUserId,
        time: Math.floor(Date.now() / 1000),
        messaging: [
          {
            sender: { id: params.senderId },
            recipient: { id: params.igUserId },
            timestamp: Math.floor(Date.now() / 1000),
            message: {
              mid: params.mid,
              text: params.title ?? "Send me the link",
              quick_reply: { payload: params.payload },
            },
          },
        ],
      },
    ],
  });
}

async function drainAutomationJobsForExecution(executionId: string) {
  const jobs = await automationQueue.getJobs(["waiting", "delayed", "active", "completed"]);
  const matching = jobs.filter((j) => j.data.executionId === executionId);
  for (const job of matching) {
    await processAutomationJob(job as never);
  }
}

function parseMetaBody(body: BodyInit | null | undefined): {
  recipient?: { comment_id?: string; id?: string };
  message?: { text?: string; quick_replies?: Array<{ payload: string; title: string }> };
} {
  const raw = String(body ?? "");
  if (raw.startsWith("{")) {
    return JSON.parse(raw);
  }
  const params = new URLSearchParams(raw);
  return {
    recipient: params.get("recipient") ? JSON.parse(params.get("recipient")!) : undefined,
    message: params.get("message") ? JSON.parse(params.get("message")!) : undefined,
  };
}

describe("Button & Follow-Gate Link Delivery E2E Suite", () => {
  let userId: string;
  let accountId: string;
  const igUserId = "ig_biz_e2e_1";
  const commenterId = "igsid_fan_e2e_1";
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanDatabase();
    await automationQueue.drain();
    await followCheckQueue.drain();

    const user = await prisma.user.create({
      data: {
        email: `e2e_${Date.now()}_${Math.random()}@replyza.buzz`,
        passwordHash: "$argon2id$mock",
      },
    });
    userId = user.id;

    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: igUserId,
        username: "e2e_brand",
        encryptedAccessToken: encryptToken("EAAB_e2e_token"),
        status: "ACTIVE",
      },
    });
    accountId = account.id;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("Scenario 1: Button automation full E2E (Comment -> Outbox/BullMQ -> HOOK_DM -> Quick Reply -> LINK_DM)", async () => {
    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Button Link E2E",
        mediaId: "media_btn_1",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Sent you a DM!",
        dmMessageText: "Hey! Tap below to get your link.",
        dmLink: "https://replyza.buzz/button-deal",
        deliveryMode: "BUTTON",
        buttonLabel: "Send me the link",
        followRequired: false,
        status: "ACTIVE",
      },
    });

    const commentBody = buildCommentWebhook({
      igUserId,
      commentId: `c_btn_${Date.now()}`,
      mediaId: "media_btn_1",
      commenterId,
      username: "fan_btn",
      text: "LINK please",
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(commentBody))
      .send(commentBody)
      .expect(200);

    const execAfterComment = await prisma.automationExecution.findFirst({
      where: { automationId: automation.id },
    });
    expect(execAfterComment).toBeDefined();
    const executionId = execAfterComment!.id;

    await dispatchPendingOutboxEvents();

    const sentQuickReplies: Array<{ payload: string; text: string }> = [];
    const sentLinkMessages: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/replies")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "pub_reply_btn_1" }),
        } as Response;
      }
      if (urlStr.includes("/messages") && init?.method === "POST") {
        const body = parseMetaBody(init.body);
        if (body.recipient?.comment_id) {
          sentQuickReplies.push({
            payload: body.message!.quick_replies![0].payload,
            text: body.message!.text!,
          });
          return {
            ok: true,
            status: 200,
            json: async () => ({ message_id: "hook_dm_btn_1" }),
          } as Response;
        }
        sentLinkMessages.push(body.message!.text!);
        return {
          ok: true,
          status: 200,
          json: async () => ({ message_id: "link_dm_btn_1" }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${urlStr}`);
    });

    // Run PUBLIC_REPLY and HOOK_DM jobs
    await drainAutomationJobsForExecution(executionId);

    expect(sentQuickReplies).toHaveLength(1);
    const execAfterHook = await prisma.automationExecution.findUnique({
      where: { id: executionId },
      include: { deliveryActions: true },
    });
    expect(execAfterHook?.conversationState).toBe("AWAITING_TAP");
    expect(execAfterHook?.status).toBe("PARTIAL");
    expect(execAfterHook?.completedAt).toBeNull();
    expect(execAfterHook?.deliveryActions.find((a) => a.actionType === "PUBLIC_REPLY")?.status).toBe("SENT");
    expect(execAfterHook?.deliveryActions.find((a) => a.actionType === "HOOK_DM")?.status).toBe("SENT");

    // User taps "Send me the link"
    const tapBody = buildQuickReplyWebhook({
      igUserId,
      senderId: commenterId,
      mid: `m_tap_btn_${Date.now()}`,
      payload: sentQuickReplies[0].payload,
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(tapBody))
      .send(tapBody)
      .expect(200);

    await dispatchPendingOutboxEvents();
    const followJobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    const followJob = followJobs.find((j) => j.data.executionId === executionId);
    expect(followJob).toBeDefined();

    await processFollowCheckJob(followJob! as never);

    expect(sentLinkMessages).toHaveLength(1);
    expect(sentLinkMessages[0]).toContain("https://replyza.buzz/button-deal");

    const finalExec = await prisma.automationExecution.findUnique({
      where: { id: executionId },
      include: { deliveryActions: true },
    });
    expect(finalExec?.status).toBe("COMPLETED");
    expect(finalExec?.conversationState).toBe("COMPLETED");
    expect(finalExec?.followCheckStatus).toBe("SUCCESS");
    expect(finalExec?.completedAt).not.toBeNull();
    expect(finalExec?.deliveryActions.find((a) => a.actionType === "LINK_DM")?.status).toBe("SENT");
  });

  it("Scenario 2: Follow-required automation E2E delivers link once after verification", async () => {
    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Follow Gate E2E",
        mediaId: "media_fg_1",
        triggerType: "KEYWORD",
        keywords: ["VIP"],
        publicReplyText: "Check DM!",
        dmMessageText: "Follow to unlock",
        dmLink: "https://replyza.buzz/vip-link",
        followRequired: true,
        followInstructionText: "Follow us and tap below!",
        followSuccessText: "Thanks for following! Here is your link:",
        status: "ACTIVE",
      },
    });

    const commentBody = buildCommentWebhook({
      igUserId,
      commentId: `c_fg_${Date.now()}`,
      mediaId: "media_fg_1",
      commenterId,
      username: "fan_fg",
      text: "VIP",
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(commentBody))
      .send(commentBody)
      .expect(200);

    const exec = await prisma.automationExecution.findFirst({
      where: { automationId: automation.id },
    });
    const executionId = exec!.id;
    await dispatchPendingOutboxEvents();

    const sentQuickReplies: string[] = [];
    let linkSendCount = 0;

    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/replies")) {
        return { ok: true, status: 200, json: async () => ({ id: "pub_fg_1" }) } as Response;
      }
      if (urlStr.includes("is_user_follow_business")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: commenterId, is_user_follow_business: true, name: "Fan" }),
        } as Response;
      }
      if (urlStr.includes("/messages") && init?.method === "POST") {
        const body = parseMetaBody(init.body);
        if (body.recipient?.comment_id) {
          sentQuickReplies.push(body.message!.quick_replies![0].payload);
          return { ok: true, status: 200, json: async () => ({ message_id: "hook_fg_1" }) } as Response;
        }
        linkSendCount++;
        return { ok: true, status: 200, json: async () => ({ message_id: "link_fg_1" }) } as Response;
      }
      throw new Error(`Unexpected fetch: ${urlStr}`);
    });

    await drainAutomationJobsForExecution(executionId);

    const afterHook = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    expect(afterHook?.status).toBe("PARTIAL");
    expect(afterHook?.conversationState).toBe("AWAITING_TAP");

    const tapBody = buildQuickReplyWebhook({
      igUserId,
      senderId: commenterId,
      mid: `m_tap_fg_${Date.now()}`,
      payload: sentQuickReplies[0],
      title: "I've followed!",
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(tapBody))
      .send(tapBody)
      .expect(200);

    await dispatchPendingOutboxEvents();
    const followJobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    const followJob = followJobs.find((j) => j.data.executionId === executionId);
    await processFollowCheckJob(followJob! as never);

    expect(linkSendCount).toBe(1);
    const finalExec = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    expect(finalExec?.status).toBe("COMPLETED");
    expect(finalExec?.followCheckStatus).toBe("SUCCESS");
    expect(finalExec?.conversationState).toBe("COMPLETED");
  });

  it("Scenario 3: Not following sends fallback and does not deliver link", async () => {
    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Not Following Gate",
        mediaId: "media_nf_1",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Check DM!",
        dmMessageText: "Follow to unlock",
        dmLink: "https://replyza.buzz/secret-link",
        followRequired: true,
        followFallbackText: "Please follow first!",
        status: "ACTIVE",
      },
    });
    const wh = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_nf_${Date.now()}`,
        mediaId: "media_nf_1",
        commenterInstagramId: commenterId,
        commentText: "LINK",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        webhookEventId: wh.id,
        commenterIgsid: commenterId,
        status: "PARTIAL",
        publicReplyStatus: "SUCCESS",
        privateReplyStatus: "SUCCESS",
        conversationState: "AWAITING_TAP",
        followCheckStatus: "PENDING",
        followCheckSentAt: new Date(),
      },
    });

    const sentBodies: string[] = [];
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: commenterId, is_user_follow_business: false }),
        } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        sentBodies.push(parseMetaBody(init.body).message!.text!);
        return { ok: true, status: 200, json: async () => ({ message_id: "fallback_1" }) } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await processFollowCheckJob({
      id: "fc-nf",
      data: { executionId: exec.id, igsid: commenterId, instagramUserId: igUserId },
    } as never);

    expect(sentBodies).toEqual(["Please follow first!"]);
    const updated = await prisma.automationExecution.findUnique({
      where: { id: exec.id },
      include: { deliveryActions: true },
    });
    expect(updated?.conversationState).toBe("AWAITING_FOLLOW");
    expect(updated?.followCheckRetryCount).toBe(1);
    expect(updated?.deliveryActions.find((a) => a.actionType === "LINK_DM")).toBeUndefined();
  });

  it("Scenario 4 & 5: Duplicate webhook and concurrent quick replies send at most 1 link DM", async () => {
    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Dedupe & Concurrency",
        mediaId: "media_dedupe_1",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Check DM!",
        dmMessageText: "Tap below",
        dmLink: "https://replyza.buzz/once",
        deliveryMode: "BUTTON",
        followRequired: false,
        status: "ACTIVE",
      },
    });
    const wh = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_dedupe_${Date.now()}`,
        mediaId: "media_dedupe_1",
        commenterInstagramId: commenterId,
        commentText: "LINK",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        webhookEventId: wh.id,
        commenterIgsid: commenterId,
        status: "PARTIAL",
        publicReplyStatus: "SUCCESS",
        privateReplyStatus: "SUCCESS",
        conversationState: "AWAITING_TAP",
        followCheckStatus: "PENDING",
        followCheckSentAt: new Date(),
      },
    });

    const mid = `m_dup_${Date.now()}`;
    const tapBody = buildQuickReplyWebhook({
      igUserId,
      senderId: commenterId,
      mid,
      payload: signFollowCheckPayload(exec.id, SESSION_SECRET),
    });

    // Send duplicate webhook twice
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(tapBody))
      .send(tapBody)
      .expect(200);
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(tapBody))
      .send(tapBody)
      .expect(200);

    const msgEvents = await prisma.messagingWebhookEvent.count({
      where: { instagramAccountId: accountId, providerEventId: mid },
    });
    expect(msgEvents).toBe(1);

    let sendCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      sendCount++;
      await new Promise((r) => setTimeout(r, 30));
      return { ok: true, status: 200, json: async () => ({ message_id: `link_${sendCount}` }) } as Response;
    });

    await Promise.all([
      processFollowCheckJob({
        id: "fc-c1",
        data: { executionId: exec.id, igsid: commenterId, instagramUserId: igUserId, providerEventId: mid },
      } as never),
      processFollowCheckJob({
        id: "fc-c2",
        data: { executionId: exec.id, igsid: commenterId, instagramUserId: igUserId, providerEventId: mid },
      } as never),
    ]);

    expect(sendCount).toBe(1);
  });

  it("Scenario 6: Immediate DIRECT DM automation completes without button tap", async () => {
    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Direct DM",
        mediaId: "media_direct_1",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Sent!",
        dmMessageText: "Here is your direct link:",
        dmLink: "https://replyza.buzz/direct",
        deliveryMode: "DIRECT",
        followRequired: false,
        status: "ACTIVE",
      },
    });

    const commentBody = buildCommentWebhook({
      igUserId,
      commentId: `c_direct_${Date.now()}`,
      mediaId: "media_direct_1",
      commenterId,
      username: "fan_direct",
      text: "LINK",
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(commentBody))
      .send(commentBody)
      .expect(200);

    const exec = await prisma.automationExecution.findFirst({
      where: { automationId: automation.id },
    });
    await dispatchPendingOutboxEvents();

    const sentDms: string[] = [];
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("/replies")) {
        return { ok: true, status: 200, json: async () => ({ id: "pub_dir_1" }) } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        sentDms.push(parseMetaBody(init.body).message!.text!);
        return { ok: true, status: 200, json: async () => ({ message_id: "dm_dir_1" }) } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await drainAutomationJobsForExecution(exec!.id);

    expect(sentDms).toHaveLength(1);
    expect(sentDms[0]).toContain("https://replyza.buzz/direct");
    const finalExec = await prisma.automationExecution.findUnique({ where: { id: exec!.id } });
    expect(finalExec?.status).toBe("COMPLETED");
    expect(finalExec?.conversationState).toBe("COMPLETED");
    expect(finalExec?.completedAt).not.toBeNull();
  });

  it("Scenario 7: Transient 429 retries and uncertain 504 marks NEEDS_REVIEW without duplicate send", async () => {
    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Failure & NeedsReview",
        mediaId: "media_fail_1",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Check DM!",
        dmMessageText: "Tap below",
        dmLink: "https://replyza.buzz/fail-safe",
        deliveryMode: "BUTTON",
        followRequired: false,
        status: "ACTIVE",
      },
    });
    const wh = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_fail_${Date.now()}`,
        mediaId: "media_fail_1",
        commenterInstagramId: commenterId,
        commentText: "LINK",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        webhookEventId: wh.id,
        commenterIgsid: commenterId,
        status: "PARTIAL",
        publicReplyStatus: "SUCCESS",
        privateReplyStatus: "SUCCESS",
        conversationState: "AWAITING_TAP",
        followCheckStatus: "PENDING",
        followCheckSentAt: new Date(),
      },
    });

    // 1. Transient 429 -> throws for BullMQ retry, LINK_DM reset to PENDING
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Rate limit", code: 4 } }),
    } as Response);

    await expect(
      processFollowCheckJob({
        id: "fc-429",
        data: { executionId: exec.id, igsid: commenterId, instagramUserId: igUserId },
      } as never)
    ).rejects.toThrow();

    const after429 = await prisma.automationExecution.findUnique({
      where: { id: exec.id },
      include: { deliveryActions: true },
    });
    expect(after429?.followCheckStatus).toBe("RETRY_PENDING");
    expect(after429?.deliveryActions.find((a) => a.actionType === "LINK_DM")?.status).toBe("PENDING");

    // 2. Ambiguous 504 -> marks NEEDS_REVIEW and blocks subsequent resend
    let postCalls = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      postCalls++;
      return {
        ok: false,
        status: 504,
        json: async () => ({ error: { message: "Gateway timeout" } }),
      } as Response;
    });

    await processFollowCheckJob({
      id: "fc-504",
      data: { executionId: exec.id, igsid: commenterId, instagramUserId: igUserId },
    } as never);

    const after504 = await prisma.automationExecution.findUnique({
      where: { id: exec.id },
      include: { deliveryActions: true },
    });
    expect(after504?.followCheckStatus).toBe("UNKNOWN");
    expect(after504?.deliveryActions.find((a) => a.actionType === "LINK_DM")?.status).toBe("NEEDS_REVIEW");

    await processFollowCheckJob({
      id: "fc-after-504",
      data: { executionId: exec.id, igsid: commenterId, instagramUserId: igUserId },
    } as never);
    expect(postCalls).toBe(1);
  });

  it("Scenario 8: Expired 24h messaging window does not send DM and sets EXPIRED_WINDOW", async () => {
    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Expired Window",
        mediaId: "media_exp_1",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Check DM!",
        dmMessageText: "Tap below",
        dmLink: "https://replyza.buzz/expired",
        deliveryMode: "BUTTON",
        followRequired: false,
        status: "ACTIVE",
      },
    });
    const wh = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_exp_${Date.now()}`,
        mediaId: "media_exp_1",
        commenterInstagramId: commenterId,
        commentText: "LINK",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        webhookEventId: wh.id,
        commenterIgsid: commenterId,
        status: "PARTIAL",
        publicReplyStatus: "SUCCESS",
        privateReplyStatus: "SUCCESS",
        conversationState: "AWAITING_TAP",
        followCheckStatus: "PENDING",
        followCheckSentAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    });

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    await processFollowCheckJob({
      id: "fc-exp",
      data: { executionId: exec.id, igsid: commenterId, instagramUserId: igUserId },
    } as never);

    expect(fetchSpy).not.toHaveBeenCalled();
    const updated = await prisma.automationExecution.findUnique({ where: { id: exec.id } });
    expect(updated?.conversationState).toBe("EXPIRED_WINDOW");
    expect(updated?.followCheckStatus).toBe("FAILED");
  });

  it("Scenario 9: Invalid quick-reply signature is rejected safely", async () => {
    const badBody = buildQuickReplyWebhook({
      igUserId,
      senderId: commenterId,
      mid: `m_bad_sig_${Date.now()}`,
      payload: `FOLLOW_CHECK:00000000-0000-4000-8000-000000000001.deadbeefdeadbeefdeadbeefdeadbeef`,
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(badBody))
      .send(badBody)
      .expect(200);

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(jobs).toHaveLength(0);
  });

  it("Regression: Previously stuck execution (status=COMPLETED, state=AWAITING_TAP) still delivers link once", async () => {
    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Stuck Recovery",
        mediaId: "media_stuck_1",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Check DM!",
        dmMessageText: "Tap below",
        dmLink: "https://replyza.buzz/recovered",
        deliveryMode: "BUTTON",
        followRequired: false,
        status: "ACTIVE",
      },
    });
    const wh = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_stuck_${Date.now()}`,
        mediaId: "media_stuck_1",
        commenterInstagramId: commenterId,
        commentText: "LINK",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        webhookEventId: wh.id,
        commenterIgsid: commenterId,
        status: "COMPLETED",
        publicReplyStatus: "SUCCESS",
        privateReplyStatus: "SUCCESS",
        conversationState: "AWAITING_TAP",
        followCheckStatus: "PENDING",
        followCheckSentAt: new Date(),
      },
    });

    let sent = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      sent++;
      return { ok: true, status: 200, json: async () => ({ message_id: "link_rec_1" }) } as Response;
    });

    await processFollowCheckJob({
      id: "fc-rec",
      data: { executionId: exec.id, igsid: commenterId, instagramUserId: igUserId },
    } as never);

    expect(sent).toBe(1);
    const updated = await prisma.automationExecution.findUnique({ where: { id: exec.id } });
    expect(updated?.conversationState).toBe("COMPLETED");
    expect(updated?.followCheckStatus).toBe("SUCCESS");
  });
});
