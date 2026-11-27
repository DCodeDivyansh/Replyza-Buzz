import { prisma } from "@replyza/database";
import {
  matchCommentKeywords,
  matchesScheduledMediaFilters,
} from "@replyza/shared";
import { features } from "../config/features";
import { enqueueAutomationExecution } from "../queues/automation.queue";
import { cancelBindingPollJob } from "../queues/schedule-binding.queue";
import { decryptToken } from "../utils/token-encryption";
import { metaGraphService } from "./meta-graph.service";
import { logger } from "../utils/logger";

interface MatchAutomationInput {
  instagramAccountId: string;
  mediaId: string;
  commentText: string;
}

function isDuplicateError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

/**
 * Deterministic automation precedence:
 * 1. Media-specific ACTIVE automation matching the comment beats all-media.
 * 2. All-media ACTIVE automation (mediaId IS NULL) matching the comment.
 * 3. Oldest active (createdAt ASC) wins; at most one automation fires per comment.
 */
export async function findMatchingAutomation(input: MatchAutomationInput) {
  const candidates = await prisma.automation.findMany({
    where: {
      instagramAccountId: input.instagramAccountId,
      status: "ACTIVE",
      OR: [
        { mediaId: input.mediaId },
        { mediaId: null, targetMode: "ALL_POSTS" },
      ],
    },
    orderBy: [{ createdAt: "asc" }],
  });

  // Sort media-specific before all-media while preserving createdAt ASC order
  candidates.sort((a, b) => {
    const aSpec = a.mediaId !== null ? 0 : 1;
    const bSpec = b.mediaId !== null ? 0 : 1;
    if (aSpec !== bSpec) return aSpec - bSpec;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  for (const automation of candidates) {
    const mode =
      automation.triggerType === "ANY_COMMENT"
        ? "ANY"
        : automation.keywordMatchMode;
    const result = matchCommentKeywords(
      input.commentText,
      mode,
      automation.keywords,
      automation.keywordMatchLogic
    );
    if (result.matched) {
      return automation;
    }
  }

  return null;
}

export interface PrefetchedWebhookEvent {
  id: string;
  instagramAccountId: string;
  mediaId: string;
  commenterInstagramId: string;
  commentText: string;
}

/**
 * Lazily binds a SCHEDULED_TIME or NEXT_POST automation when the first comment
 * webhook arrives for a newly published post before the poller runs.
 */
async function tryLazyBindForMedia(
  instagramAccountId: string,
  mediaId: string
): Promise<void> {
  const activeForMedia = await prisma.automation.findFirst({
    where: {
      instagramAccountId,
      status: "ACTIVE",
      OR: [{ mediaId }, { mediaId: null, targetMode: "ALL_POSTS" }],
    },
    select: { id: true },
  });

  if (activeForMedia) {
    return;
  }

  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  const bindableCandidates = await prisma.automation.findMany({
    where: {
      instagramAccountId,
      mediaId: null,
      OR: [
        {
          status: "SCHEDULED",
          targetMode: "SCHEDULED_TIME",
          scheduledActivateAt: { lte: fiveMinutesFromNow },
          AND: [
            {
              OR: [
                { bindingWindowEndAt: null },
                { bindingWindowEndAt: { gte: now } },
              ],
            },
          ],
        },
        {
          status: "ACTIVE",
          targetMode: "NEXT_POST",
        },
      ],
    },
    orderBy: [{ createdAt: "asc" }],
  });

  if (bindableCandidates.length === 0) {
    return;
  }

  const account = await prisma.instagramAccount.findUnique({
    where: { id: instagramAccountId },
    select: {
      encryptedAccessToken: true,
      status: true,
    },
  });

  if (!account || account.status === "NEEDS_RECONNECT") {
    return;
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(account.encryptedAccessToken);
  } catch {
    return;
  }

  let mediaItem;
  try {
    mediaItem = await metaGraphService.getMediaItem(mediaId, accessToken);
  } catch (err) {
    logger.warn(
      { instagramAccountId, mediaId, err: err instanceof Error ? err.message : "unknown" },
      "Lazy-binding media metadata fetch failed"
    );
    return;
  }

  for (const candidate of bindableCandidates) {
    if (!matchesScheduledMediaFilters(mediaItem, candidate, now)) {
      continue;
    }

    const resolvedMediaType =
      mediaItem.media_product_type === "REELS"
        ? "REELS"
        : (mediaItem.media_type ?? null);

    const bound = await prisma.automation.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        mediaId: null,
      },
      data: {
        mediaId,
        mediaPermalink: mediaItem.permalink ?? null,
        mediaType: resolvedMediaType,
        status: "ACTIVE",
      },
    });

    if (bound.count === 1) {
      logger.info(
        { automationId: candidate.id, mediaId, targetMode: candidate.targetMode },
        "Lazily bound scheduled/next-post automation from incoming comment webhook"
      );
      await cancelBindingPollJob(candidate.id).catch(() => {});
      break;
    }
  }
}

