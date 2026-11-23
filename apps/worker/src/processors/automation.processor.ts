
import { Job, UnrecoverableError } from "bullmq";
import { prisma } from "@replyza/database";
import type { AutomationJobData } from "../queues/automation.queue";

export async function processAutomationJob(
  job: Job<AutomationJobData>
): Promise<void> {
  const { executionId, automationId, webhookEventId } = job.data;

  console.log(`[Worker] Processing execution: ${executionId}`);

  const execution = await prisma.automationExecution.findUnique({
    where: { id: executionId },
    include: {
      automation: true,
      webhookEvent: true,
    },
  });

  if (!execution) {
    throw new UnrecoverableError(
      `Execution not found: ${executionId}`
    );
  }

  // Ensure the job IDs match the database relationships.
  if (
    execution.automationId !== automationId ||
    execution.webhookEventId !== webhookEventId
  ) {
    throw new UnrecoverableError(
      "Job IDs do not match the execution record"
    );
  }

  if (execution.status === "COMPLETED") {
    console.log(`[Worker] Execution already completed: ${executionId}`);
    return;
  }

  const { automation, webhookEvent } = execution;

  // Validate account and media ownership.
  if (
    automation.instagramAccountId !== webhookEvent.instagramAccountId ||
    automation.mediaId !== webhookEvent.mediaId
  ) {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status: "FAILED",
        publicReplyStatus: "SKIPPED",
        privateReplyStatus: "SKIPPED",
        errorMessage: "Automation and webhook event do not match",
        completedAt: new Date(),
      },
    });

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "FAILED" },
    });

    throw new UnrecoverableError(
      "Automation and webhook event relationship mismatch"
    );
  }

  // Do not execute a draft or paused automation.
  if (automation.status !== "ACTIVE") {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status: "FAILED",
        publicReplyStatus: "SKIPPED",
        privateReplyStatus: "SKIPPED",
        errorMessage: `Automation is ${automation.status}; processing skipped`,
        completedAt: new Date(),
      },
    });

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    throw new UnrecoverableError(
      `Automation is not active: ${automation.status}`
    );
  }

  // Mark the execution as processing.
  await prisma.$transaction([
    prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        errorMessage: null,
      },
    }),
    prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "PROCESSING" },
    }),
  ]);

  // Temporary dry-run stage: no Instagram API calls yet.
  await prisma.automationExecution.update({
    where: { id: executionId },
    data: {
      status: "PARTIAL",
      publicReplyStatus: "SKIPPED",
      privateReplyStatus: "SKIPPED",
      errorMessage:
        "Validation successful. Instagram reply actions are not implemented yet.",
      completedAt: new Date(),
    },
  });

  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });

  console.log(`[Worker] Validation successful: ${executionId}`);
}
