import { Job, UnrecoverableError } from "bullmq";
import { prisma } from "@replyza/database";
import {
  decryptToken,
  interpolateVariables,
  signFollowCheckPayload,
} from "@replyza/shared";
import type { FollowCheckJobData } from "../queues/follow-check.queue";
import { workerEnv } from "../config/env";
import {
  checkUserFollowsBusiness,
  sendDirectMessage,
  MetaApiError,
  MetaApiUnknownOutcomeError,
  type FollowCheckResult,
} from "../services/instagram-graph.service";
import {
  claimDeliveryAction,
  markDeliveryActionSent,
  markDeliveryActionPendingForRetry,
  markDeliveryActionFailed,
  markDeliveryActionNeedsReview,
} from "../services/delivery-action.service";
import {
  deliverProducts,
  type DeliverableProduct,
  type ProductDeliveryModeType,
} from "../services/product-delivery.service";

const MAX_FOLLOW_RETRIES = 3;
const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

function maskIgsid(igsid: string): string {
  if (igsid.length <= 8) return "***";
  return `${igsid.slice(0, 4)}...${igsid.slice(-4)}`;
}

async function markMessagingEventDone(
  instagramAccountId: string,
  providerEventId: string | undefined,
  status: "PROCESSED" | "FAILED"
) {
  if (!providerEventId) return;
  await prisma.messagingWebhookEvent
    .updateMany({
      where: { instagramAccountId, providerEventId },
      data: { status, processedAt: new Date() },
    })
    .catch(() => {});
}

