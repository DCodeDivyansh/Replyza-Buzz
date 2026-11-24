import { prisma } from "@replyza/database";
import { decryptToken } from "@replyza/shared";
import { automationQueue, type AutomationJobData } from "../queues/automation.queue";
import { followCheckQueue, type FollowCheckJobData } from "../queues/follow-check.queue";
import { workerEnv } from "../config/env";
import { recoverExpiredExecution } from "./execution-lease.service";
import { reconcileCommentReply } from "./instagram-graph.service";
import {
  markDeliveryActionSent,
  markDeliveryActionNeedsReview,
  syncExecutionFromDeliveryActions,
} from "./delivery-action.service";

const MAX_OUTBOX_ATTEMPTS = 10;
const CLAIM_LEASE_MS = 30_000;

interface AutomationOutboxPayload {
  executionId: string;
  automationId: string;
  webhookEventId: string;
  actionType?: "PUBLIC_REPLY" | "HOOK_DM";
}

interface FollowCheckOutboxPayload {
  executionId: string;
  igsid: string;
  instagramUserId: string;
  providerEventId?: string;
  messagingEventId?: string;
}

/**
 * Dispatches pending transactional outbox records to BullMQ.
 * Safe for concurrent dispatcher instances: claims each record with an atomic
 * conditional update on `nextAttemptAt` before calling Redis, and uses deterministic
 * BullMQ job IDs.
 */
export async function dispatchPendingOutboxEvents(): Promise<{
  dispatched: number;
  failed: number;
}> {
  const now = new Date();
  const candidates = await prisma.outboxEvent.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
    },
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  let dispatched = 0;
  let failed = 0;

  for (const event of candidates) {
    // Atomic lease claim on the outbox row so two dispatchers don't double-enqueue
    const claimTime = new Date();
    const claimed = await prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: "PENDING",
        nextAttemptAt: event.nextAttemptAt,
      },
      data: {
        nextAttemptAt: new Date(claimTime.getTime() + CLAIM_LEASE_MS),
        attempts: { increment: 1 },
      },
    });

    if (claimed.count !== 1) {
      continue;
    }

    try {
      if (
        event.eventType === "AUTOMATION_EXECUTION" ||
        event.eventType === "AUTOMATION_ACTION"
      ) {
        const payload = event.payload as unknown as AutomationOutboxPayload;
        const jobId = payload.actionType
          ? `${payload.executionId}:${payload.actionType}`
          : payload.executionId;
        const existingJob = await automationQueue.getJob(jobId);
        if (existingJob) {
          const state = await existingJob.getState();
          if (state === "completed" || state === "failed") {
            await existingJob.remove();
          }
        }

        await automationQueue.add(
          payload.actionType
            ? `process-${payload.actionType.toLowerCase()}`
            : "process-automation",
          {
            executionId: payload.executionId,
            automationId: payload.automationId,
            webhookEventId: payload.webhookEventId,
            actionType: payload.actionType,
          } satisfies AutomationJobData,
          {
            jobId,
          }
        );
      } else if (event.eventType === "FOLLOW_CHECK") {
        const payload = event.payload as unknown as FollowCheckOutboxPayload;
        const jobId = payload.providerEventId
          ? `follow-check:${payload.executionId}:${payload.providerEventId}`
          : `follow-check:${payload.executionId}:${payload.igsid}`;

        await followCheckQueue.add(
          "follow-check",
          {
            executionId: payload.executionId,
            igsid: payload.igsid,
            instagramUserId: payload.instagramUserId,
            providerEventId: payload.providerEventId,
          } satisfies FollowCheckJobData,
          {
            jobId,
          }
        );

        if (payload.messagingEventId) {
          await prisma.messagingWebhookEvent.updateMany({
            where: { id: payload.messagingEventId, status: "RECEIVED" },
            data: { status: "PROCESSING" },
          });
        }
      }

      await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: "PENDING" },
        data: {
          status: "DISPATCHED",
          dispatchedAt: new Date(),
          lastError: null,
        },
      });
      dispatched++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Outbox dispatch failed";
      const nextAttempts = event.attempts + 1;
      const exhausted = nextAttempts >= MAX_OUTBOX_ATTEMPTS;

      await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: "PENDING" },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          lastError: errMsg,
          nextAttemptAt: new Date(
            Date.now() + Math.min(5_000 * Math.pow(2, nextAttempts - 1), 300_000)
          ),
        },
      });
      failed++;
    }
  }

  return { dispatched, failed };
}

/**
 * Safely recovers orphaned records:
 * 1. Expired PROCESSING execution leases (marks in-flight actions UNKNOWN, never blinds retries).
 * 2. Orphaned PENDING / RETRY_PENDING executions without an outbox entry.
 * 3. Orphaned RECEIVED messaging events without an outbox entry.
 */
