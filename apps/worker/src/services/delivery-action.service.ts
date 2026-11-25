import { prisma } from "@replyza/database";

export type DeliveryActionKind =
  | "PUBLIC_REPLY"
  | "HOOK_DM"
  | "LINK_DM"
  | "FOLLOW_FALLBACK_DM";

export interface ClaimedDeliveryAction {
  id: string;
  attempts: number;
}

/**
 * Atomically claims a DeliveryAction row for sending using UPDATE ... WHERE status = 'PENDING' RETURNING.
 * Ensures the row exists first for backward compatibility with executions created before DeliveryAction.
 */
export async function claimDeliveryAction(
  executionId: string,
  actionType: DeliveryActionKind
): Promise<ClaimedDeliveryAction | null> {
  await prisma.deliveryAction.upsert({
    where: {
      executionId_actionType: {
        executionId,
        actionType,
      },
    },
    create: {
      executionId,
      actionType,
      status: "PENDING",
    },
    update: {},
  });

  const rows = await prisma.$queryRaw<ClaimedDeliveryAction[]>`
    UPDATE "delivery_actions"
    SET "status" = 'SENDING'::"DeliveryActionStatus",
        "attempts" = "attempts" + 1,
        "updatedAt" = NOW()
    WHERE "executionId" = ${executionId}::uuid
      AND "actionType" = ${actionType}::"DeliveryActionType"
      AND "status" = 'PENDING'::"DeliveryActionStatus"
    RETURNING "id", "attempts"
  `;

  return rows.length === 1 ? rows[0] : null;
}

export async function markDeliveryActionSent(
  executionId: string,
  actionType: DeliveryActionKind,
  metaId: string | null
): Promise<void> {
  const now = new Date();
  await prisma.deliveryAction.update({
    where: {
      executionId_actionType: {
        executionId,
        actionType,
      },
    },
    data: {
      status: "SENT",
      metaId,
      sentAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
}

export async function markDeliveryActionPendingForRetry(
  executionId: string,
  actionType: DeliveryActionKind,
  errorCode: string | null,
  errorMessage: string
): Promise<void> {
  await prisma.deliveryAction.updateMany({
    where: {
      executionId,
      actionType,
      status: "SENDING",
    },
    data: {
      status: "PENDING",
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
    },
  });
}

export async function markDeliveryActionFailed(
  executionId: string,
  actionType: DeliveryActionKind,
  errorCode: string | null,
  errorMessage: string
): Promise<void> {
  await prisma.deliveryAction.update({
    where: {
      executionId_actionType: {
        executionId,
        actionType,
      },
    },
    data: {
      status: "FAILED",
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
    },
  });
}

export async function markDeliveryActionSkipped(
  executionId: string,
  actionType: DeliveryActionKind
): Promise<void> {
  await prisma.deliveryAction.update({
    where: {
      executionId_actionType: {
        executionId,
        actionType,
      },
    },
    data: {
      status: "SKIPPED",
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
}

export async function markDeliveryActionNeedsReview(
  executionId: string,
  actionType: DeliveryActionKind,
  errorCode: string | null,
  errorMessage: string
): Promise<void> {
  await prisma.deliveryAction.update({
    where: {
      executionId_actionType: {
        executionId,
        actionType,
      },
    },
    data: {
      status: "NEEDS_REVIEW",
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
    },
  });
}

/**
 * Recomputes AutomationExecution summary fields from authoritative DeliveryAction rows
 * so independent parallel PUBLIC_REPLY and HOOK_DM jobs never overwrite each other.
 */
export async function syncExecutionFromDeliveryActions(
  executionId: string,
  webhookEventId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const actions = await tx.deliveryAction.findMany({
      where: {
        executionId,
        actionType: { in: ["PUBLIC_REPLY", "HOOK_DM"] },
      },
    });

    const pub = actions.find((a) => a.actionType === "PUBLIC_REPLY");
    const dm = actions.find((a) => a.actionType === "HOOK_DM");

    const mapToActionStatus = (
      s?: string
    ): "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "UNKNOWN" | "SKIPPED" | "RETRY_PENDING" => {
      switch (s) {
        case "SENT":
          return "SUCCESS";
        case "SENDING":
          return "PROCESSING";
        case "FAILED":
          return "FAILED";
        case "NEEDS_REVIEW":
          return "UNKNOWN";
        case "SKIPPED":
          return "SKIPPED";
        default:
          return "PENDING";
      }
    };

    const pubStatus = mapToActionStatus(pub?.status);
    const dmStatus = mapToActionStatus(dm?.status);

    let execStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED" | "RETRY_PENDING" = "PROCESSING";
    if (pubStatus === "SUCCESS" && dmStatus === "SUCCESS") {
      execStatus = "COMPLETED";
    } else if (pubStatus === "FAILED" && dmStatus === "FAILED") {
      execStatus = "FAILED";
    } else if (
      pubStatus === "PROCESSING" ||
      dmStatus === "PROCESSING" ||
      pubStatus === "PENDING" ||
      dmStatus === "PENDING"
    ) {
      execStatus = "PARTIAL";
    } else {
      execStatus = "PARTIAL";
    }

    const errors = [pub?.lastErrorMessage, dm?.lastErrorMessage].filter(Boolean);
    const isTerminal =
      pubStatus !== "PENDING" &&
      pubStatus !== "PROCESSING" &&
      dmStatus !== "PENDING" &&
      dmStatus !== "PROCESSING";

    await tx.automationExecution.update({
      where: { id: executionId },
      data: {
        publicReplyStatus: pubStatus,
        privateReplyStatus: dmStatus,
        metaReplyId: pub?.metaId ?? undefined,
        metaPrivateReplyId: dm?.metaId ?? undefined,
        status: execStatus,
        errorMessage: errors.length > 0 ? errors.join(" | ") : null,
        completedAt: isTerminal && pubStatus !== "UNKNOWN" && dmStatus !== "UNKNOWN" ? new Date() : null,
      },
    });

    if (isTerminal) {
      await tx.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: execStatus === "FAILED" ? "FAILED" : "PROCESSED",
          processedAt: new Date(),
        },
      });
    }
  });
}
