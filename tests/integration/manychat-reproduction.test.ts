import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";
import { followCheckQueue } from "../../apps/api/src/queues/follow-check.queue";
import { processFollowCheckJob } from "../../apps/worker/src/processors/follow-check.processor";

describe("Phase 2 — Defect Reproduction Tests", () => {
  let accountId: string;
  let automationId: string;
  let executionId: string;
  const originalFetch = global.fetch;
  const APP_SECRET = process.env.META_APP_SECRET!;

  function signPayload(body: string): string {
    return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
  }

  beforeEach(async () => {
    await cleanDatabase();
    await followCheckQueue.drain();

    const user = await prisma.user.create({
      data: { email: "repro@replyza.buzz", passwordHash: "$argon2id$mock" },
    });

    const account = await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: "ig_biz_repro_1",
        username: "repro_brand",
        encryptedAccessToken: encryptToken("EAAB_repro_token"),
        status: "ACTIVE",
      },
    });
    accountId = account.id;

    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "No-Follow Button Flow",
        mediaId: "media_repro_1",
        triggerType: "ANY_COMMENT",
        keywords: [],
        publicReplyText: "Sent to DMs!",
        dmMessageText: "Here is your link:",
        dmLink: "https://replyza.buzz/vip",
        followRequired: false,
        status: "ACTIVE",
      },
    });
    automationId = auto.id;

    const event = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: "comment_repro_init",
        mediaId: "media_repro_1",
        commenterInstagramId: "fan_igsid_1",
        commenterUsername: "fan1",
        commentText: "hello",
        eventPayload: {},
      },
    });

    const exec = await prisma.automationExecution.create({
      data: {
        automationId,
        webhookEventId: event.id,
        status: "PARTIAL",
        publicReplyStatus: "SUCCESS",
        privateReplyStatus: "SUCCESS",
      },
    });
    executionId = exec.id;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("D1: ignores own-account comments to prevent self-reply loops", async () => {
    const body = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_biz_repro_1",
          changes: [
            {
              field: "comments",
              value: {
                id: "comment_own_reply_loop",
                text: "Sent to DMs!",
                media: { id: "media_repro_1" },
                from: { id: "ig_biz_repro_1", username: "repro_brand" },
              },
            },
          ],
        },
      ],
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(body))
      .send(body)
      .expect(200);

    const ownEvents = await prisma.webhookEvent.findMany({
      where: { commentId: "comment_own_reply_loop" },
    });
    expect(ownEvents).toHaveLength(0);
  });

  it("D5: rejects unsigned raw FOLLOW_CHECK:<id> messaging payloads", async () => {
    const body = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_biz_repro_1",
          messaging: [
            {
              sender: { id: "fan_igsid_1" },
              recipient: { id: "ig_biz_repro_1" },
              message: {
                mid: "mid_unsigned_forged_1",
                text: "Send me the link",
                quick_reply: { payload: `FOLLOW_CHECK:${executionId}` },
              },
            },
          ],
        },
      ],
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(body))
      .send(body)
      .expect(200);

    const jobs = await followCheckQueue.getJobs(["waiting", "active", "completed"]);
    expect(jobs).toHaveLength(0);
  });

  it("D9: ignores is_echo messaging events from our own account", async () => {
    const body = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_biz_repro_1",
          messaging: [
            {
              sender: { id: "ig_biz_repro_1" },
              recipient: { id: "fan_igsid_1" },
              message: {
                mid: "mid_echo_1",
                text: "Hey! Here is your link",
                is_echo: true,
              },
            },
          ],
        },
      ],
    });

    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(body))
      .send(body)
      .expect(200);

    const echoRows = await prisma.messagingWebhookEvent.findMany({
      where: { providerEventId: "mid_echo_1" },
    });
    expect(echoRows).toHaveLength(0);
  });

  it("D6: when followRequired=false, tapping button skips follower check and sends link DM directly", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (url.toString().includes("/messages") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ message_id: "mid_direct_link_1" }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    global.fetch = fetchSpy;

    await processFollowCheckJob({
      data: {
        executionId,
        igsid: "fan_igsid_1",
        instagramUserId: "ig_biz_repro_1",
      },
    } as never);

    // Must NOT call GET /{igsid}?fields=is_user_follow_business
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/messages");
  });
});
