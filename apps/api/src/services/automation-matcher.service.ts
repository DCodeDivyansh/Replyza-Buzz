
import { prisma } from "@replyza/database";
import { enqueueAutomationExecution } from "../queues/automation.queue";

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
  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
  });

  if (!event) {
    throw new Error(`Webhook event not found: ${webhookEventId}`);
  }

  // An existing execution always takes precedence over a new match.
  let execution = await prisma.automationExecution.findUnique({
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
    const automation = await findMatchingAutomation({
      instagramAccountId: event.instagramAccountId,
      mediaId: event.mediaId,
      commentText: event.commentText,
    });

    if (!automation) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });

      return { matched: false, queued: false };
    }

    try {
      execution = await prisma.automationExecution.create({
        data: {
          automationId: automation.id,
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

      // Another webhook delivery may have created the execution.
      execution = await prisma.automationExecution.findUnique({
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

  // Never use a newly matched automation ID here.
    // PostgreSQL is authoritative for execution state.
  // Never enqueue terminal or currently processing executions.
  if (
    execution.status === "COMPLETED" ||
    execution.status === "FAILED" ||
    execution.status === "PROCESSING"
  ) {
    return {
      matched: true,
      queued: false,
      executionId: execution.id,
      executionStatus: execution.status,
    };
  }

  const queueResult = await enqueueAutomationExecution({
    executionId: execution.id,
    automationId: execution.automationId,
    webhookEventId: event.id,
  });

  return {
    matched: true,
    queued: queueResult === "QUEUED",
    executionId: execution.id,
    executionStatus: execution.status,
  };
}