export async function processFollowCheckJob(
  job: Job<FollowCheckJobData>
): Promise<void> {
  const { executionId, igsid, instagramUserId, providerEventId } = job.data;
  console.log(
    `[FollowCheck] Processing | executionId=${executionId} igsid=${maskIgsid(igsid)} mid=${providerEventId ?? "none"}`
  );

  const execution = await prisma.automationExecution.findUnique({
    where: { id: executionId },
    include: {
      automation: {
        include: {
          instagramAccount: true,
          products: { orderBy: { sortOrder: "asc" } },
        },
      },
      webhookEvent: true,
    },
  });

  if (!execution) {
    throw new UnrecoverableError(`Execution not found: ${executionId}`);
  }

  const { automation } = execution;
  const { instagramAccount } = automation;

  // Idempotency: if link delivery already succeeded or execution is terminal, do not send duplicate DMs.
  // An execution in AWAITING_TAP/TAPPED/FOLLOW_CHECKING/AWAITING_FOLLOW is still waiting for user action
  // even if initial hook delivery actions have completed.
  const isAwaitingUserAction =
    execution.conversationState === "AWAITING_TAP" ||
    execution.conversationState === "TAPPED" ||
    execution.conversationState === "FOLLOW_CHECKING" ||
    execution.conversationState === "AWAITING_FOLLOW";

  if (
    execution.followCheckStatus === "SUCCESS" ||
    execution.conversationState === "COMPLETED" ||
    (execution.status === "COMPLETED" && !isAwaitingUserAction) ||
    execution.conversationState === "EXPIRED_WINDOW" ||
    execution.conversationState === "NEEDS_RECONNECT" ||
    (execution.conversationState === "FAILED" &&
      execution.followCheckRetryCount >= MAX_FOLLOW_RETRIES)
  ) {
    console.log(
      `[FollowCheck] Terminal/already-handled execution skipped | executionId=${executionId} state=${execution.conversationState} followStatus=${execution.followCheckStatus}`
    );
    await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
    return;
  }

  // Check if LINK_DM was already sent or is in an uncertain/crashed state (NEEDS_REVIEW / SENDING)
  const existingLinkAction = await prisma.deliveryAction.findUnique({
    where: {
      executionId_actionType: {
        executionId,
        actionType: "LINK_DM",
      },
    },
    select: { status: true },
  });

  if (existingLinkAction) {
    if (existingLinkAction.status === "SENT") {
      await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
      return;
    }
    if (
      existingLinkAction.status === "NEEDS_REVIEW" ||
      existingLinkAction.status === "SENDING"
    ) {
      if (existingLinkAction.status === "SENDING") {
        await markDeliveryActionNeedsReview(
          executionId,
          "LINK_DM",
          "CRASHED_SENDING",
          "Worker interrupted during link DM send; blocked duplicate resend"
        ).catch(() => {});
      }
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "UNKNOWN",
          followCheckError: "Link DM outcome uncertain; blocked duplicate resend",
        },
      });
      await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
      return;
    }
  }

  // Check 24-hour messaging window before calling Meta
  const windowAnchor = execution.followCheckSentAt ?? execution.createdAt;
  if (Date.now() - windowAnchor.getTime() > MESSAGING_WINDOW_MS) {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        followCheckStatus: "FAILED",
        conversationState: "EXPIRED_WINDOW",
        followCheckError: "24-hour Instagram messaging window expired",
        errorMessage: "24-hour Instagram messaging window expired",
      },
    });
    await markMessagingEventDone(instagramAccount.id, providerEventId, "FAILED");
    return;
  }

  // Cross-tenant & IDOR verification
  if (instagramAccount.instagramUserId !== instagramUserId) {
    throw new UnrecoverableError(
      `Cross-tenant execution attempt: account ${instagramUserId} does not own execution ${executionId}`
    );
  }

  if (
    execution.webhookEvent.commenterInstagramId &&
    execution.webhookEvent.commenterInstagramId !== igsid
  ) {
    await markMessagingEventDone(instagramAccount.id, providerEventId, "FAILED");
    throw new UnrecoverableError(
      `Sender ID mismatch: sender ${maskIgsid(igsid)} does not match original commenter`
    );
  }

  // Atomic claim so concurrent taps/workers cannot race.
  // Note: UNKNOWN from an earlier verification API failure is retryable by the user,
  // while LINK_DM uncertainty is already blocked above via DeliveryAction status.
  const claimed = await prisma.automationExecution.updateMany({
    where: {
      id: executionId,
      followCheckStatus: { in: ["PENDING", "FAILED", "RETRY_PENDING", "UNKNOWN"] },
    },
    data: {
      followCheckStatus: "PROCESSING",
      conversationState: automation.followRequired ? "FOLLOW_CHECKING" : "TAPPED",
      followCheckError: null,
      ...(providerEventId && !execution.tapEventMid ? { tapEventMid: providerEventId } : {}),
    },
  });

  if (claimed.count !== 1) {
    return;
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(
      instagramAccount.encryptedAccessToken,
      workerEnv.metaTokenEncryptionKey
    );
  } catch {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        followCheckStatus: "FAILED",
        conversationState: "FAILED",
        followCheckError: "Could not decrypt account access token",
        errorMessage: "Could not decrypt account access token",
      },
    });
    await markMessagingEventDone(instagramAccount.id, providerEventId, "FAILED");
    throw new UnrecoverableError("Could not decrypt account access token");
  }

  try {
    // When followRequired is FALSE, skip follower verification and deliver the link DM directly
    if (!automation.followRequired) {
      await deliverLinkDm({
        executionId,
        instagramAccountId: instagramAccount.id,
        instagramUserId,
        igsid,
        providerEventId,
        accessToken,
        baseText: automation.dmMessageText,
        dmLink: automation.dmLink,
        products: automation.products,
        productDeliveryMode: automation.productDeliveryMode,
        productIntroText: automation.productIntroText,
        productClosingText: automation.productClosingText,
        followUpEnabled: automation.followUpEnabled,
        followUpText: automation.followUpText,
        selectedProductIndex: job.data.selectedProductIndex,
        firstName: execution.webhookEvent.commenterUsername,
        username: execution.webhookEvent.commenterUsername,
        keyword: execution.webhookEvent.commentText,
        verificationOutcome: "SKIPPED_NO_GATE",
      });
      return;
    }

    // FollowRequired = TRUE: check follower status, retrying once on unknown/transient before fallback
    let followResult: FollowCheckResult = await checkUserFollowsBusiness(
      igsid,
      accessToken
    );

    if (
      followResult.outcome === "TRANSIENT_ERROR" ||
      followResult.outcome === "UNKNOWN"
    ) {
      await new Promise((r) => setTimeout(r, 300));
      followResult = await checkUserFollowsBusiness(igsid, accessToken);
    }

    if (followResult.outcome === "TRANSIENT_ERROR") {
      const msg =
        followResult.errorMessage ||
        "Temporary Meta API error during follow verification.";
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "RETRY_PENDING",
          followVerificationOutcome: "TRANSIENT_ERROR",
          followCheckError: msg,
        },
      });
      throw new Error(msg);
    }

    if (
      followResult.outcome === "UNSUPPORTED" ||
      followResult.outcome === "PERMISSION_DENIED" ||
      followResult.outcome === "UNKNOWN"
    ) {
      const msg =
        followResult.errorMessage ||
        `Follow verification is ${followResult.outcome.toLowerCase()} for this interaction.`;

      // Send neutral polite message (never treat unknown/unsupported as NOT_FOLLOWING!)
      await sendDirectMessage(
        instagramUserId,
        igsid,
        "I couldn't verify right now, please try again in a minute.",
        accessToken
      ).catch(() => {});

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus:
            followResult.outcome === "UNKNOWN" ? "UNKNOWN" : "FAILED",
          followVerificationOutcome: followResult.outcome,
          conversationState: "AWAITING_FOLLOW",
          followCheckError: msg,
          errorMessage: msg,
        },
      });
      await markMessagingEventDone(instagramAccount.id, providerEventId, "FAILED");
      return;
    }

    const firstName = followResult.name || execution.webhookEvent.commenterUsername;
    const username = followResult.username || execution.webhookEvent.commenterUsername;

    if (followResult.outcome === "VERIFIED" && followResult.isFollowing) {
      await deliverLinkDm({
        executionId,
        instagramAccountId: instagramAccount.id,
        instagramUserId,
        igsid,
        providerEventId,
        accessToken,
        baseText:
          automation.followSuccessText ||
          "Thanks for following! Here is your link:",
        dmLink: automation.dmLink,
        products: automation.products,
        productDeliveryMode: automation.productDeliveryMode,
        productIntroText: automation.productIntroText,
        productClosingText: automation.productClosingText,
        followUpEnabled: automation.followUpEnabled,
        followUpText: automation.followUpText,
        selectedProductIndex: job.data.selectedProductIndex,
        firstName,
        username,
        keyword: execution.webhookEvent.commentText,
        verificationOutcome: "VERIFIED",
      });
      return;
    }

    // outcome === "NOT_FOLLOWING"
    if (execution.followCheckRetryCount >= MAX_FOLLOW_RETRIES) {
      const limitMsg = `User is not following after ${MAX_FOLLOW_RETRIES} verification attempts.`;
      await sendDirectMessage(
        instagramUserId,
        igsid,
        "We still couldn't confirm a follow after multiple checks. Feel free to follow anytime and comment again later!",
        accessToken
      ).catch(() => {});
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "FAILED",
          followVerificationOutcome: "NOT_FOLLOWING",
          conversationState: "FAILED",
          followCheckError: limitMsg,
          errorMessage: limitMsg,
        },
      });
      await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
      return;
    }

    const fallbackText = interpolateVariables(
      automation.followFallbackText ||
        "Looks like you aren't following us yet! Follow our profile and tap the button below (or reply CHECK) to get your link.",
      {
        firstName,
        username,
        keyword: execution.webhookEvent.commentText,
        link: automation.dmLink,
      }
    );

    const retryQuickReply = [
      {
        content_type: "text" as const,
        title: "I've followed! ✅",
        payload: signFollowCheckPayload(executionId, workerEnv.sessionSecret),
      },
    ];

    try {
      const fallbackAction = await claimDeliveryAction(
        executionId,
        "FOLLOW_FALLBACK_DM"
      );
      const fallbackMsgId = await sendDirectMessage(
        instagramUserId,
        igsid,
        fallbackText,
        accessToken,
        retryQuickReply
      );
      if (fallbackAction) {
        await markDeliveryActionSent(
          executionId,
          "FOLLOW_FALLBACK_DM",
          fallbackMsgId
        );
      }

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "FAILED",
          followVerificationOutcome: "NOT_FOLLOWING",
          conversationState: "AWAITING_FOLLOW",
          followCheckRetryCount: { increment: 1 },
          followCheckError: null,
          errorMessage: "User is not following the account yet",
        },
      });
      await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
    } catch (dmErr) {
      await handleDmSendFailure(
        executionId,
        instagramAccount.id,
        providerEventId,
        "NOT_FOLLOWING",
        "FOLLOW_FALLBACK_DM",
        dmErr
      );
    }
  } catch (error) {
    if (
      error instanceof MetaApiError &&
      (error.metaError?.code === 190 || error.category === "AUTH_EXPIRED")
    ) {
      await prisma.instagramAccount
        .update({
          where: { id: instagramAccount.id },
          data: { status: "NEEDS_RECONNECT" },
        })
        .catch(() => {});

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "FAILED",
          conversationState: "NEEDS_RECONNECT",
          followCheckError:
            "Instagram access token expired or revoked by Meta (Error 190)",
          errorMessage:
            "Instagram access token expired or revoked by Meta (Error 190)",
        },
      });
      await markMessagingEventDone(instagramAccount.id, providerEventId, "FAILED");
      throw new UnrecoverableError(
        "Instagram access token expired or revoked by Meta (Error 190)"
      );
    }

    throw error;
  }
}

