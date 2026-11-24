/**
 * Worker Processing, Lease/Claim & Action State Machine Tests
 *
 * Requirements:
 * - Worker lease/claim, renewal, and lease expiration recovery.
 * - Idempotent re-run (terminal executions are not reprocessed).
 * - Public/private action state machine (PENDING -> PROCESSING -> SUCCESS/FAILED/UNKNOWN).
 * - Meta error -> FAILED.
 * - Unknown outcome -> UNKNOWN with NO retry of DM.
 * - Token decrypt/invalid error handling.
 *
 * Meta Documentation Reference:
 * https://developers.facebook.com/documentation/instagram-platform/comment-moderation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@replyza/database";
import { encryptToken } from "@replyza/shared";
import { processAutomationJob } from "../../apps/worker/src/processors/automation.processor";
import {
  claimExecution,
  renewExecutionLease,
  recoverExpiredExecution,
} from "../../apps/worker/src/services/execution-lease.service";
import type { AutomationJobData } from "../../apps/worker/src/queues/automation.queue";
import { cleanDatabase } from "../setup";

describe("Worker Lease, Claim, State Machine & Reliability", () => {
  const originalFetch = global.fetch;
  const encryptionKey = process.env.META_TOKEN_ENCRYPTION_KEY!;

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // Helper to create test entities
  async function createTestExecutionSetup(status: "ACTIVE" | "PAUSED" = "ACTIVE") {
    const user = await prisma.user.create({
      data: {
        email: `worker_${Date.now()}_${Math.random().toString(36).slice(2)}@replyza.com`,
        passwordHash: "argon2_test_hash",
      },
    });

    const account = await prisma.instagramAccount.create({
      data: {
        userId: user.id,
        instagramUserId: `ig_user_${Date.now()}`,
        username: "worker_test_ig",
        encryptedAccessToken: encryptToken("EAAB_test_mock_token_abc123", encryptionKey),
      },
    });

    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: account.id,
        name: "Black Friday Deal",
        status,
        triggerType: "KEYWORD",
        keywords: ["deal", "sale"],
        mediaId: "media_test_post_100",
        publicReplyText: "Check your DMs for the exclusive discount!",
        dmMessageText: "Here is your 50% discount voucher code: SAVE50",
        dmLink: "https://shop.example.com/discount",
      },
    });

    const commentId = `comment_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        instagramAccountId: account.id,
        commentId,
        mediaId: "media_test_post_100",
        commenterInstagramId: "customer_fan_42",
        commenterUsername: "deal_hunter",
        commentText: "I want the DEAL please!",
        eventPayload: {},
        status: "PROCESSING",
      },
    });

    const execution = await prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        webhookEventId: webhookEvent.id,
        status: "PENDING",
        publicReplyStatus: "PENDING",
        privateReplyStatus: "PENDING",
      },
    });

    return { user, account, automation, webhookEvent, execution };
  }

  describe("1. Lease & Claim Logic", () => {
    it("claims execution atomically and prevents concurrent lease claims", async () => {
      const { execution } = await createTestExecutionSetup();

      const leaseA = randomUUID();
      const leaseB = randomUUID();

      // Worker A claims
      const claimedA = await claimExecution(execution.id, leaseA, null);
      expect(claimedA).toBe(true);

      const dbExec = await prisma.automationExecution.findUnique({
        where: { id: execution.id },
      });
      expect(dbExec?.status).toBe("PROCESSING");
      expect(dbExec?.leaseToken).toBe(leaseA);
      expect(dbExec?.leaseExpiresAt).not.toBeNull();

      // Worker B tries to claim concurrently - must be rejected
      const claimedB = await claimExecution(execution.id, leaseB, null);
      expect(claimedB).toBe(false);

      // Worker A can renew the lease
      const renewed = await renewExecutionLease(execution.id, leaseA);
      expect(renewed).toBe(true);

      // Worker B cannot renew Worker A's lease
      const fakeRenew = await renewExecutionLease(execution.id, leaseB);
      expect(fakeRenew).toBe(false);
    });

    it("recovers expired execution when previous worker crashed", async () => {
      const { execution } = await createTestExecutionSetup();

      const deadLease = randomUUID();
      await claimExecution(execution.id, deadLease, null);

      // Fast forward expiration into the past
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          leaseExpiresAt: new Date(Date.now() - 5000), // expired 5s ago
        },
      });

      // Recovery should succeed and reset status to PARTIAL with cleared lease
      const recovered = await recoverExpiredExecution(execution.id);
      expect(recovered).toBe(true);

      const recoveredExec = await prisma.automationExecution.findUnique({
        where: { id: execution.id },
      });
      expect(recoveredExec?.status).toBe("PARTIAL");
      expect(recoveredExec?.leaseToken).toBeNull();
      expect(recoveredExec?.leaseExpiresAt).toBeNull();

      // New worker can now claim it
      const newLease = randomUUID();
      const reclaimed = await claimExecution(execution.id, newLease, null);
      expect(reclaimed).toBe(true);
    });
  });

  describe("2. Full Execution State Machine (Happy Path)", () => {
    it("completes both public reply and private DM, transitioning to COMPLETED", async () => {
      const { automation, webhookEvent, execution } = await createTestExecutionSetup();

      const sentCalls: string[] = [];
      global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = input.toString();
        sentCalls.push(urlStr);

        if (urlStr.includes("/replies")) {
          // Public reply
          return new Response(JSON.stringify({ id: "meta_pub_reply_888" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (urlStr.includes("/messages")) {
          // Private DM reply
          return new Response(JSON.stringify({ message_id: "meta_priv_msg_999" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response("Not found", { status: 404 });
      });

      const job = {
        data: {
          executionId: execution.id,
          automationId: automation.id,
          webhookEventId: webhookEvent.id,
        },
      } as any;

      await processAutomationJob(job);

      // Verify execution updated to COMPLETED
      const finished = await prisma.automationExecution.findUnique({
        where: { id: execution.id },
      });
      expect(finished?.status).toBe("COMPLETED");
      expect(finished?.publicReplyStatus).toBe("SUCCESS");
      expect(finished?.metaReplyId).toBe("meta_pub_reply_888");
      expect(finished?.privateReplyStatus).toBe("SUCCESS");
      expect(finished?.metaPrivateReplyId).toBe("meta_priv_msg_999");
      expect(finished?.leaseToken).toBeNull();
      expect(finished?.completedAt).not.toBeNull();

      // Verify webhook event marked PROCESSED
      const event = await prisma.webhookEvent.findUnique({
        where: { id: webhookEvent.id },
      });
      expect(event?.status).toBe("PROCESSED");
      expect(event?.processedAt).not.toBeNull();

      // Exactly 2 Meta calls: 1 comment reply, 1 private message
      expect(sentCalls.length).toBe(2);
      expect(sentCalls[0]).toContain("/replies");
      expect(sentCalls[1]).toContain("/messages");
    });
  });

  describe("3. Idempotent Re-Run", () => {
    it("does not re-execute if execution is already terminal (COMPLETED)", async () => {
      const { automation, webhookEvent, execution } = await createTestExecutionSetup();

      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: "COMPLETED",
          publicReplyStatus: "SUCCESS",
          metaReplyId: "existing_reply",
          privateReplyStatus: "SUCCESS",
          metaPrivateReplyId: "existing_msg",
        },
      });

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const job = {
        data: {
          executionId: execution.id,
          automationId: automation.id,
          webhookEventId: webhookEvent.id,
        },
      } as any;

      await processAutomationJob(job);

      // Zero calls to Meta
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("4. Meta Error Handling (Permanent Failure)", () => {
    it("marks action FAILED and execution FAILED when Meta returns 400 error", async () => {
      const { automation, webhookEvent, execution } = await createTestExecutionSetup();

      global.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: {
              message: "Invalid comment ID or permissions",
              type: "OAuthException",
              code: 100,
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      });

      const job = {
        data: {
          executionId: execution.id,
          automationId: automation.id,
          webhookEventId: webhookEvent.id,
        },
      } as any;

      await processAutomationJob(job);

      const dbExec = await prisma.automationExecution.findUnique({
        where: { id: execution.id },
      });
      expect(dbExec?.publicReplyStatus).toBe("FAILED");
      expect(dbExec?.privateReplyStatus).toBe("FAILED");
      expect(dbExec?.status).toBe("FAILED");
    });
  });

  describe("5. Unknown Outcome & No-Retry Safeguard for DMs", () => {
    it("marks private reply UNKNOWN and prevents duplicate DM send on re-run", async () => {
      const { automation, webhookEvent, execution } = await createTestExecutionSetup();

      let dmAttempts = 0;

      global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const urlStr = input.toString();

        if (urlStr.includes("/replies")) {
          return new Response(JSON.stringify({ id: "meta_reply_ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (urlStr.includes("/messages")) {
          dmAttempts++;
          // Simulate network drop / Meta 500 error on private message
          return new Response("Internal Server Error on Meta side", {
            status: 500,
            headers: { "Content-Type": "text/plain" },
          });
        }

        return new Response("Not found", { status: 404 });
      });

      const job = {
        data: {
          executionId: execution.id,
          automationId: automation.id,
          webhookEventId: webhookEvent.id,
        },
      } as any;

      // First run: public succeeds, private returns 500 -> UNKNOWN
      await processAutomationJob(job);

      const intermediate = await prisma.automationExecution.findUnique({
        where: { id: execution.id },
      });
      expect(intermediate?.publicReplyStatus).toBe("SUCCESS");
      expect(intermediate?.privateReplyStatus).toBe("UNKNOWN");
      expect(intermediate?.status).toBe("PARTIAL");
      expect(dmAttempts).toBe(1);

      // Now, simulate a retry or re-queued job for this execution:
      // CRITICAL SAFETY RULE: The system MUST NOT retry sending the DM when status is UNKNOWN!
      await processAutomationJob(job);

      expect(dmAttempts).toBe(1); // STILL 1! No second DM was sent!

      const afterRerun = await prisma.automationExecution.findUnique({
        where: { id: execution.id },
      });
      expect(afterRerun?.privateReplyStatus).toBe("UNKNOWN");
    });
  });

  describe("6. Token Decryption Failure", () => {
    it("handles corrupted token by failing execution without sending requests", async () => {
      const { automation, webhookEvent, execution, account } = await createTestExecutionSetup();

      // Corrupt the encrypted access token
      await prisma.instagramAccount.update({
        where: { id: account.id },
        data: {
          encryptedAccessToken: "corrupted_bad_iv_and_ciphertext",
        },
      });

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const job = {
        data: {
          executionId: execution.id,
          automationId: automation.id,
          webhookEventId: webhookEvent.id,
        },
      } as any;

      await expect(processAutomationJob(job)).rejects.toThrow(/decrypt|token/i);

      const dbExec = await prisma.automationExecution.findUnique({
        where: { id: execution.id },
      });
      expect(dbExec?.status).toBe("FAILED");
      expect(dbExec?.errorMessage).toContain("token decryption failed");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