export async function matchAndQueueAutomation(
  webhookEventId: string,
  prefetchedEvent?: PrefetchedWebhookEvent
) {
  const resolvedEvent =
    prefetchedEvent ??
    (await prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
      select: {
        id: true,
        instagramAccountId: true,
        mediaId: true,
        commenterInstagramId: true,
        commentText: true,
      },
    }));

  if (!resolvedEvent) {
    throw new Error(`Webhook event not found: ${webhookEventId}`);
  }

  await tryLazyBindForMedia(
    resolvedEvent.instagramAccountId,
    resolvedEvent.mediaId
  );

  let isFreshExecution = false;
  const txResult = await prisma.$transaction(async (tx) => {
    const event = resolvedEvent;

    if (!event) {
      throw new Error(`Webhook event not found: ${webhookEventId}`);
    }

    // An existing execution always takes precedence over a new match.
    let execution = await tx.automationExecution.findUnique({
      where: { webhookEventId: event.id },
      select: {
        id: true,
        automationId: true,
        status: true,
      },
    });

    if (!execution) {
      const candidates = await tx.automation.findMany({
        where: {
          instagramAccountId: event.instagramAccountId,
          status: "ACTIVE",
          OR: [
            { mediaId: event.mediaId },
            { mediaId: null, targetMode: "ALL_POSTS" },
          ],
        },
        orderBy: [{ createdAt: "asc" }],
      });

      candidates.sort((a, b) => {
        const aSpec = a.mediaId !== null ? 0 : 1;
        const bSpec = b.mediaId !== null ? 0 : 1;
        if (aSpec !== bSpec) return aSpec - bSpec;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      let matchedAutomation = null;
      for (const automation of candidates) {
        const mode =
          automation.triggerType === "ANY_COMMENT"
            ? "ANY"
            : automation.keywordMatchMode;
        const res = matchCommentKeywords(
          event.commentText,
          mode,
          automation.keywords,
          automation.keywordMatchLogic
        );
        if (res.matched) {
          matchedAutomation = automation;
          break;
        }
      }

      if (!matchedAutomation) {
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
          },
        });

        return { matched: false as const };
      }

      // Per-user cooldown check per automation
      if (matchedAutomation.cooldownSeconds > 0) {
        const cutoff = new Date(
          Date.now() - matchedAutomation.cooldownSeconds * 1000
        );
        const recent = await tx.automationExecution.findFirst({
          where: {
            automationId: matchedAutomation.id,
            commenterIgsid: event.commenterInstagramId,
            createdAt: { gte: cutoff },
          },
          select: { id: true },
        });

        if (recent) {
          await tx.webhookEvent.update({
            where: { id: event.id },
            data: {
              status: "PROCESSED",
              processedAt: new Date(),
            },
          });
          return { matched: false as const, cooledDown: true as const };
        }
      }

      try {
        execution = await tx.automationExecution.create({
          data: {
            automationId: matchedAutomation.id,
            webhookEventId: event.id,
            commenterIgsid: event.commenterInstagramId,
            status: "PENDING",
          },
          select: {
            id: true,
            automationId: true,
            status: true,
          },
        });
        isFreshExecution = true;
      } catch (error) {
        if (!isDuplicateError(error)) {
          throw error;
        }

        execution = await tx.automationExecution.findUnique({
          where: { webhookEventId: event.id },
          select: {
            id: true,
            automationId: true,
            status: true,
          },
        });

        if (!execution) {
          throw new Error(
            `Execution could not be retrieved for webhook event: ${event.id}`
          );
        }
      }
    }

    if (
      execution.status === "COMPLETED" ||
      execution.status === "FAILED" ||
      execution.status === "PROCESSING" ||
      execution.status === "CANCELLED"
    ) {
      return {
        matched: true as const,
        terminalOrActive: true as const,
        execution,
      };
    }

    // Ensure independent DeliveryAction rows exist for PUBLIC_REPLY and HOOK_DM
    await tx.deliveryAction.createMany({
      data: [
        {
          executionId: execution.id,
          actionType: "PUBLIC_REPLY",
          status: "PENDING",
        },
        {
          executionId: execution.id,
          actionType: "HOOK_DM",
          status: "PENDING",
        },
      ],
      skipDuplicates: true,
    });

    const outboxJobs: Array<{
      id: string;
      actionType?: "PUBLIC_REPLY" | "HOOK_DM";
    }> = [];

    if (features.INDEPENDENT_ACTIONS) {
      for (const actionType of ["PUBLIC_REPLY", "HOOK_DM"] as const) {
        const ob = await tx.outboxEvent.upsert({
          where: {
            eventType_aggregateId: {
              eventType: "AUTOMATION_ACTION",
              aggregateId: `${execution.id}:${actionType}`,
            },
          },
          create: {
            eventType: "AUTOMATION_ACTION",
            aggregateId: `${execution.id}:${actionType}`,
            payload: {
              executionId: execution.id,
              automationId: execution.automationId,
              webhookEventId: event.id,
              actionType,
            },
            status: "PENDING",
          },
          update: {},
          select: { id: true },
        });
        outboxJobs.push({ id: ob.id, actionType });
      }
    } else {
      const ob = await tx.outboxEvent.upsert({
        where: {
          eventType_aggregateId: {
            eventType: "AUTOMATION_EXECUTION",
            aggregateId: execution.id,
          },
        },
        create: {
          eventType: "AUTOMATION_EXECUTION",
          aggregateId: execution.id,
          payload: {
            executionId: execution.id,
            automationId: execution.automationId,
            webhookEventId: event.id,
          },
          status: "PENDING",
        },
        update: {},
        select: { id: true },
      });
      outboxJobs.push({ id: ob.id });
    }

    return {
      matched: true as const,
      terminalOrActive: false as const,
      execution,
      outboxJobs,
      eventId: event.id,
    };
  });

  if (!txResult.matched) {
    return { matched: false, queued: false };
  }

  if (txResult.terminalOrActive) {
    return {
      matched: true,
      queued: false,
      executionId: txResult.execution.id,
      executionStatus: txResult.execution.status,
    };
  }

  // Dispatch independent action jobs in parallel; if Redis is unavailable,
  // OutboxEvent records remain PENDING for background recovery.
  let anyQueued = false;
  await Promise.allSettled(
    txResult.outboxJobs.map(async (job) => {
      try {
        const queueResult = await enqueueAutomationExecution(
          {
            executionId: txResult.execution.id,
            automationId: txResult.execution.automationId,
            webhookEventId: txResult.eventId,
            actionType: job.actionType,
          },
          { skipExistingCheck: isFreshExecution }
        );
        if (queueResult === "QUEUED") {
          anyQueued = true;
        }
        await prisma.outboxEvent.updateMany({
          where: { id: job.id, status: "PENDING" },
          data: {
            status: "DISPATCHED",
            dispatchedAt: new Date(),
            lastError: null,
          },
        });
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Redis enqueue failed";
        logger.warn(
          {
            executionId: txResult.execution.id,
            outboxId: job.id,
            actionType: job.actionType,
            err: errMsg,
          },
          "Immediate BullMQ dispatch failed; OutboxEvent preserved for recovery"
        );
        await prisma.outboxEvent
          .updateMany({
            where: { id: job.id, status: "PENDING" },
            data: {
              attempts: { increment: 1 },
              lastError: errMsg,
              nextAttemptAt: new Date(Date.now() + 5_000),
            },
          })
          .catch(() => {});
      }
    })
  );

  return {
    matched: true,
    queued: anyQueued,
    executionId: txResult.execution.id,
    executionStatus: txResult.execution.status,
  };
}
