
import { prisma } from "@replyza/database";
import { enqueueAutomationExecution } from "../queues/automation.queue";
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

export async function findMatchingAutomation(
  input: MatchAutomationInput
) {
  const automation = await prisma.automation.findFirst({
    where: {
      instagramAccountId: input.instagramAccountId,
      mediaId: input.mediaId,
      status: "ACTIVE",
    },
  });

  if (!automation) return null;

  if (automation.triggerType === "ANY_COMMENT") {
    return automation;
  }

  if (automation.triggerType === "KEYWORD") {
    const normalizedComment = input.commentText.toLowerCase();

    const matched = automation.keywords.some((keyword) => {
      const normalizedKeyword = keyword.trim().toLowerCase();

      return (
        normalizedKeyword.length > 0 &&
        normalizedComment.includes(normalizedKeyword)
      );
    });

    return matched ? automation : null;
  }

  return null;
}

export async function matchAndQueueAutomation(
  webhookEventId: string
) {
  const txResult = await prisma.$transaction(async (tx) => {
    const event = await tx.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!event) {
      throw new Error(`Webhook event not found: ${webhookEventId}`);
    }

    // An existing execution always takes precedence over a new match.
    let execution = await tx.automationExecution.findUnique({
      where: {
        webhookEventId: event.id,
      },
      select: {
        id: true,
        automationId: true,
        status: true,
      },
    });

    if (!execution) {
      const automation = await tx.automation.findFirst({
        where: {
          instagramAccountId: event.instagramAccountId,
          mediaId: event.mediaId,
          status: "ACTIVE",
        },
      });

      let matchedAutomation = null;
      if (automation) {
        if (automation.triggerType === "ANY_COMMENT") {
          matchedAutomation = automation;
        } else if (automation.triggerType === "KEYWORD") {
          const normalizedComment = event.commentText.toLowerCase();
          const matched = automation.keywords.some((keyword) => {
            const normalizedKeyword = keyword.trim().toLowerCase();
            return (
              normalizedKeyword.length > 0 &&
              normalizedComment.includes(normalizedKeyword)
            );
          });
          matchedAutomation = matched ? automation : null;
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

      try {
        execution = await tx.automationExecution.create({
          data: {
            automationId: matchedAutomation.id,
            webhookEventId: event.id,
            status: "PENDING",
          },
          select: {
            id: true,
            automationId: true,
            status: true,
          },
        });
      } catch (error) {
        if (!isDuplicateError(error)) {
          throw error;
        }

        execution = await tx.automationExecution.findUnique({
          where: {
            webhookEventId: event.id,
          },
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

    // Persist an idempotent outbox record in the same transaction so Redis outages
    // cannot lose matched executions.
    const outbox = await tx.outboxEvent.upsert({
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
      select: {
        id: true,
        status: true,
      },
    });

    return {
      matched: true as const,
      terminalOrActive: false as const,
      execution,
      outbox,
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

  // Best-effort immediate dispatch to BullMQ.
  // If Redis is unavailable, OutboxEvent remains PENDING for background recovery.
  try {
    const queueResult = await enqueueAutomationExecution({
      executionId: txResult.execution.id,
      automationId: txResult.execution.automationId,
      webhookEventId: txResult.eventId,
    });

    await prisma.outboxEvent.updateMany({
      where: {
        id: txResult.outbox.id,
        status: "PENDING",
      },
      data: {
        status: "DISPATCHED",
        dispatchedAt: new Date(),
        lastError: null,
      },
    });

    return {
      matched: true,
      queued: queueResult === "QUEUED",
      executionId: txResult.execution.id,
      executionStatus: txResult.execution.status,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Redis enqueue failed";
    logger.warn(
      {
        executionId: txResult.execution.id,
        outboxId: txResult.outbox.id,
        err: errMsg,
      },
      "Immediate BullMQ dispatch failed; OutboxEvent preserved for recovery"
    );

    await prisma.outboxEvent
      .updateMany({
        where: { id: txResult.outbox.id, status: "PENDING" },
        data: {
          attempts: { increment: 1 },
          lastError: errMsg,
          nextAttemptAt: new Date(Date.now() + 5_000),
        },
      })
      .catch((dbErr) => {
        logger.error({ dbErr, outboxId: txResult.outbox.id }, "Failed to record outbox dispatch error");
      });

    return {
      matched: true,
      queued: false,
      executionId: txResult.execution.id,
      executionStatus: txResult.execution.status,
    };
  }
}
