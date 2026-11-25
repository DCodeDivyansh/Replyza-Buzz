import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";
import { signFollowCheckPayload } from "@replyza/shared";
import { features } from "../../apps/api/src/config/features";
import { followCheckQueue } from "../../apps/api/src/queues/follow-check.queue";
import { processFollowCheckJob } from "../../apps/worker/src/processors/follow-check.processor";

const APP_SECRET = process.env.META_APP_SECRET!;

function signWebhook(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

describe("Follow-Verification Root Cause Reproductions", () => {
  let accountId: string;
  let automationId: string;
  let executionId: string;
  const igUserId = "ig_biz_repro_1";
  const commenterId = "igsid_repro_user_1";
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanDatabase();
    await followCheckQueue.drain();

    const user = await prisma.user.create({
      data: {
        email: `repro_${Date.now()}_${Math.random()}@replyza.buzz`,
        passwordHash: "$argon2id$mock",
      },
    });

    const account = await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: igUserId,
        username: "repro_brand",
        encryptedAccessToken: encryptToken("EAAB_repro_token"),
        status: "ACTIVE",
      },
    });
    accountId = account.id;

    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Repro Follow Gate",
        mediaId: "media_repro_1",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Check DM",
        dmMessageText: "Follow to unlock",
        dmLink: "https://replyza.buzz/product",
        followRequired: true,
        followInstructionText: "Follow @repro_brand and tap below!",
        followSuccessText: "Thanks! Here is your link:",
        followFallbackText: "Please follow @repro_brand first!",
        status: "ACTIVE",
      },
    });
    automationId = auto.id;

    const wh = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: `c_repro_${Date.now()}`,
        mediaId: "media_repro_1",
        commenterInstagramId: commenterId,
        commenterUsername: "repro_fan",
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
    (features as { FOLLOW_CHECK_SIGNED_TOKENS: boolean }).FOLLOW_CHECK_SIGNED_TOKENS = true;
  });

  it("R1: Signed quick-reply payload still resolves execution when FOLLOW_CHECK_SIGNED_TOKENS=false (production default)", async () => {
    (features as { FOLLOW_CHECK_SIGNED_TOKENS: boolean }).FOLLOW_CHECK_SIGNED_TOKENS = false;
    const signedPayload = signFollowCheckPayload(executionId, process.env.SESSION_SECRET!);

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
                mid: `m_r1_${Date.now()}`,
                text: "I've followed!",
                quick_reply: { payload: signedPayload },
              },
            },
          ],
        },
      ],
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(body))
      .send(body)
      .expect(200);

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(jobs.some((j) => j.data.executionId === executionId)).toBe(true);
  });

  it("R2: User retry after UNKNOWN verification failure still verifies and delivers link DM", async () => {
    // First attempt: API returns 500 -> UNKNOWN
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: commenterId, name: "Fan" }), // missing field -> UNSUPPORTED/UNKNOWN
        } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ message_id: "m_neutral" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    // Force UNKNOWN outcome specifically via non-standard Graph error (not transient, not permission)
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: "Temporarily unable to read profile", code: 2 } }),
        } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ message_id: "m_neutral" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await processFollowCheckJob({
      data: { executionId, igsid: commenterId, instagramUserId: igUserId },
    } as any);

    const midState = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    expect(midState?.followCheckStatus).toBe("UNKNOWN");

    // Second attempt: user taps/types again and Meta now returns is_user_follow_business: true
    let sentLink = "";
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("is_user_follow_business")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: commenterId, is_user_follow_business: true }),
        } as Response;
      }
      if (url.toString().includes("/messages") && init?.method === "POST") {
        const params = new URLSearchParams(init.body as string);
        sentLink = JSON.parse(params.get("message") || "{}").text || "";
        return { ok: true, status: 200, json: async () => ({ message_id: "m_link_ok" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    await processFollowCheckJob({
      data: { executionId, igsid: commenterId, instagramUserId: igUserId },
    } as any);

    expect(sentLink).toContain("https://replyza.buzz/product");
  });

  it("R3a: Typed text does NOT match an execution whose 24-hour window has expired", async () => {
    const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { createdAt: expiredDate, followCheckSentAt: expiredDate },
    });

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
              message: { mid: `m_r3a_${Date.now()}`, text: "I've followed" },
            },
          ],
        },
      ],
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(body))
      .send(body)
      .expect(200);

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(jobs.some((j) => j.data.executionId === executionId)).toBe(false);
  });

  it("R3b: Typed text matches an open execution even if conversationState is TAPPED with pending followCheckStatus", async () => {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { conversationState: "TAPPED", followCheckStatus: "PENDING" },
    });

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
              message: { mid: `m_r3b_${Date.now()}`, text: "done" },
            },
          ],
        },
      ],
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(body))
      .send(body)
      .expect(200);

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(jobs.some((j) => j.data.executionId === executionId)).toBe(true);
  });

  it("R4: After 3 NOT_FOLLOWING attempts (conversationState=FAILED), a 4th tap does not send another DM", async () => {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        followCheckStatus: "FAILED",
        conversationState: "FAILED",
        followCheckRetryCount: 3,
      },
    });

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    await processFollowCheckJob({
      data: { executionId, igsid: commenterId, instagramUserId: igUserId },
    } as any);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
