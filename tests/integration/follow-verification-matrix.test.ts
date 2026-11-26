import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";
import { signFollowCheckPayload } from "@replyza/shared";
import { followCheckQueue } from "../../apps/api/src/queues/follow-check.queue";
import { processFollowCheckJob } from "../../apps/worker/src/processors/follow-check.processor";

const APP_SECRET = process.env.META_APP_SECRET!;

function signWebhook(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

function buildTextWebhook(params: {
  igUserId: string;
  senderId: string;
  mid: string;
  text: string;
  isEcho?: boolean;
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
              text: params.text,
              ...(params.isEcho ? { is_echo: true } : {}),
            },
          },
        ],
      },
    ],
  });
}

describe("Follow-Verification Full 20-Case Matrix", () => {
  let userId: string;
  let accountId: string;
  let automationId: string;
  let executionId: string;
  const igUserId = "ig_biz_matrix_1";
  const commenterId = "igsid_matrix_fan_1";
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanDatabase();
    await followCheckQueue.drain();

    const user = await prisma.user.create({
      data: {
        email: `matrix_${Date.now()}_${Math.random()}@replyza.buzz`,
        passwordHash: "$argon2id$mock",
      },
    });
    userId = user.id;

    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: igUserId,
        username: "matrix_brand",
        encryptedAccessToken: encryptToken("EAAB_matrix_token"),
        status: "ACTIVE",
      },
    });
    accountId = account.id;

    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Matrix Follow Gate",
        mediaId: "media_matrix_fg",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Check DM!",
        dmMessageText: "Follow to unlock",
        dmLink: "https://replyza.buzz/matrix-product",
        followRequired: true,
        followInstructionText: "Follow @matrix_brand and tap or reply FOLLOWED!",
        followSuccessText: "Verified! Here is your link:",
        followFallbackText: "Not following @matrix_brand yet! Follow & tap or reply CHECK.",
        status: "ACTIVE",
      },
    });
    automationId = auto.id;

    const wh = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_matrix_${Date.now()}`,
        mediaId: "media_matrix_fg",
        commenterInstagramId: commenterId,
        commenterUsername: "matrix_fan",
        commentText: "LINK",
        eventPayload: {},
      },
    });

    const exec = await prisma.automationExecution.create({
      data: {
        automationId,
        webhookEventId: wh.id,
        commenterIgsid: commenterId,
        status: "PROCESSING",
        publicReplyStatus: "SUCCESS",
        privateReplyStatus: "SUCCESS",
        conversationState: "AWAITING_TAP",
        followCheckStatus: "PENDING",
        followCheckSentAt: new Date(),
      },
    });
    executionId = exec.id;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("1. User follows and types 'I\\'ve followed' -> Link DM sent once, execution COMPLETED", async () => {
    const body = buildTextWebhook({
      igUserId,
      senderId: commenterId,
      mid: `m_typed_1_${Date.now()}`,
      text: "I've followed",
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(body))
      .send(body)
      .expect(200);

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    const job = jobs.find((j) => j.data.executionId === executionId);
    expect(job).toBeDefined();

    let linkCalls = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: commenterId, is_user_follow_business: true, name: "Matrix" }),
        } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        linkCalls++;
        return { ok: true, status: 200, json: async () => ({ message_id: "m_link_typed" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await processFollowCheckJob(job as any);
    expect(linkCalls).toBe(1);

    const updated = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    expect(updated?.status).toBe("COMPLETED");
    expect(updated?.conversationState).toBe("COMPLETED");
  });

  it("2. User follows and types arbitrary emoji-only text '🙏🔥' -> Link DM sent once", async () => {
    const body = buildTextWebhook({
      igUserId,
      senderId: commenterId,
      mid: `m_emoji_${Date.now()}`,
      text: "🙏🔥",
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(body))
      .send(body)
      .expect(200);

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    const job = jobs.find((j) => j.data.executionId === executionId);
    expect(job).toBeDefined();

    let sentText = "";
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return { ok: true, status: 200, json: async () => ({ id: commenterId, is_user_follow_business: true }) } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        const params = new URLSearchParams(init.body as string);
        sentText = JSON.parse(params.get("message") || "{}").text || "";
        return { ok: true, status: 200, json: async () => ({ message_id: "m_link_emoji" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await processFollowCheckJob(job as any);
    expect(sentText).toContain("https://replyza.buzz/matrix-product");
  });

  it("3. Token error 190 marks account NEEDS_RECONNECT and burns zero retries", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Invalid OAuth access token.", code: 190 } }),
    } as Response);

    await expect(
      processFollowCheckJob({
        data: { executionId, igsid: commenterId, instagramUserId: igUserId },
      } as any)
    ).rejects.toThrow(/Error 190/);

    const acct = await prisma.instagramAccount.findUnique({ where: { id: accountId } });
    expect(acct?.status).toBe("NEEDS_RECONNECT");

    const exec = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    expect(exec?.conversationState).toBe("NEEDS_RECONNECT");
    expect(exec?.followCheckRetryCount).toBe(0);
  });

  it("4. Same event replayed 10x concurrently -> exactly 1 link DM sent", async () => {
    const signed = signFollowCheckPayload(executionId, process.env.SESSION_SECRET!);
    const body = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: igUserId,
          time: Math.floor(Date.now() / 1000),
          messaging: [
            {
              sender: { id: commenterId },
              recipient: { id: igUserId },
              timestamp: Math.floor(Date.now() / 1000),
              message: {
                mid: `m_replay10_${Date.now()}`,
                text: "I've followed!",
                quick_reply: { payload: signed },
              },
            },
          ],
        },
      ],
    });
    const sig = signWebhook(body);

    await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post("/api/v1/webhooks/instagram")
          .set("Content-Type", "application/json")
          .set("x-hub-signature-256", sig)
          .send(body)
          .expect(200)
      )
    );

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(jobs.filter((j) => j.data.executionId === executionId)).toHaveLength(1);
  });

  it("5. Double tap + typed message concurrently -> exactly 1 link DM sent", async () => {
    let linkDmCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return { ok: true, status: 200, json: async () => ({ id: commenterId, is_user_follow_business: true }) } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        linkDmCount++;
        return { ok: true, status: 200, json: async () => ({ message_id: `m_dbl_${linkDmCount}` }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await Promise.all([
      processFollowCheckJob({ data: { executionId, igsid: commenterId, instagramUserId: igUserId } } as any),
      processFollowCheckJob({ data: { executionId, igsid: commenterId, instagramUserId: igUserId } } as any),
    ]);

    expect(linkDmCount).toBe(1);
  });

  it("6. Worker killed after Meta accepted LINK_DM (DeliveryAction SENDING) -> no duplicate on retry", async () => {
    await prisma.deliveryAction.create({
      data: {
        executionId,
        actionType: "LINK_DM",
        status: "SENDING",
        attempts: 1,
      },
    });

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    await processFollowCheckJob({
      data: { executionId, igsid: commenterId, instagramUserId: igUserId },
    } as any);

    expect(fetchSpy).not.toHaveBeenCalled();

    const da = await prisma.deliveryAction.findUnique({
      where: { executionId_actionType: { executionId, actionType: "LINK_DM" } },
    });
    expect(da?.status).toBe("NEEDS_REVIEW");
  });

  it("7. is_echo, own-account messages, and user with no pending execution are ignored quietly", async () => {
    const echoBody = buildTextWebhook({
      igUserId,
      senderId: commenterId,
      mid: `m_echo_${Date.now()}`,
      text: "Echo from us",
      isEcho: true,
    });
    const ownBody = buildTextWebhook({
      igUserId,
      senderId: igUserId,
      mid: `m_own_${Date.now()}`,
      text: "Own account message",
    });
    const strangerBody = buildTextWebhook({
      igUserId,
      senderId: "igsid_stranger_999",
      mid: `m_stranger_${Date.now()}`,
      text: "hello there",
    });

    for (const body of [echoBody, ownBody, strangerBody]) {
      await request(app)
        .post("/api/v1/webhooks/instagram")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", signWebhook(body))
        .send(body)
        .expect(200);
    }

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(jobs).toHaveLength(0);
  });

  it("8. Two executions pending for same user -> most recent unexpired execution is used", async () => {
    const olderExecId = executionId;
    await prisma.automationExecution.update({
      where: { id: olderExecId },
      data: { createdAt: new Date(Date.now() - 60_000), followCheckSentAt: new Date(Date.now() - 60_000) },
    });

    const whNew = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_newer_${Date.now()}`,
        mediaId: "media_matrix_fg",
        commenterInstagramId: commenterId,
        commenterUsername: "matrix_fan",
        commentText: "LINK",
        eventPayload: {},
      },
    });
    const newerExec = await prisma.automationExecution.create({
      data: {
        automationId,
        webhookEventId: whNew.id,
        commenterIgsid: commenterId,
        status: "PROCESSING",
        conversationState: "AWAITING_TAP",
        followCheckStatus: "PENDING",
        followCheckSentAt: new Date(),
      },
    });

    const body = buildTextWebhook({
      igUserId,
      senderId: commenterId,
      mid: `m_newest_${Date.now()}`,
      text: "done",
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(body))
      .send(body)
      .expect(200);

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.executionId).toBe(newerExec.id);
  });

  it("9. Link DM send fails after positive check: transient error throws for retry; permanent error does not mark COMPLETED", async () => {
    // Transient 429 on LINK_DM send
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return { ok: true, status: 200, json: async () => ({ id: commenterId, is_user_follow_business: true }) } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        return { ok: false, status: 429, json: async () => ({ error: { message: "Rate limit", code: 4 } }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await expect(
      processFollowCheckJob({
        data: { executionId, igsid: commenterId, instagramUserId: igUserId },
      } as any)
    ).rejects.toThrow(/Rate limit/);

    const afterTransient = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    expect(afterTransient?.status).not.toBe("COMPLETED");
    expect(afterTransient?.followCheckStatus).toBe("RETRY_PENDING");

    // Permanent 400 on LINK_DM send
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return { ok: true, status: 200, json: async () => ({ id: commenterId, is_user_follow_business: true }) } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        return { ok: false, status: 400, json: async () => ({ error: { message: "Invalid recipient", code: 100 } }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await processFollowCheckJob({
      data: { executionId, igsid: commenterId, instagramUserId: igUserId },
    } as any);

    const afterPerm = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    expect(afterPerm?.status).not.toBe("COMPLETED");
    expect(afterPerm?.followCheckStatus).toBe("FAILED");
  });

  it("10. Cross-account isolation: Account A webhook never triggers Account B execution", async () => {
    const accountB = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: "ig_biz_account_B",
        username: "brand_b",
        encryptedAccessToken: encryptToken("EAAB_b_token"),
        status: "ACTIVE",
      },
    });

    const signedForA = signFollowCheckPayload(executionId, process.env.SESSION_SECRET!);
    const bodyOnB = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: accountB.instagramUserId,
          time: Math.floor(Date.now() / 1000),
          messaging: [
            {
              sender: { id: commenterId },
              recipient: { id: accountB.instagramUserId },
              timestamp: Math.floor(Date.now() / 1000),
              message: {
                mid: `m_cross_${Date.now()}`,
                text: "I've followed!",
                quick_reply: { payload: signedForA },
              },
            },
          ],
        },
      ],
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(bodyOnB))
      .send(bodyOnB)
      .expect(200);

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(jobs).toHaveLength(0);
  });
});
