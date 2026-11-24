import { Job, UnrecoverableError } from "bullmq";
import { prisma } from "@replyza/database";
import { decryptToken, interpolateVariables } from "@replyza/shared";
import type { FollowCheckJobData } from "../queues/follow-check.queue";
import { workerEnv } from "../config/env";
import {
  checkUserFollowsBusiness,
  sendDirectMessage,
  MetaApiError,
  MetaApiUnknownOutcomeError,
} from "../services/instagram-graph.service";

const MAX_FOLLOW_RETRIES = 3;

async function markMessagingEventDone(
  instagramAccountId: string,
  providerEventId: string | undefined,
  status: "PROCESSED" | "FAILED"
) {
  if (!providerEventId) return;
  await prisma.messagingWebhookEvent
    .updateMany({
      where: {
        instagramAccountId,
        providerEventId,
      },
      data: {
        status,
        processedAt: new Date(),
      },
    })
    .catch(() => {});
}

export async function processFollowCheckJob(
  job: Job<FollowCheckJobData>
): Promise<void> {
  const { executionId, igsid, instagramUserId, providerEventId } = job.data;
  console.log(
    `[FollowCheck] Processing follow check | executionId=${executionId} igsid=${igsid} providerEventId=${providerEventId ?? "none"}`
  );

  const execution = await prisma.automationExecution.findUnique({
    where: { id: executionId },
    include: {
      automation: {
        include: {
          instagramAccount: true,
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

  // Idempotency: if link delivery already succeeded or is UNKNOWN, do not send duplicate DMs
  if (
    execution.followCheckStatus === "SUCCESS" ||
    execution.status === "COMPLETED"
  ) {
    console.log(
      `[FollowCheck] Execution ${executionId} already completed or verified. Skipping duplicate.`
    );
    await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
    return;
  }

  if (execution.followCheckStatus === "UNKNOWN") {
    console.warn(
      `[FollowCheck] Execution ${executionId} has UNKNOWN DM delivery outcome. Refusing blind resend.`
    );
    await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
    return;
  }

  // Cross-tenant verification: verify execution belongs to this Instagram account
  if (instagramAccount.instagramUserId !== instagramUserId) {
    throw new UnrecoverableError(
      `Cross-tenant execution attempt: account ${instagramUserId} does not own execution ${executionId}`
    );
  }

  // IDOR protection: verify sender matches original commenter
  if (
    execution.webhookEvent.commenterInstagramId &&
    execution.webhookEvent.commenterInstagramId !== igsid
  ) {
    await markMessagingEventDone(instagramAccount.id, providerEventId, "FAILED");
    throw new UnrecoverableError(
      `Sender ID mismatch: sender ${igsid} does not match original commenter ${execution.webhookEvent.commenterInstagramId}`
    );
  }

  // Atomic claim so concurrent button taps or workers cannot race
  const claimed = await prisma.automationExecution.updateMany({
    where: {
      id: executionId,
      followCheckStatus: { in: ["PENDING", "FAILED", "RETRY_PENDING"] },
    },
    data: {
      followCheckStatus: "PROCESSING",
      followCheckError: null,
    },
  });

  if (claimed.count !== 1) {
    console.log(
      `[FollowCheck] Execution ${executionId} could not be claimed (already PROCESSING or terminal).`
    );
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
        followCheckError: "Could not decrypt account access token",
        errorMessage: "Could not decrypt account access token",
      },
    });
    await markMessagingEventDone(instagramAccount.id, providerEventId, "FAILED");
    throw new UnrecoverableError("Could not decrypt account access token");
  }

  try {
    const followResult = await checkUserFollowsBusiness(igsid, accessToken);
    console.log(
      `[FollowCheck] Follow verification result | executionId=${executionId} igsid=${igsid} outcome=${followResult.outcome}`
    );

    if (
      followResult.outcome === "UNSUPPORTED" ||
      followResult.outcome === "PERMISSION_DENIED"
    ) {
      const msg =
        followResult.errorMessage ||
        `Follow verification is ${followResult.outcome.toLowerCase()} for this Instagram account.`;

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "FAILED",
          followVerificationOutcome: followResult.outcome,
          followCheckError: msg,
          errorMessage: msg,
        },
      });
      await markMessagingEventDone(instagramAccount.id, providerEventId, "FAILED");
      return;
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

    if (followResult.outcome === "UNKNOWN") {
      const msg =
        followResult.errorMessage ||
        "Uncertain follow verification response from Meta.";

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "UNKNOWN",
          followVerificationOutcome: "UNKNOWN",
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
      // User is verified as following! Deliver success message with link at most once.
      const baseText =
        automation.followSuccessText || "Thanks for following! Here is your link:";
      const message = interpolateVariables(
        automation.dmLink ? `${baseText}\n${automation.dmLink}` : baseText,
        {
          firstName,
          username,
          keyword: execution.webhookEvent.commentText,
          link: automation.dmLink,
        }
      );

      try {
        const messageId = await sendDirectMessage(
          instagramUserId,
          igsid,
          message,
          accessToken
        );

        await prisma.automationExecution.update({
          where: { id: executionId },
          data: {
            status: "COMPLETED",
            followCheckStatus: "SUCCESS",
            followVerificationOutcome: "VERIFIED",
            followCheckVerifiedAt: new Date(),
            metaFollowCheckReplyId: messageId,
            followCheckError: null,
            completedAt: new Date(),
            errorMessage: null,
          },
        });
        await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
        console.log(
          `[FollowCheck] Success link sent to ${igsid} | executionId=${executionId} messageId=${messageId}`
        );
      } catch (dmErr) {
        await handleDmSendFailure(
          executionId,
          instagramAccount.id,
          providerEventId,
          "VERIFIED",
          dmErr
        );
      }
      return;
    }

    // outcome === "NOT_FOLLOWING"
    if (execution.followCheckRetryCount >= MAX_FOLLOW_RETRIES) {
      const limitMsg = `User is not following after ${MAX_FOLLOW_RETRIES} verification attempts.`;
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "FAILED",
          followVerificationOutcome: "NOT_FOLLOWING",
          followCheckError: limitMsg,
          errorMessage: limitMsg,
        },
      });
      await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
      return;
    }

    const fallbackText = interpolateVariables(
      automation.followFallbackText ||
        "Looks like you aren't following us yet! Follow our profile and tap the button below to get your link.",
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
        payload: `FOLLOW_CHECK:${executionId}`,
      },
    ];

    try {
      await sendDirectMessage(
        instagramUserId,
        igsid,
        fallbackText,
        accessToken,
        retryQuickReply
      );

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "FAILED",
          followVerificationOutcome: "NOT_FOLLOWING",
          followCheckRetryCount: { increment: 1 },
          followCheckError: null,
          errorMessage: "User is not following the account yet",
        },
      });
      await markMessagingEventDone(instagramAccount.id, providerEventId, "PROCESSED");
      console.log(
        `[FollowCheck] Fallback retry sent to ${igsid} | executionId=${executionId}`
      );
    } catch (dmErr) {
      await handleDmSendFailure(
        executionId,
        instagramAccount.id,
        providerEventId,
        "NOT_FOLLOWING",
        dmErr
      );
    }
  } catch (error) {
    if (
      error instanceof MetaApiError &&
      (error.metaError?.code === 190 || error.category === "AUTH_EXPIRED")
    ) {
      console.error(
        `[FollowCheck] Meta returned Error 190 for execution ${executionId}. Marking NEEDS_RECONNECT.`
      );
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
          followCheckError: "Instagram access token expired or revoked by Meta (Error 190)",
          errorMessage: "Instagram access token expired or revoked by Meta (Error 190)",
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

async function handleDmSendFailure(
  executionId: string,
  instagramAccountId: string,
  providerEventId: string | undefined,
  verificationOutcome: "VERIFIED" | "NOT_FOLLOWING",
  dmErr: unknown
): Promise<void> {
  if (dmErr instanceof MetaApiUnknownOutcomeError) {
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
    if (dmErr.metaError?.code === 190 || dmErr.category === "AUTH_EXPIRED") {
      await prisma.instagramAccount
        .update({
          where: { id: instagramAccountId },
          data: { status: "NEEDS_RECONNECT" },
        })
        .catch(() => {});
    }

    if (dmErr.isTransient) {
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

    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        followCheckStatus: "FAILED",
        followVerificationOutcome: verificationOutcome,
        followCheckError: dmErr.message,
        errorMessage: dmErr.message,
      },
    });
    await markMessagingEventDone(instagramAccountId, providerEventId, "FAILED");
    return;
  }

  const msg =
    dmErr instanceof Error ? dmErr.message : "Unexpected DM delivery error";
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
