import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";
import { automationQueue } from "../../apps/api/src/queues/automation.queue";
import { scheduleBindingQueue } from "../../apps/api/src/queues/schedule-binding.queue";
import { processScheduleBindingJob } from "../../apps/worker/src/processors/schedule-binding.processor";

const APP_SECRET = process.env.META_APP_SECRET!;

function signWebhook(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

function buildCommentWebhook(params: {
  igUserId: string;
  commentId: string;
  mediaId: string;
  commenterId: string;
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
              from: { id: params.commenterId, username: "fan_sched" },
              media: { id: params.mediaId },
            },
          },
        ],
      },
    ],
  });
}

describe("Scheduled & Lazy-Binding Automations Integration", () => {
  let userId: string;
  let accountId: string;
  let authHeader: string;
  const igUserId = "ig_biz_sched_1";
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanDatabase();
    await automationQueue.obliterate({ force: true });
    await scheduleBindingQueue.obliterate({ force: true });

    const email = `sched_${Date.now()}_${Math.random()}@replyza.buzz`;
    const password = "StrongPassword123!";
    const regRes = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, confirmPassword: password })
      .expect(201);
    userId = regRes.body.data.user.id;

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    authHeader = `Bearer ${loginRes.body.data.accessToken}`;

    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: igUserId,
        username: "sched_brand",
        encryptedAccessToken: encryptToken("EAAB_sched_token"),
        status: "ACTIVE",
      },
    });
    accountId = account.id;
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await automationQueue.obliterate({ force: true });
    await scheduleBindingQueue.obliterate({ force: true });
  });

  it("1. CRUD: creates, reschedules, activates (SCHEDULED), pauses, and deletes a scheduled automation", async () => {
    const activateAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const createRes = await request(app)
      .post("/api/v1/automations")
      .set("Authorization", authHeader)
      .send({
        instagramAccountId: accountId,
        name: "Tomorrow Drop",
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: activateAt,
        bindingWindowMinutes: 45,
        mediaTypeFilter: "REELS",
        captionKeywordFilter: "#drop",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Sent!",
        dmMessageText: "Here is your link!",
        dmLink: "https://replyza.buzz/drop",
      })
      .expect(201);

    const autoId = createRes.body.data.id;
    expect(createRes.body.data.targetMode).toBe("SCHEDULED_TIME");
    expect(createRes.body.data.mediaId).toBeNull();
    expect(createRes.body.data.status).toBe("DRAFT");

    // Activate -> transitions to SCHEDULED and enqueues delayed poll job
    const statusRes = await request(app)
      .patch(`/api/v1/automations/${autoId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "ACTIVE" })
      .expect(200);

    expect(statusRes.body.data.status).toBe("SCHEDULED");
    const delayedJobs = await scheduleBindingQueue.getJobs(["delayed", "waiting"]);
    expect(delayedJobs.some((j) => j.data.automationId === autoId)).toBe(true);

    // Reschedule
    const newActivateAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await request(app)
      .patch(`/api/v1/automations/${autoId}`)
      .set("Authorization", authHeader)
      .send({ scheduledActivateAt: newActivateAt, bindingWindowMinutes: 60 })
      .expect(200);

    // Pause -> cancels poll job
    const pauseRes = await request(app)
      .patch(`/api/v1/automations/${autoId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "PAUSED" })
      .expect(200);
    expect(pauseRes.body.data.status).toBe("PAUSED");

    // Delete
    await request(app)
      .delete(`/api/v1/automations/${autoId}`)
      .set("Authorization", authHeader)
      .expect(200);
  });

  it("2. Poller binding path: polls /media and transitions SCHEDULED -> ACTIVE when matching post appears", async () => {
    const activateAt = new Date(Date.now() - 60_000);
    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Poller Bind",
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: activateAt,
        bindingWindowEndAt: new Date(Date.now() + 30 * 60_000),
        mediaTypeFilter: "REELS",
        captionKeywordFilter: "#launch",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Check DM!",
        dmMessageText: "Here is your link!",
        dmLink: "https://replyza.buzz/poller",
        status: "SCHEDULED",
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: "media_wrong_type",
            media_type: "IMAGE",
            media_product_type: "FEED",
            timestamp: new Date().toISOString(),
            caption: "#launch photo",
          },
          {
            id: "media_matched_reel",
            media_type: "VIDEO",
            media_product_type: "REELS",
            permalink: "https://instagram.com/reel/abc",
            timestamp: new Date().toISOString(),
            caption: "Exciting #launch reel!",
          },
        ],
      }),
    } as Response);

    const outcome = await processScheduleBindingJob({
      id: "sb-1",
      data: { automationId: auto.id, instagramAccountId: accountId, pollCount: 0 },
    } as never);

    expect(outcome).toBe("BOUND");
    const updated = await prisma.automation.findUnique({ where: { id: auto.id } });
    expect(updated?.status).toBe("ACTIVE");
    expect(updated?.mediaId).toBe("media_matched_reel");
    expect(updated?.mediaType).toBe("REELS");
  });

  it("3. Webhook lazy-binding path: first comment binds SCHEDULED -> ACTIVE immediately and queues DM", async () => {
    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Lazy Bind",
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: new Date(Date.now() - 60_000),
        bindingWindowEndAt: new Date(Date.now() + 30 * 60_000),
        mediaTypeFilter: "ANY",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Sent!",
        dmMessageText: "Instant DM!",
        dmLink: "https://replyza.buzz/lazy",
        status: "SCHEDULED",
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "media_first_comment",
        media_type: "VIDEO",
        media_product_type: "REELS",
        permalink: "https://instagram.com/reel/first",
        timestamp: new Date().toISOString(),
        caption: "Brand new reel",
      }),
    } as Response);

    const body = buildCommentWebhook({
      igUserId,
      commentId: `c_lazy_${Date.now()}`,
      mediaId: "media_first_comment",
      commenterId: "fan_1",
      text: "LINK please",
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(body))
      .send(body)
      .expect(200);

    const updated = await prisma.automation.findUnique({ where: { id: auto.id } });
    expect(updated?.status).toBe("ACTIVE");
    expect(updated?.mediaId).toBe("media_first_comment");

    const executions = await prisma.automationExecution.findMany({
      where: { automationId: auto.id },
    });
    expect(executions).toHaveLength(1);
  });

  it("4. Edge cases: caption mismatch is ignored, expired window transitions SCHEDULED -> EXPIRED, and concurrent poller+webhook binds once", async () => {
    // Expired window
    const expiredAuto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Expired Auto",
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: new Date(Date.now() - 60 * 60_000),
        bindingWindowEndAt: new Date(Date.now() - 5 * 60_000),
        mediaTypeFilter: "ANY",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Sent!",
        dmMessageText: "DM!",
        status: "SCHEDULED",
      },
    });

    const expOutcome = await processScheduleBindingJob({
      id: "sb-exp",
      data: { automationId: expiredAuto.id, instagramAccountId: accountId },
    } as never);
    expect(expOutcome).toBe("EXPIRED");
    const expAfter = await prisma.automation.findUnique({ where: { id: expiredAuto.id } });
    expect(expAfter?.status).toBe("EXPIRED");

    // Caption mismatch ignored by lazy binding
    const filterAuto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Caption Filter",
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: new Date(Date.now() - 60_000),
        bindingWindowEndAt: new Date(Date.now() + 30 * 60_000),
        mediaTypeFilter: "ANY",
        captionKeywordFilter: "#viponly",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Sent!",
        dmMessageText: "DM!",
        status: "SCHEDULED",
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "media_no_tag",
        media_type: "IMAGE",
        media_product_type: "FEED",
        timestamp: new Date().toISOString(),
        caption: "Just a normal post",
      }),
    } as Response);

    const mismatchBody = buildCommentWebhook({
      igUserId,
      commentId: `c_mis_${Date.now()}`,
      mediaId: "media_no_tag",
      commenterId: "fan_2",
      text: "LINK",
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signWebhook(mismatchBody))
      .send(mismatchBody)
      .expect(200);

    const stillScheduled = await prisma.automation.findUnique({ where: { id: filterAuto.id } });
    expect(stillScheduled?.status).toBe("SCHEDULED");
    expect(stillScheduled?.mediaId).toBeNull();

    // Concurrent poller + webhook race binds exactly once and creates 1 execution
    const raceAuto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Race Auto",
        targetMode: "SCHEDULED_TIME",
        scheduledActivateAt: new Date(Date.now() - 60_000),
        bindingWindowEndAt: new Date(Date.now() + 30 * 60_000),
        mediaTypeFilter: "ANY",
        triggerType: "KEYWORD",
        keywords: ["LINK"],
        publicReplyText: "Sent!",
        dmMessageText: "DM!",
        status: "SCHEDULED",
      },
    });

    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("/media")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: "media_race_1",
                media_type: "IMAGE",
                media_product_type: "FEED",
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "media_race_1",
          media_type: "IMAGE",
          media_product_type: "FEED",
          timestamp: new Date().toISOString(),
        }),
      } as Response;
    });

    const raceBody = buildCommentWebhook({
      igUserId,
      commentId: `c_race_${Date.now()}`,
      mediaId: "media_race_1",
      commenterId: "fan_race",
      text: "LINK",
    });

    await Promise.all([
      processScheduleBindingJob({
        id: "sb-race",
        data: { automationId: raceAuto.id, instagramAccountId: accountId },
      } as never),
      request(app)
        .post("/api/v1/webhooks/instagram")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", signWebhook(raceBody))
        .send(raceBody)
        .expect(200),
    ]);

    const raceAfter = await prisma.automation.findUnique({ where: { id: raceAuto.id } });
    expect(raceAfter?.status).toBe("ACTIVE");
    expect(raceAfter?.mediaId).toBe("media_race_1");

    // ALL_POSTS (ACTIVE) and NEXT_POST (ACTIVE) can coexist on the same account
    const allPostsAuto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "All Posts Active",
        targetMode: "ALL_POSTS",
        mediaId: null,
        triggerType: "KEYWORD",
        keywords: ["ALL"],
        publicReplyText: "All!",
        dmMessageText: "All DM!",
        status: "ACTIVE",
      },
    });
    const nextPostAuto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Next Post Active",
        targetMode: "NEXT_POST",
        mediaId: null,
        triggerType: "KEYWORD",
        keywords: ["NEXT"],
        publicReplyText: "Next!",
        dmMessageText: "Next DM!",
        status: "ACTIVE",
      },
    });
    expect(allPostsAuto.status).toBe("ACTIVE");
    expect(nextPostAuto.status).toBe("ACTIVE");
  });
});
