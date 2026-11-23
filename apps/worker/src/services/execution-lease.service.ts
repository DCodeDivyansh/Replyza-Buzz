
import { prisma } from "@replyza/database";

const LEASE_DURATION_MS = 120_000;

export async function claimExecution(
  executionId: string,
  leaseToken: string,
  startedAt: Date | null
): Promise<boolean> {
  const now = new Date();

  const result = await prisma.automationExecution.updateMany({
    where: {
      id: executionId,
      status: {
        in: ["PENDING", "PARTIAL"],
      },
    },
    data: {
      status: "PROCESSING",
      leaseToken,
      leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS),
      startedAt: startedAt ?? now,
      errorMessage: null,
    },
  });

  return result.count === 1;
}

export async function renewExecutionLease(
  executionId: string,
  leaseToken: string
): Promise<boolean> {
  const now = new Date();

  const result = await prisma.automationExecution.updateMany({
    where: {
      id: executionId,
      status: "PROCESSING",
      leaseToken,
      leaseExpiresAt: {
        gt: now,
      },
    },
    data: {
      leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS),
    },
  });

  return result.count === 1;
}

export async function releaseExecutionLease(
  executionId: string,
  leaseToken: string
): Promise<void> {
  await prisma.automationExecution.updateMany({
    where: {
      id: executionId,
      status: "PROCESSING",
      leaseToken,
    },
    data: {
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
}

export async function recoverExpiredExecution(
  executionId: string
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const execution = await tx.automationExecution.findUnique({
      where: { id: executionId },
      select: {
        status: true,
        leaseToken: true,
        leaseExpiresAt: true,
        publicReplyStatus: true,
        privateReplyStatus: true,
      },
    });

    if (
      !execution ||
      execution.status !== "PROCESSING" ||
      !execution.leaseToken ||
      !execution.leaseExpiresAt ||
      execution.leaseExpiresAt > now
    ) {
      return false;
    }

    const result = await tx.automationExecution.updateMany({
      where: {
        id: executionId,
        status: "PROCESSING",
        leaseToken: execution.leaseToken,
        leaseExpiresAt: { lte: now },
        publicReplyStatus: execution.publicReplyStatus,
        privateReplyStatus: execution.privateReplyStatus,
      },
      data: {
        status: "PARTIAL",
        publicReplyStatus:
          execution.publicReplyStatus === "PROCESSING"
            ? "UNKNOWN"
            : execution.publicReplyStatus,
        privateReplyStatus:
          execution.privateReplyStatus === "PROCESSING"
            ? "UNKNOWN"
            : execution.privateReplyStatus,
        leaseToken: null,
        leaseExpiresAt: null,
        errorMessage:
          "Worker lease expired. Interrupted actions marked UNKNOWN to prevent duplicate Instagram requests.",
      },
    });

    return result.count === 1;
  });
}

export async function assertExecutionOwnership(
  executionId: string,
  leaseToken: string
): Promise<void> {
  const execution = await prisma.automationExecution.findFirst({
    where: {
      id: executionId,
      status: "PROCESSING",
      leaseToken,
      leaseExpiresAt: {
        gt: new Date(),
      },
    },
    select: { id: true },
  });

  if (!execution) {
    throw new Error(`Execution ownership lost: ${executionId}`);
  }
}
