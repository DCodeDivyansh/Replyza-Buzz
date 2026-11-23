
import { prisma } from "@replyza/database";

export type AutomationAction = "public" | "private";

function getStatusField(action: AutomationAction) {
  return action === "public"
    ? "publicReplyStatus"
    : "privateReplyStatus";
}

export async function claimAction(
  executionId: string,
  action: AutomationAction
): Promise<boolean> {
  const statusField = getStatusField(action);

  const result = await prisma.automationExecution.updateMany({
    where: {
      id: executionId,
      [statusField]: "PENDING",
    },
    data: {
      [statusField]: "PROCESSING",
    },
  });

  return result.count === 1;
}

export async function completePublicReply(
  executionId: string,
  metaReplyId: string
): Promise<void> {
  const result = await prisma.automationExecution.updateMany({
    where: {
      id: executionId,
      publicReplyStatus: "PROCESSING",
    },
    data: {
      publicReplyStatus: "SUCCESS",
      metaReplyId,
    },
  });

  if (result.count !== 1) {
    throw new Error(
      "Could not persist public reply success state"
    );
  }
}

export async function markActionFailed(
  executionId: string,
  action: AutomationAction,
  reason: string
): Promise<void> {
  const statusField = getStatusField(action);

  await prisma.automationExecution.updateMany({
    where: {
      id: executionId,
      [statusField]: "PROCESSING",
    },
    data: {
      [statusField]: "FAILED",
      errorMessage: reason,
    },
  });
}

export async function markActionUnknown(
  executionId: string,
  action: AutomationAction,
  reason: string
): Promise<void> {
  const statusField = getStatusField(action);

  await prisma.automationExecution.updateMany({
    where: {
      id: executionId,
      [statusField]: "PROCESSING",
    },
    data: {
      [statusField]: "UNKNOWN",
      status: "PARTIAL",
      errorMessage: reason,
      completedAt: new Date(),
    },
  });
}
