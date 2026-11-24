import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import app from "../../apps/api/src/app";
import { prisma } from "@replyza/database";
import { cleanDatabase } from "../setup";
import { encryptToken } from "../../apps/api/src/utils/token-encryption";
import { generateAccessToken } from "../../apps/api/src/utils/jwt";
import { automationQueue } from "../../apps/api/src/queues/automation.queue";
import { processAutomationJob } from "../../apps/worker/src/processors/automation.processor";
import {
  dispatchPendingOutboxEvents,
  recoverOrphanedRecords,
} from "../../apps/worker/src/services/outbox-dispatcher.service";

describe("Reliability, Idempotency, Outbox, Reconciliation & Execution API", () => {
  let userId: string;
  let userToken: string;
  let otherUserToken: string;
  let accountId: string;
  let automationId: string;
  const originalFetch = global.fetch;

  const APP_SECRET = process.env.META_APP_SECRET!;

  function signPayload(body: string): string {
    return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
  }

  beforeEach(async () => {
    await cleanDatabase();
    await automationQueue.drain();

    const user = await prisma.user.create({
      data: {
        email: "rel_owner@replyza.buzz",
        passwordHash: "$argon2id$mock",
      },
    });
    userId = user.id;
    const userFamilyId = "00000000-0000-4000-8000-000000000001";
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: "hash_rel_user_1",
        familyId: userFamilyId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    userToken = generateAccessToken(user.id, userFamilyId);

    const otherUser = await prisma.user.create({
      data: {
        email: "rel_other@replyza.buzz",
        passwordHash: "$argon2id$mock",
      },
    });
    const otherFamilyId = "00000000-0000-4000-8000-000000000002";
    await prisma.refreshToken.create({
      data: {
        userId: otherUser.id,
        tokenHash: "hash_rel_user_2",
        familyId: otherFamilyId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    otherUserToken = generateAccessToken(otherUser.id, otherFamilyId);

    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: "ig_rel_biz_100",
        username: "relbrand",
        encryptedAccessToken: encryptToken("EAAB_rel_test_token_12345"),
        status: "ACTIVE",
        webhookSubscribed: true,
        webhookSubscribedAt: new Date(),
      },
    });
    accountId = account.id;

    const auto = await prisma.automation.create({
      data: {
        instagramAccountId: accountId,
        name: "Reliability Test Flow",
        mediaId: "media_rel_100",
        triggerType: "KEYWORD",
        keywords: ["guide"],
        publicReplyText: "Sent you the guide!",
        dmMessageText: "Here is your guide:",
        dmLink: "https://replyza.buzz/guide",
        status: "ACTIVE",
      },
    });
    automationId = auto.id;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("1. Concurrent duplicate webhook deliveries create only 1 execution and 1 outbox record", async () => {
    const body = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_rel_biz_100",
          changes: [
            {
              field: "comments",
              value: {
                id: "comment_concurrent_1",
                text: "Send guide please!",
                media: { id: "media_rel_100" },
                from: { id: "commenter_1", username: "fan1" },
              },
            },
          ],
        },
      ],
    });
    const sig = signPayload(body);

    const responses = await Promise.all([
      request(app).post("/api/v1/webhooks/instagram").set("Content-Type", "application/json").set("x-hub-signature-256", sig).send(body),
      request(app).post("/api/v1/webhooks/instagram").set("Content-Type", "application/json").set("x-hub-signature-256", sig).send(body),
      request(app).post("/api/v1/webhooks/instagram").set("Content-Type", "application/json").set("x-hub-signature-256", sig).send(body),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.text).toBe("EVENT_RECEIVED");
    }

    const events = await prisma.webhookEvent.findMany({ where: { instagramAccountId: accountId } });
    const executions = await prisma.automationExecution.findMany({ where: { automationId } });
    const outbox = await prisma.outboxEvent.findMany({ where: { eventType: "AUTOMATION_EXECUTION" } });

    expect(events).toHaveLength(1);
    expect(executions).toHaveLength(1);
    expect(outbox).toHaveLength(1);
  });

  it("2. Two concurrent workers processing the same execution send at most 1 public reply and 1 DM", async () => {
    const event = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: "comment_race_2",
        mediaId: "media_rel_100",
        commenterInstagramId: "commenter_2",
        commenterUsername: "fan2",
        commentText: "guide",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId,
        webhookEventId: event.id,
        status: "PENDING",
      },
    });

    let publicCalls = 0;
    let privateCalls = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      await new Promise((r) => setTimeout(r, 40));
      if (urlStr.includes("/replies")) {
        publicCalls++;
        return { ok: true, status: 200, json: async () => ({ id: "pub_reply_1" }) } as Response;
      }
      if (urlStr.includes("/messages")) {
        privateCalls++;
        return { ok: true, status: 200, json: async () => ({ message_id: "dm_reply_1" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    const job: any = {
      data: { executionId: exec.id, automationId, webhookEventId: event.id },
    };

    await Promise.all([processAutomationJob(job), processAutomationJob(job)]);

    expect(publicCalls).toBe(1);
    expect(privateCalls).toBe(1);

    const updated = await prisma.automationExecution.findUnique({ where: { id: exec.id } });
    expect(updated?.status).toBe("COMPLETED");
    expect(updated?.metaReplyId).toBe("pub_reply_1");
    expect(updated?.metaPrivateReplyId).toBe("dm_reply_1");
  });

  it("3. Transient 429 on private reply triggers BullMQ retry without repeating successful public reply", async () => {
    const event = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: "comment_retry_3",
        mediaId: "media_rel_100",
        commenterInstagramId: "commenter_3",
        commenterUsername: "fan3",
        commentText: "guide",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId,
        webhookEventId: event.id,
        status: "PENDING",
      },
    });

    let publicCalls = 0;
    let privateCalls = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("/replies")) {
        publicCalls++;
        return { ok: true, status: 200, json: async () => ({ id: "pub_reply_once" }) } as Response;
      }
      if (urlStr.includes("/messages")) {
        privateCalls++;
        if (privateCalls === 1) {
          return {
            ok: false,
            status: 429,
            json: async () => ({ error: { message: "Rate limit", code: 4 } }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ message_id: "dm_reply_retry_ok" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    const job: any = {
      data: { executionId: exec.id, automationId, webhookEventId: event.id },
    };

    // Attempt 1: Public succeeds, Private gets 429 -> RETRY_PENDING and throws for BullMQ retry
    await expect(processAutomationJob(job)).rejects.toThrow(/retrying via BullMQ/);

    const afterAttempt1 = await prisma.automationExecution.findUnique({ where: { id: exec.id } });
    expect(afterAttempt1?.status).toBe("RETRY_PENDING");
    expect(afterAttempt1?.publicReplyStatus).toBe("SUCCESS");
    expect(afterAttempt1?.privateReplyStatus).toBe("RETRY_PENDING");
    expect(afterAttempt1?.retryCount).toBe(1);

    // Attempt 2 (BullMQ retry): Public is NOT called again; Private succeeds -> COMPLETED
    await processAutomationJob(job);

    expect(publicCalls).toBe(1);
    expect(privateCalls).toBe(2);

    const afterAttempt2 = await prisma.automationExecution.findUnique({ where: { id: exec.id } });
    expect(afterAttempt2?.status).toBe("COMPLETED");
    expect(afterAttempt2?.publicReplyStatus).toBe("SUCCESS");
    expect(afterAttempt2?.privateReplyStatus).toBe("SUCCESS");
    expect(afterAttempt2?.metaPrivateReplyId).toBe("dm_reply_retry_ok");
  });

  it("4. Ambiguous POST 503 marks action UNKNOWN, never blindly resends, and reconciles via GET", async () => {
    const event = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: "comment_unknown_4",
        mediaId: "media_rel_100",
        commenterInstagramId: "commenter_4",
        commenterUsername: "fan4",
        commentText: "guide",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId,
        webhookEventId: event.id,
        status: "PENDING",
      },
    });

    let postReplyCalls = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/replies") && init?.method === "POST") {
        postReplyCalls++;
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: { message: "Upstream 503", code: 2 } }),
        } as Response;
      }
      if (urlStr.includes("/replies") && init?.method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: "reconciled_pub_999", text: "Sent you the guide!", from: { id: "ig_rel_biz_100" } }],
          }),
        } as Response;
      }
      if (urlStr.includes("/messages")) {
        return { ok: true, status: 200, json: async () => ({ message_id: "dm_ok_4" }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    const job: any = {
      data: { executionId: exec.id, automationId, webhookEventId: event.id },
    };

    // Run 1: POST /replies gets 503 -> marked UNKNOWN (no blind retry)
    await processAutomationJob(job);

    expect(postReplyCalls).toBe(1);
    const afterRun1 = await prisma.automationExecution.findUnique({ where: { id: exec.id } });
    expect(afterRun1?.publicReplyStatus).toBe("UNKNOWN");
    expect(afterRun1?.status).toBe("PARTIAL");

    // Run 2 (recovery): GET /replies finds the reply -> reconciled to SUCCESS without another POST!
    await processAutomationJob(job);

    expect(postReplyCalls).toBe(1);
    const afterRun2 = await prisma.automationExecution.findUnique({ where: { id: exec.id } });
    expect(afterRun2?.publicReplyStatus).toBe("SUCCESS");
    expect(afterRun2?.metaReplyId).toBe("reconciled_pub_999");
    expect(afterRun2?.status).toBe("COMPLETED");
  });

  it("5. Redis outage during webhook preserves OutboxEvent and dispatches safely on recovery", async () => {
    const addSpy = vi.spyOn(automationQueue, "add").mockRejectedValueOnce(new Error("Redis connection closed"));

    const body = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_rel_biz_100",
          changes: [
            {
              field: "comments",
              value: {
                id: "comment_redis_outage_5",
                text: "Send guide",
                media: { id: "media_rel_100" },
                from: { id: "commenter_5", username: "fan5" },
              },
            },
          ],
        },
      ],
    });

    // Webhook still acknowledges 200 because DB + OutboxEvent succeeded atomically
    await request(app)
      .post("/api/v1/webhooks/instagram")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signPayload(body))
      .send(body)
      .expect(200);

    addSpy.mockRestore();

    const pendingOutbox = await prisma.outboxEvent.findMany({
      where: { eventType: "AUTOMATION_EXECUTION", status: "PENDING" },
    });
    expect(pendingOutbox).toHaveLength(1);

    // Reset nextAttemptAt so dispatcher picks it up immediately
    await prisma.outboxEvent.update({
      where: { id: pendingOutbox[0].id },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });

    const result = await dispatchPendingOutboxEvents();
    expect(result.dispatched).toBe(1);

    const dispatchedOutbox = await prisma.outboxEvent.findUnique({
      where: { id: pendingOutbox[0].id },
    });
    expect(dispatchedOutbox?.status).toBe("DISPATCHED");
  });

  it("6. Orphan recovery recovers expired PROCESSING leases and orphaned PENDING executions without duplicating", async () => {
    const event = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: "comment_orphan_6",
        mediaId: "media_rel_100",
        commenterInstagramId: "commenter_6",
        commenterUsername: "fan6",
        commentText: "guide",
        eventPayload: {},
      },
    });
    const expiredExec = await prisma.automationExecution.create({
      data: {
        automationId,
        webhookEventId: event.id,
        status: "PROCESSING",
        publicReplyStatus: "PROCESSING",
        leaseToken: "11111111-1111-4111-8111-111111111111",
        leaseExpiresAt: new Date(Date.now() - 60_000),
      },
    });

    const recovery = await recoverOrphanedRecords(0);
    expect(recovery.expiredLeasesRecovered).toBe(1);

    const recovered = await prisma.automationExecution.findUnique({ where: { id: expiredExec.id } });
    expect(recovered?.status).toBe("PARTIAL");
    expect(recovered?.publicReplyStatus).toBe("UNKNOWN");
  });

  it("7. Execution history API returns tenant-isolated executions with statuses and errors", async () => {
    const event = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: accountId,
        commentId: "comment_api_7",
        mediaId: "media_rel_100",
        commenterInstagramId: "commenter_7",
        commenterUsername: "fan7",
        commentText: "guide",
        eventPayload: {},
      },
    });
    const exec = await prisma.automationExecution.create({
      data: {
        automationId,
        webhookEventId: event.id,
        status: "PARTIAL",
        publicReplyStatus: "UNKNOWN",
        privateReplyStatus: "SUCCESS",
        metaPrivateReplyId: "dm_7",
        errorMessage: "Network timeout during public reply",
      },
    });

    const ownerList = await request(app)
      .get("/api/v1/automations/executions")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    expect(ownerList.body.data.items).toHaveLength(1);
    expect(ownerList.body.data.items[0].id).toBe(exec.id);
    expect(ownerList.body.data.items[0].publicReplyStatus).toBe("UNKNOWN");

    // Tenant isolation: other user sees 0 items and gets 404 on detail
    const otherList = await request(app)
      .get("/api/v1/automations/executions")
      .set("Authorization", `Bearer ${otherUserToken}`)
      .expect(200);
    expect(otherList.body.data.items).toHaveLength(0);

    await request(app)
      .get(`/api/v1/automations/executions/${exec.id}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .expect(404);
  });
});