async function deliverLinkDm(params: {
  executionId: string;
  instagramAccountId: string;
  instagramUserId: string;
  igsid: string;
  providerEventId?: string;
  accessToken: string;
  baseText: string;
  dmLink?: string | null;
  products: DeliverableProduct[];
  productDeliveryMode: ProductDeliveryModeType;
  productIntroText?: string | null;
  productClosingText?: string | null;
  followUpEnabled?: boolean;
  followUpText?: string | null;
  selectedProductIndex?: number;
  firstName?: string | null;
  username?: string | null;
  keyword: string;
  verificationOutcome: string;
}): Promise<void> {
  const claimedLink = await claimDeliveryAction(params.executionId, "LINK_DM");
  if (!claimedLink) {
    await markMessagingEventDone(
      params.instagramAccountId,
      params.providerEventId,
      "PROCESSED"
    );
    return;
  }

  try {
    const messageId = await deliverProducts({
      executionId: params.executionId,
      instagramUserId: params.instagramUserId,
      accessToken: params.accessToken,
      isPrivateReply: false,
      recipientIgsid: params.igsid,
      baseText: params.baseText,
      dmLink: params.dmLink,
      products: params.products,
      productDeliveryMode: params.productDeliveryMode,
      productIntroText: params.productIntroText,
      productClosingText: params.productClosingText,
      followUpEnabled: params.followUpEnabled,
      followUpText: params.followUpText,
      selectedProductIndex: params.selectedProductIndex,
      baseContext: {
        firstName: params.firstName,
        username: params.username,
        keyword: params.keyword,
        link: params.dmLink,
      },
    });

    await markDeliveryActionSent(params.executionId, "LINK_DM", messageId);
    await prisma.automationExecution.update({
      where: { id: params.executionId },
      data: {
        status: "COMPLETED",
        followCheckStatus: "SUCCESS",
        followVerificationOutcome: params.verificationOutcome,
        conversationState: "COMPLETED",
        followCheckVerifiedAt: new Date(),
        metaFollowCheckReplyId: messageId,
        followCheckError: null,
        completedAt: new Date(),
        errorMessage: null,
      },
    });
    await markMessagingEventDone(
      params.instagramAccountId,
      params.providerEventId,
      "PROCESSED"
    );
  } catch (dmErr) {
    await handleDmSendFailure(
      params.executionId,
      params.instagramAccountId,
      params.providerEventId,
      params.verificationOutcome,
      "LINK_DM",
      dmErr
    );
  }
}

