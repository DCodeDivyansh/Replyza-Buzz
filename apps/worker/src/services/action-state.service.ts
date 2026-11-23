
import { prisma } from "@replyza/database";

export type AutomationAction = "public" | "private";

function getStatusField(action: AutomationAction) {
  return action === "public"
    ? "publicReplyStatus"
    : "privateReplyStatus";
}


function getLeaseWhere(executionId: string, leaseToken: string) {
  return {
    id: executionId,
    status: "PROCESSING" as const,
    leaseToken,
    leaseExpiresAt: {
      gt: new Date(),
    },
  };
}

export async function claimAction(
  executionId: string,
  action: AutomationAction,
  leaseToken: string
): Promise<boolean> {
  const statusField = getStatusField(action);

  const result = await prisma.automationExecution.updateMany({
    where: {
      ...getLeaseWhere(executionId, leaseToken),
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
  leaseToken: string,
  metaReplyId: string
): Promise<void> {
  const result = await prisma.automationExecution.updateMany({
    where: {
      ...getLeaseWhere(executionId, leaseToken),
      publicReplyStatus: "PROCESSING",
    },
    data: {
      publicReplyStatus: "SUCCESS",
      metaReplyId,
    },
  });

  if (result.count !== 1) {
    throw new Error(
      "Could not persist public reply success state: execution ownership lost or action state changed"
    );
  }
}

export async function completePrivateReply(
  executionId: string,
  leaseToken: string,
  metaPrivateReplyId: string
): Promise<void> {
  const result = await prisma.automationExecution.updateMany({
    where: {
      ...getLeaseWhere(executionId, leaseToken),
      privateReplyStatus: "PROCESSING",
    },
    data: {
      privateReplyStatus: "SUCCESS",
      metaPrivateReplyId,
    },
  });

  if (result.count !== 1) {
    throw new Error(
      "Could not persist private reply success state: execution ownership lost or action state changed"
    );
  }
}

export async function markActionFailed(
  executionId: string,
  action: AutomationAction,
  leaseToken: string,
  reason: string
): Promise<void> {
  const statusField = getStatusField(action);

  const result = await prisma.automationExecution.updateMany({
    where: {
      ...getLeaseWhere(executionId, leaseToken),
      [statusField]: "PROCESSING",
    },
    data: {
      [statusField]: "FAILED",
      errorMessage: reason,
    },
  });

  if (result.count !== 1) {
    throw new Error(
      `Could not persist ${action} action failure state: execution ownership lost or action state changed`
    );
  }
}

export async function markActionUnknown(
  executionId: string,
  action: AutomationAction,
  leaseToken: string,
  reason: string
): Promise<void> {
  const statusField = getStatusField(action);

  const result = await prisma.automationExecution.updateMany({
    where: {
      ...getLeaseWhere(executionId, leaseToken),
      [statusField]: "PROCESSING",
    },
    data: {
      [statusField]: "UNKNOWN",
      errorMessage: reason,
    },
  });

  if (result.count !== 1) {
    throw new Error(
      `Could not persist ${action} action unknown state: execution ownership lost or action state changed`
    );
  }
}
