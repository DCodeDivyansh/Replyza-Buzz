import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import { Worker } from "../../apps/worker/node_modules/bullmq";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";
import { automationQueue } from "../../apps/api/src/queues/automation.queue";
import { followCheckQueue } from "../../apps/api/src/queues/follow-check.queue";
import { redisConnection as workerRedis } from "../../apps/worker/src/config/redis";
import { processAutomationJob } from "../../apps/worker/src/processors/automation.processor";
import { processFollowCheckJob } from "../../apps/worker/src/processors/follow-check.processor";

const APP_SECRET = process.env.META_APP_SECRET!;

function signWebhook(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

function parseMetaBody(body: BodyInit | null | undefined): {
  recipient?: { comment_id?: string; id?: string };
  message?: { text?: string; quick_replies?: Array<{ payload: string; title: string }> };
} {
  const raw = String(body ?? "");
  if (raw.startsWith("{")) return JSON.parse(raw);
  const params = new URLSearchParams(raw);
  return {
    recipient: params.get("recipient") ? JSON.parse(params.get("recipient")!) : undefined,
    message: params.get("message") ? JSON.parse(params.get("message")!) : undefined,
  };
}

describe("Sub-Second Webhook-to-Graph-API Latency Benchmark", () => {
  let accountId: string;
  const igUserId = "ig_biz_lat_1";
  const commenterId = "igsid_lat_1";
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanDatabase();
    await automationQueue.obliterate({ force: true });
    await followCheckQueue.obliterate({ force: true });

    const user = await prisma.user.create({
      data: {
        email: `lat_${Date.now()}_${Math.random()}@replyza.buzz`,
        passwordHash: "$argon2id$mock",
      },
    });
    const account = await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: igUserId,
        username: "lat_brand",
        encryptedAccessToken: encryptToken("EAAB_lat_token"),
        status: "ACTIVE",
      },
    });
    accountId = account.id;
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await automationQueue.obliterate({ force: true });
    await followCheckQueue.obliterate({ force: true });
  });

  it("dispatches Comment -> PUBLIC_REPLY + HOOK_DM and Quick Reply -> LINK_DM in sub-second latency with live BullMQ workers", async () => {
    await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Latency Button Flow",
        mediaId: "media_lat_1",
        triggerType: "KEYWORD",
        keywords: ["FAST"],
        publicReplyText: "On it!",
        dmMessageText: "Tap below:",
        dmLink: "https://replyza.buzz/fast",
        deliveryMode: "BUTTON",
        followRequired: false,
        status: "ACTIVE",
      },
    });

    let hookPayload = "";
    let hookDispatchedAt = 0;
    let linkDispatchedAt = 0;

    let resolveHook!: () => void;
    const hookPromise = new Promise<void>((r) => (resolveHook = r));
    let resolveLink!: () => void;
    const linkPromise = new Promise<void>((r) => (resolveLink = r));

    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/replies")) {
        return { ok: true, status: 200, json: async () => ({ id: "lat_pub_1" }) } as Response;
      }
      if (urlStr.includes("/messages") && init?.method === "POST") {
        const parsed = parseMetaBody(init.body);
        if (parsed.recipient?.comment_id) {
          hookPayload = parsed.message!.quick_replies![0].payload;
          hookDispatchedAt = performance.now();
          resolveHook();
          return { ok: true, status: 200, json: async () => ({ message_id: "lat_hook_1" }) } as Response;
        }
        linkDispatchedAt = performance.now();
        resolveLink();
        return { ok: true, status: 200, json: async () => ({ message_id: "lat_link_1" }) } as Response;
      }
      throw new Error(`Unexpected fetch: ${urlStr}`);
    });

    const autoWorker = new Worker("automation-processing", processAutomationJob, {
      connection: workerRedis,
      concurrency: 10,
    });
    const fcWorker = new Worker("follow-check-processing", processFollowCheckJob, {
      connection: workerRedis,
      concurrency: 10,
    });

    try {
      await Promise.all([autoWorker.waitUntilReady(), fcWorker.waitUntilReady()]);

      const commentBody = JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: igUserId,
            time: Math.floor(Date.now() / 1000),
            changes: [
              {
                field: "comments",
                value: {
                  id: `c_lat_${Date.now()}`,
                  text: "FAST please",
                  from: { id: commenterId, username: "lat_fan" },
                  media: { id: "media_lat_1" },
                },
              },
            ],
          },
        ],
      });

      const commentStart = performance.now();
      const commentRes = await request(app)
        .post("/api/v1/webhooks/instagram")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", signWebhook(commentBody))
        .send(commentBody)
        .expect(200);
      const webhookAckMs = performance.now() - commentStart;

      await hookPromise;
      const commentToHookMs = hookDispatchedAt - commentStart;

      expect(commentRes.text).toBe("EVENT_RECEIVED");
      expect(webhookAckMs).toBeLessThan(1000);
      expect(commentToHookMs).toBeLessThan(1000);

      const tapBody = JSON.stringify({
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
                  mid: `m_lat_${Date.now()}`,
                  text: "Send me the link",
                  quick_reply: { payload: hookPayload },
                },
              },
            ],
          },
        ],
      });

      const tapStart = performance.now();
      await request(app)
        .post("/api/v1/webhooks/instagram")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", signWebhook(tapBody))
        .send(tapBody)
        .expect(200);
      const tapAckMs = performance.now() - tapStart;

      await linkPromise;
      const tapToLinkMs = linkDispatchedAt - tapStart;

      console.log(
        `[Latency Benchmark] commentAck=${webhookAckMs.toFixed(1)}ms | commentToHookDM=${commentToHookMs.toFixed(1)}ms | tapAck=${tapAckMs.toFixed(1)}ms | tapToLinkDM=${tapToLinkMs.toFixed(1)}ms`
      );

      expect(tapAckMs).toBeLessThan(1000);
      expect(tapToLinkMs).toBeLessThan(1000);
    } finally {
      await autoWorker.close();
      await fcWorker.close();
    }
  });
});
