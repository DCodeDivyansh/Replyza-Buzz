import { Job, UnrecoverableError } from "bullmq";
import { prisma } from "@replyza/database";
import { decryptToken, interpolateVariables } from "@replyza/shared";
import type { FollowCheckJobData } from "../queues/follow-check.queue";
import { workerEnv } from "../config/env";
import {
  checkUserFollowsBusiness,
  sendDirectMessage,
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

  const { automation } = execution;
  const { instagramAccount } = automation;

  let accessToken: string;
  try {
    accessToken = decryptToken(
      instagramAccount.encryptedAccessToken,
      workerEnv.metaTokenEncryptionKey
    );
  } catch {
    throw new UnrecoverableError("Could not decrypt account access token");
  }

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

    await sendDirectMessage(instagramUserId, igsid, message, accessToken);

    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status: "COMPLETED",
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

    console.log(`[FollowCheck] Fallback retry sent to ${igsid} for execution ${executionId}`);
  }
}