async function handleDmSendFailure(
  executionId: string,
  instagramAccountId: string,
  providerEventId: string | undefined,
  verificationOutcome: string,
  actionKind: "LINK_DM" | "FOLLOW_FALLBACK_DM",
  dmErr: unknown
): Promise<void> {
  if (dmErr instanceof MetaApiUnknownOutcomeError) {
    await markDeliveryActionNeedsReview(
      executionId,
      actionKind,
      "UNKNOWN",
      dmErr.message
    ).catch(() => {});
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        followCheckStatus: "UNKNOWN",
        followVerificationOutcome: verificationOutcome,
        followCheckError: dmErr.message,
        errorMessage: dmErr.message,
      },
    });
    await markMessagingEventDone(instagramAccountId, providerEventId, "FAILED");
    return;
  }

  if (dmErr instanceof MetaApiError) {
    const code = dmErr.metaError?.code
      ? String(dmErr.metaError.code)
      : String(dmErr.httpStatus);

    if (dmErr.metaError?.code === 190 || dmErr.category === "AUTH_EXPIRED") {
      await prisma.instagramAccount
        .update({
          where: { id: instagramAccountId },
          data: { status: "NEEDS_RECONNECT" },
        })
        .catch(() => {});
    }

    if (dmErr.isTransient) {
      await markDeliveryActionPendingForRetry(
        executionId,
        actionKind,
        code,
        dmErr.message
      ).catch(() => {});
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "RETRY_PENDING",
          followVerificationOutcome: verificationOutcome,
          followCheckError: dmErr.message,
        },
      });
      throw dmErr;
    }

    const isWindowExpired = dmErr.category === "MESSAGING_WINDOW_EXPIRED";
    await markDeliveryActionFailed(
      executionId,
      actionKind,
      code,
      dmErr.message
    ).catch(() => {});
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        followCheckStatus: "FAILED",
        followVerificationOutcome: verificationOutcome,
        conversationState: isWindowExpired ? "EXPIRED_WINDOW" : "FAILED",
        followCheckError: dmErr.message,
        errorMessage: dmErr.message,
      },
    });
    await markMessagingEventDone(instagramAccountId, providerEventId, "FAILED");
    return;
  }

  const msg =
    dmErr instanceof Error ? dmErr.message : "Unexpected DM delivery error";
  await markDeliveryActionNeedsReview(executionId, actionKind, "UNKNOWN", msg).catch(() => {});
  await prisma.automationExecution.update({
    where: { id: executionId },
    data: {
      followCheckStatus: "UNKNOWN",
      followVerificationOutcome: verificationOutcome,
      followCheckError: msg,
      errorMessage: msg,
    },
  });
  await markMessagingEventDone(instagramAccountId, providerEventId, "FAILED");
}
