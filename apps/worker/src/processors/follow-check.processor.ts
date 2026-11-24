import { Job, UnrecoverableError } from "bullmq";
import { prisma } from "@replyza/database";
import { decryptToken, interpolateVariables } from "@replyza/shared";
import type { FollowCheckJobData } from "../queues/follow-check.queue";
import { workerEnv } from "../config/env";
import {
  checkUserFollowsBusiness,
  sendDirectMessage,
  MetaApiError,
} from "../services/instagram-graph.service";

export async function processFollowCheckJob(
  job: Job<FollowCheckJobData>
): Promise<void> {
  const { executionId, igsid, instagramUserId } = job.data;
  console.log(`[FollowCheck] Processing follow check for execution ${executionId}, igsid: ${igsid}`);

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

  // Idempotency: if link delivery already succeeded, do not send duplicate DMs
  if (execution.followCheckStatus === "SUCCESS" || execution.status === "COMPLETED") {
    console.log(`[FollowCheck] Execution ${executionId} already completed or verified. Skipping duplicate.`);
    return;
  }

  const { automation } = execution;
  const { instagramAccount } = automation;

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
    throw new UnrecoverableError(
      `Sender ID mismatch: sender ${igsid} does not match original commenter ${execution.webhookEvent.commenterInstagramId}`
    );
  }

  // Mark follow check as in-progress
  await prisma.automationExecution.update({
    where: { id: executionId },
    data: {
      followCheckStatus: "PROCESSING",
    },
  });

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
        errorMessage: "Could not decrypt account access token",
      },
    });
    throw new UnrecoverableError("Could not decrypt account access token");
  }

  try {
    const followResult = await checkUserFollowsBusiness(igsid, accessToken);
    console.log(`[FollowCheck] User ${igsid} follow status: ${followResult.isFollowing}`);

    const firstName = followResult.name || execution.webhookEvent.commenterUsername;
    const username = followResult.username || execution.webhookEvent.commenterUsername;

    if (followResult.isFollowing) {
      // User is following! Deliver success message with link
      const baseText = automation.followSuccessText || "Thanks for following! Here is your link:";
      const message = interpolateVariables(
        automation.dmLink ? `${baseText}\n${automation.dmLink}` : baseText,
        {
          firstName,
          username,
          keyword: execution.webhookEvent.commentText,
          link: automation.dmLink,
        }
      );

      const messageId = await sendDirectMessage(instagramUserId, igsid, message, accessToken);

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          status: "COMPLETED",
          followCheckStatus: "SUCCESS",
          followCheckVerifiedAt: new Date(),
          metaFollowCheckReplyId: messageId,
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      console.log(`[FollowCheck] Success link sent to ${igsid} for execution ${executionId}`);
    } else {
      // User is not following yet! Send fallback copy with retry button
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

      await sendDirectMessage(instagramUserId, igsid, fallbackText, accessToken, retryQuickReply);

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "FAILED",
          followCheckRetryCount: { increment: 1 },
          errorMessage: "User is not following the account yet",
        },
      });

      console.log(`[FollowCheck] Fallback retry sent to ${igsid} for execution ${executionId}`);
    }
  } catch (error) {
    if (error instanceof MetaApiError && error.metaError?.code === 190) {
      console.error(
        `[FollowCheck] Meta returned Error 190 (access token invalid/expired) for execution ${executionId}. Marking Instagram account as NEEDS_RECONNECT.`
      );
      try {
        await prisma.instagramAccount.update({
          where: { id: instagramAccount.id },
          data: { status: "NEEDS_RECONNECT" },
        });
      } catch (dbErr) {
        console.error("[FollowCheck] Failed to set account status to NEEDS_RECONNECT:", dbErr);
      }

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          followCheckStatus: "FAILED",
          errorMessage: "Instagram access token expired or revoked by Meta (Error 190)",
        },
      });

      throw new UnrecoverableError("Instagram access token expired or revoked by Meta (Error 190)");
    }

    throw error;
  }
}