export async function recoverOrphanedRecords(
  minAgeMs = 30_000
): Promise<{
  expiredLeasesRecovered: number;
  orphanedExecutionsQueued: number;
  orphanedMessagingQueued: number;
}> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - minAgeMs);

  let expiredLeasesRecovered = 0;
  let orphanedExecutionsQueued = 0;
  let orphanedMessagingQueued = 0;

  // 1. Recover expired PROCESSING leases
  const expired = await prisma.automationExecution.findMany({
    where: {
      status: "PROCESSING",
      leaseExpiresAt: { lte: now },
    },
    select: { id: true },
    take: 25,
  });

  for (const exec of expired) {
    const recovered = await recoverExpiredExecution(exec.id);
    if (recovered) {
      expiredLeasesRecovered++;
      const fullExec = await prisma.automationExecution.findUnique({
        where: { id: exec.id },
        select: { id: true, automationId: true, webhookEventId: true },
      });
      if (fullExec) {
        await prisma.outboxEvent.upsert({
          where: {
            eventType_aggregateId: {
              eventType: "AUTOMATION_EXECUTION",
              aggregateId: fullExec.id,
            },
          },
          create: {
            eventType: "AUTOMATION_EXECUTION",
            aggregateId: fullExec.id,
            payload: {
              executionId: fullExec.id,
              automationId: fullExec.automationId,
              webhookEventId: fullExec.webhookEventId,
            },
            status: "PENDING",
          },
          update: {
            status: "PENDING",
            nextAttemptAt: new Date(),
          },
        });
      }
    }
  }

  // 2. Recover orphaned PENDING executions (e.g. created before outbox or after Redis outage)
  const orphanedExecs = await prisma.automationExecution.findMany({
    where: {
      status: { in: ["PENDING", "RETRY_PENDING"] },
      createdAt: { lte: cutoff },
    },
    select: {
      id: true,
      automationId: true,
      webhookEventId: true,
    },
    take: 25,
  });

  for (const exec of orphanedExecs) {
    const existingOutbox = await prisma.outboxEvent.findUnique({
      where: {
        eventType_aggregateId: {
          eventType: "AUTOMATION_EXECUTION",
          aggregateId: exec.id,
        },
      },
      select: { id: true },
    });

    if (!existingOutbox) {
      await prisma.outboxEvent.create({
        data: {
          eventType: "AUTOMATION_EXECUTION",
          aggregateId: exec.id,
          payload: {
            executionId: exec.id,
            automationId: exec.automationId,
            webhookEventId: exec.webhookEventId,
          },
          status: "PENDING",
        },
      });
      orphanedExecutionsQueued++;
    }
  }

  // 3. Recover orphaned RECEIVED messaging webhook events
  const orphanedMsgs = await prisma.messagingWebhookEvent.findMany({
    where: {
      status: "RECEIVED",
      executionId: { not: null },
      receivedAt: { lte: cutoff },
    },
    select: {
      id: true,
      executionId: true,
      senderId: true,
      recipientId: true,
      providerEventId: true,
      execution: {
        select: {
          status: true,
          followCheckStatus: true,
        },
      },
    },
    take: 25,
  });

  for (const msg of orphanedMsgs) {
    if (!msg.executionId || !msg.execution) continue;
    if (
      msg.execution.status === "COMPLETED" ||
      msg.execution.followCheckStatus === "SUCCESS"
    ) {
      await prisma.messagingWebhookEvent.update({
        where: { id: msg.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      continue;
    }

    const existingOutbox = await prisma.outboxEvent.findUnique({
      where: {
        eventType_aggregateId: {
          eventType: "FOLLOW_CHECK",
          aggregateId: msg.id,
        },
      },
      select: { id: true },
    });

    if (!existingOutbox) {
      await prisma.outboxEvent.create({
        data: {
          eventType: "FOLLOW_CHECK",
          aggregateId: msg.id,
          payload: {
            executionId: msg.executionId,
            igsid: msg.senderId,
            instagramUserId: msg.recipientId,
            providerEventId: msg.providerEventId,
            messagingEventId: msg.id,
          },
          status: "PENDING",
        },
      });
      orphanedMessagingQueued++;
    }
  }

  // 4. Reconcile stale SENDING delivery_actions (> 2 minutes old) without blind resend
  const staleSendingCutoff = new Date(now.getTime() - 120_000);
  const staleActions = await prisma.deliveryAction.findMany({
    where: {
      status: "SENDING",
      updatedAt: { lte: staleSendingCutoff },
    },
    include: {
      execution: {
        include: {
          automation: { include: { instagramAccount: true } },
          webhookEvent: true,
        },
      },
    },
    take: 25,
  });

  for (const action of staleActions) {
    const exec = action.execution;
    if (action.actionType === "PUBLIC_REPLY") {
      try {
        const token = decryptToken(
          exec.automation.instagramAccount.encryptedAccessToken,
          workerEnv.metaTokenEncryptionKey
        );
        const foundId = await reconcileCommentReply(
          exec.webhookEvent.commentId,
          exec.automation.publicReplyText,
          exec.automation.instagramAccount.instagramUserId,
          token
        );
        if (foundId) {
          await markDeliveryActionSent(exec.id, "PUBLIC_REPLY", foundId);
          await syncExecutionFromDeliveryActions(exec.id, exec.webhookEventId);
          continue;
        }
      } catch {
        // Fall through to NEEDS_REVIEW
      }
    }

    await markDeliveryActionNeedsReview(
      exec.id,
      action.actionType,
      "STALE_SENDING",
      "Worker interrupted while sending; marked NEEDS_REVIEW to prevent duplicate messages"
    );
    if (action.actionType === "PUBLIC_REPLY" || action.actionType === "HOOK_DM") {
      await syncExecutionFromDeliveryActions(exec.id, exec.webhookEventId);
    }
  }

  return {
    expiredLeasesRecovered,
    orphanedExecutionsQueued,
    orphanedMessagingQueued,
  };
}
