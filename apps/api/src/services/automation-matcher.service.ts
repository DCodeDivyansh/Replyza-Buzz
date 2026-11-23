
import { prisma } from "@replyza/database";
import { automationQueue } from "../queues/automation.queue";

interface MatchAutomationInput {
  instagramAccountId: string;
  mediaId: string;
  commentText: string;
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
  // Always load the event from PostgreSQL.
  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
  });

  if (!event) {
    throw new Error(`Webhook event not found: ${webhookEventId}`);
  }

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

  // Unique webhookEventId ensures one execution per comment.
  const execution = await prisma.automationExecution.upsert({
    where: {
      webhookEventId: event.id,
    },
    create: {
      automationId: automation.id,
      webhookEventId: event.id,
      status: "PENDING",
    },
    update: {},
  });

  // A deterministic job ID prevents duplicate queue jobs.
  await automationQueue.add(
    "process-automation",
    {
      executionId: execution.id,
      automationId: automation.id,
      webhookEventId: event.id,
    },
    {
      jobId: execution.id,
    }
  );

  return {
    matched: true,
    queued: true,
    executionId: execution.id,
  };
}
