
import { Job, UnrecoverableError } from "bullmq";
import { randomUUID } from "node:crypto";
import { prisma } from "@replyza/database";
import {
  decryptToken,
  interpolateVariables,
  signFollowCheckPayload,
} from "@replyza/shared";

import type { AutomationJobData } from "../queues/automation.queue";

import { workerEnv } from "../config/env";
import {
  claimDeliveryAction,
  markDeliveryActionSent,
  markDeliveryActionPendingForRetry,
  markDeliveryActionFailed,
  markDeliveryActionNeedsReview,
  syncExecutionFromDeliveryActions,
} from "../services/delivery-action.service";

import {
  claimAction,
  completePublicReply,
  completePrivateReply,
  markActionFailed,
  markActionUnknown,
  markActionRetryPending,
  reconcileActionSuccess,
} from "../services/action-state.service";

import {
  claimExecution,
  renewExecutionLease,
  releaseExecutionLease,
  releaseExecutionForRetry,
  recoverExpiredExecution,
  assertExecutionOwnership,
} from "../services/execution-lease.service";

import {
  publishCommentReply,
  sendPrivateReply,
  sendPrivateReplyWithQuickReply,
  reconcileCommentReply,
  MetaApiError,
  MetaApiUnknownOutcomeError,
} from "../services/instagram-graph.service";

type ActionResult =
  | "SUCCESS"
  | "FAILED"
  | "UNKNOWN"
  | "SKIPPED"
  | "BLOCKED"
  | "RETRY_PENDING";


async function executeAction(
  executionId: string,
  leaseToken: string,
  action: "public" | "private",
  isLeaseLost: () => boolean,
  send: () => Promise<string>,
  save: (resultId: string) => Promise<void>,
  reconcile?: () => Promise<string | null>
): Promise<ActionResult> {
  await assertExecutionOwnership(executionId, leaseToken);

  if (isLeaseLost()) {
    throw new Error("Execution lease lost; refusing to send action");
  }

  const claimed = await claimAction(
    executionId,
    action,
    leaseToken
  );

  if (!claimed) {
    const current = await prisma.automationExecution.findUnique({
      where: { id: executionId },
      select: {
        publicReplyStatus: true,
        privateReplyStatus: true,
      },
    });

    if (!current) {
      throw new Error(`Execution disappeared: ${executionId}`);
    }

    const currentStatus =
      action === "public"
        ? current.publicReplyStatus
        : current.privateReplyStatus;

    console.log(
      `[Worker] ${action} action was not claimed. State: ${currentStatus} | executionId=${executionId}`
    );

    if (currentStatus === "UNKNOWN") {
      if (reconcile) {
        const reconciledId = await reconcile();
        if (reconciledId) {
          const reconciled = await reconcileActionSuccess(
            executionId,
            action,
            leaseToken,
            reconciledId
          );
          if (reconciled) {
            console.log(
              `[Worker] Reconciled UNKNOWN ${action} action as SUCCESS (${reconciledId}) | executionId=${executionId}`
            );
            return "SUCCESS";
          }
        }
      }
      console.warn(
        `[Worker] ${action} action remains UNKNOWN. Automatic resend prevented to avoid duplicates | executionId=${executionId}`
      );
      return "UNKNOWN";
    }

    if (currentStatus === "PROCESSING" || currentStatus === "PENDING") {
      console.warn(
        `[Worker] ${action} action is unresolved (${currentStatus}). Automatic resend prevented | executionId=${executionId}`
      );

      return "BLOCKED";
    }

    if (currentStatus === "CANCELLED") {
      return "SKIPPED";
    }

    return currentStatus;
  }

  try {
    // Verify ownership immediately before contacting Meta.
    await assertExecutionOwnership(executionId, leaseToken);

    if (isLeaseLost()) {
      throw new Error("Execution lease lost; refusing to send action");
    }

    const resultId = await send();

    // The save operation also verifies the lease token.
    await save(resultId);

    console.log(
      `[Worker] ${action} action completed (${resultId}) | executionId=${executionId}`
    );

    return "SUCCESS";
  } catch (error) {
    if (error instanceof MetaApiError) {
      // Meta error code 190 indicates expired or invalidated OAuth token:
      // https://developers.facebook.com/documentation/instagram-platform/support/error-handling
      if (error.metaError?.code === 190 || error.category === "AUTH_EXPIRED") {
        console.error(
          `[Worker] Meta returned Error 190 (access token invalid/expired) for execution ${executionId}. Marking Instagram account as NEEDS_RECONNECT.`
        );
        try {
          const exec = await prisma.automationExecution.findUnique({
            where: { id: executionId },
            select: { automation: { select: { instagramAccountId: true } } },
          });
          if (exec?.automation.instagramAccountId) {
            await prisma.instagramAccount.update({
              where: { id: exec.automation.instagramAccountId },
              data: { status: "NEEDS_RECONNECT" },
            });
          }
        } catch (dbErr) {
          console.error("[Worker] Failed to set account status to NEEDS_RECONNECT:", dbErr);
        }

        await markActionFailed(
          executionId,
          action,
          leaseToken,
          "Instagram access token expired or revoked by Meta (Error 190). Please reconnect your account."
        );
        return "FAILED";
      }

      if (error.isTransient) {
        await markActionRetryPending(
          executionId,
          action,
          leaseToken,
          error.message
        );
        console.warn(
          `[Worker] ${action} action transient failure (${error.category}); marked RETRY_PENDING | executionId=${executionId}: ${error.message}`
        );
        return "RETRY_PENDING";
      }

      await markActionFailed(
        executionId,
        action,
        leaseToken,
        error.message
      );

      console.error(
        `[Worker] ${action} action permanently rejected by Meta (${error.category}) | executionId=${executionId}:`,
        error.message
      );

      return "FAILED";
    }

    const reason =
      error instanceof MetaApiUnknownOutcomeError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unexpected error; action outcome is uncertain.";

    await markActionUnknown(
      executionId,
      action,
      leaseToken,
      reason
    );

    console.error(
      `[Worker] ${action} action outcome UNKNOWN | executionId=${executionId}:`,
      reason
    );

    return "UNKNOWN";
  }
}



async function finalizeExecution(
  executionId: string,
  webhookEventId: string,
  leaseToken: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const execution = await tx.automationExecution.findFirst({
      where: {
        id: executionId,
        status: "PROCESSING",
        leaseToken,
        leaseExpiresAt: {
          gt: new Date(),
        },
      },
      select: {
        publicReplyStatus: true,
        privateReplyStatus: true,
      },
    });

    if (!execution) {
      throw new Error(
        `Cannot finalize execution; ownership lost: ${executionId}`
      );
    }

    const publicStatus = execution.publicReplyStatus;
    const privateStatus = execution.privateReplyStatus;

    let finalStatus: "COMPLETED" | "PARTIAL" | "FAILED" | "RETRY_PENDING";

    if (
      publicStatus === "RETRY_PENDING" ||
      privateStatus === "RETRY_PENDING"
    ) {
      finalStatus = "RETRY_PENDING";
    } else if (
      publicStatus === "SUCCESS" &&
      privateStatus === "SUCCESS"
    ) {
      finalStatus = "COMPLETED";
    } else if (
      publicStatus === "SUCCESS" ||
      privateStatus === "SUCCESS" ||
      publicStatus === "UNKNOWN" ||
      privateStatus === "UNKNOWN" ||
      publicStatus === "PROCESSING" ||
      privateStatus === "PROCESSING" ||
      publicStatus === "PENDING" ||
      privateStatus === "PENDING"
    ) {
      finalStatus = "PARTIAL";
    } else {
      finalStatus = "FAILED";
    }

    const hasUncertainOutcome =
      publicStatus === "UNKNOWN" || privateStatus === "UNKNOWN";

    const updated = await tx.automationExecution.updateMany({
      where: {
        id: executionId,
        status: "PROCESSING",
        leaseToken,
        leaseExpiresAt: {
          gt: new Date(),
        },
      },
      data: {
        status: finalStatus,
        completedAt:
          finalStatus === "RETRY_PENDING" || hasUncertainOutcome
            ? null
            : new Date(),
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });

    if (updated.count !== 1) {
      throw new Error(
        `Execution ownership lost during finalization: ${executionId}`
      );
    }

    if (finalStatus !== "RETRY_PENDING") {
      await tx.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: finalStatus === "FAILED" ? "FAILED" : "PROCESSED",
          processedAt: new Date(),
        },
      });
    }

    console.log(
      `[Worker] Execution finalized: executionId=${executionId} webhookEventId=${webhookEventId} | ` +
      `Public: ${publicStatus} | ` +
      `Private: ${privateStatus} | ` +
      `Final: ${finalStatus}`
    );
  });
}



export async function processAutomationJob(
  job: Job<AutomationJobData>
): Promise<void> {
  if (job.data.actionType === "PUBLIC_REPLY" || job.data.actionType === "HOOK_DM") {
    return processIndependentActionJob(job.data);
  }

  const { executionId, automationId, webhookEventId } = job.data;

  console.log(`[Worker] Processing execution: ${executionId}`);

  let execution = await prisma.automationExecution.findUnique({
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
    throw new UnrecoverableError(
      `Execution not found: ${executionId}`
    );
  }

  if (
    execution.automationId !== automationId ||
    execution.webhookEventId !== webhookEventId
  ) {
    throw new UnrecoverableError(
      "Job IDs do not match the execution record"
    );
  }

  if (
    execution.status === "COMPLETED" ||
    execution.status === "FAILED" ||
    execution.status === "CANCELLED"
  ) {
    console.log(
      `[Worker] Execution already terminal: ${execution.status} | executionId=${executionId}`
    );
    return;
  }

  // Recover an abandoned execution only after its lease expires.
  if (execution.status === "PROCESSING") {
    const recovered = await recoverExpiredExecution(executionId);

    if (!recovered) {
      console.log(
        `[Worker] Execution still owned by another worker: ${executionId}`
      );
      return;
    }

    execution = await prisma.automationExecution.findUnique({
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

    if (!execution || execution.status !== "PARTIAL") {
      return;
    }

    console.warn(
      `[Worker] Recovered expired execution: ${executionId}`
    );
  }

  const { automation, webhookEvent } = execution;
  const account = automation.instagramAccount;

  if (
    automation.instagramAccountId !== webhookEvent.instagramAccountId ||
    automation.mediaId !== webhookEvent.mediaId ||
    account.id !== webhookEvent.instagramAccountId
  ) {
    throw new UnrecoverableError(
      "Automation, account and webhook event do not match"
    );
  }

  const leaseToken = randomUUID();

  const claimed = await claimExecution(
    executionId,
    leaseToken,
    execution.startedAt
  );

  if (!claimed) {
    console.log(
      `[Worker] Could not claim execution: ${executionId}`
    );
    return;
  }

  console.log(
    `[Worker] Execution ownership acquired: ${executionId}`
  );

  let leaseLost = false;
  let renewalInFlight = false;

  // Renew the database lease every 30 seconds.
  const heartbeat = setInterval(async () => {
    if (renewalInFlight || leaseLost) return;

    renewalInFlight = true;

    try {
      const renewed = await renewExecutionLease(
        executionId,
        leaseToken
      );

      if (!renewed) {
        leaseLost = true;
        console.error(
          `[Worker] Execution lease lost: ${executionId}`
        );
      }
    } catch (error) {
      leaseLost = true;
      console.error(
        `[Worker] Lease renewal failed: ${executionId}`,
        error
      );
    } finally {
      renewalInFlight = false;
    }
  }, 30_000);

  try {
    if (automation.status !== "ACTIVE") {
      const stopped = await prisma.automationExecution.updateMany({
        where: {
          id: executionId,
          status: "PROCESSING",
          leaseToken,
          leaseExpiresAt: { gt: new Date() },
        },
        data: {
          status: "FAILED",
          publicReplyStatus:
            execution.publicReplyStatus === "PENDING"
              ? "SKIPPED"
              : execution.publicReplyStatus,
          privateReplyStatus:
            execution.privateReplyStatus === "PENDING"
              ? "SKIPPED"
              : execution.privateReplyStatus,
          errorMessage: `Automation is ${automation.status}; processing skipped`,
          completedAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });

      if (stopped.count !== 1) {
        throw new Error(
          `Could not stop inactive automation: ${executionId}`
        );
      }

      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });

      throw new UnrecoverableError(
        `Automation is not active: ${automation.status}`
      );
    }

    await assertExecutionOwnership(executionId, leaseToken);

    // Decrypt the connected Instagram account token.
    let accessToken: string;

    try {
      accessToken = decryptToken(
        account.encryptedAccessToken,
        workerEnv.metaTokenEncryptionKey
      );
    } catch {
      const failed = await prisma.automationExecution.updateMany({
        where: {
          id: executionId,
          status: "PROCESSING",
          leaseToken,
          leaseExpiresAt: { gt: new Date() },
        },
        data: {
          status: "FAILED",
          errorMessage: "Instagram access token decryption failed",
          publicReplyStatus:
            execution.publicReplyStatus === "PENDING"
              ? "SKIPPED"
              : execution.publicReplyStatus,
          privateReplyStatus:
            execution.privateReplyStatus === "PENDING"
              ? "SKIPPED"
              : execution.privateReplyStatus,
          completedAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });

      if (failed.count !== 1) {
        throw new Error(
          `Could not persist token decryption failure: ${executionId}`
        );
      }

      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: "FAILED" },
      });

      throw new UnrecoverableError(
        "Could not decrypt the Instagram access token"
      );
    }

    if (!accessToken) {
      throw new UnrecoverableError(
        "Instagram access token is empty"
      );
    }

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "PROCESSING" },
    });

    // Variable interpolation context
    const variableContext = {
      firstName: webhookEvent.commenterUsername,
      username: webhookEvent.commenterUsername,
      keyword: webhookEvent.commentText,
      link: automation.dmLink,
    };

    const interpolatedPublicReply = interpolateVariables(
      automation.publicReplyText,
      variableContext
    );

    // Action 1: Public comment reply.
    const publicResult = await executeAction(
      executionId,
      leaseToken,
      "public",
      () => leaseLost,
      () =>
        publishCommentReply(
          webhookEvent.commentId,
          interpolatedPublicReply,
          accessToken
        ),
      (replyId) =>
        completePublicReply(
          executionId,
          leaseToken,
          replyId
        ),
      () =>
        reconcileCommentReply(
          webhookEvent.commentId,
          interpolatedPublicReply,
          account.instagramUserId,
          accessToken
        )
    );

    if (leaseLost) {
      throw new Error(
        `Execution lease lost after public action: ${executionId}`
      );
    }

    // Action 2: Private Instagram reply.
    let privateActionSender: () => Promise<string>;

    if (automation.followRequired || automation.deliveryMode === "BUTTON") {
      const instructionText = interpolateVariables(
        automation.followRequired
          ? automation.followInstructionText ||
              "Hey {{first_name}}! Thanks for commenting. Follow our page and tap the button below to get your link instantly! 👇\n\n(On desktop? Reply LINK to get it)"
          : `${automation.dmMessageText}\n\nTap below or reply LINK to get it 👇`,
        variableContext
      );
      const buttonTitle = (
        automation.buttonLabel ||
        (automation.followRequired ? "I've followed! ✅" : "Send me the link")
      ).slice(0, 20);
      const quickReplies = [
        {
          content_type: "text" as const,
          title: buttonTitle,
          payload: signFollowCheckPayload(executionId, workerEnv.sessionSecret),
        },
      ];
      privateActionSender = () =>
        sendPrivateReplyWithQuickReply(
          account.instagramUserId,
          webhookEvent.commentId,
          instructionText,
          quickReplies,
          accessToken
        );
    } else {
      const baseDm = interpolateVariables(
        automation.dmMessageText,
        variableContext
      );
      const privateMessage = automation.dmLink
        ? `${baseDm}\n${automation.dmLink}`
        : baseDm;

      privateActionSender = () =>
        sendPrivateReply(
          account.instagramUserId,
          webhookEvent.commentId,
          privateMessage,
          accessToken
        );
    }

    const privateResult = await executeAction(
      executionId,
      leaseToken,
      "private",
      () => leaseLost,
      privateActionSender,
      (messageId) =>
        completePrivateReply(
          executionId,
          leaseToken,
          messageId
        )
    );

    if (leaseLost) {
      throw new Error(
        `Execution lease lost after private action: ${executionId}`
      );
    }

    if (privateResult === "BLOCKED") {
      console.warn(
        `[Worker] Private action blocked: ${executionId}`
      );
    }

    if ((automation.followRequired || automation.deliveryMode === "BUTTON") && privateResult === "SUCCESS") {
      await prisma.automationExecution.updateMany({
        where: {
          id: executionId,
          leaseToken,
          leaseExpiresAt: { gt: new Date() },
        },
        data: {
          followCheckStatus: "PENDING",
          followCheckSentAt: new Date(),
          conversationState: "AWAITING_TAP",
        },
      });
    }

    if (publicResult === "RETRY_PENDING" || privateResult === "RETRY_PENDING") {
      await releaseExecutionForRetry(
        executionId,
        leaseToken,
        "Transient Meta API error; execution scheduled for BullMQ retry"
      );
      throw new Error(
        `Transient Meta API failure during execution ${executionId}; retrying via BullMQ`
      );
    }

    await finalizeExecution(
      executionId,
      webhookEventId,
      leaseToken
    );
  } finally {
    clearInterval(heartbeat);

    if (!leaseLost) {
      await releaseExecutionLease(
        executionId,
        leaseToken
      ).catch((error) => {
        console.error(
          `[Worker] Could not release execution lease: ${executionId}`,
          error
        );
      });
    }
  }
}

async function processIndependentActionJob(
  data: AutomationJobData
): Promise<void> {
  const { executionId, automationId, webhookEventId, actionType } = data;
  if (!actionType) return;

  const execution = await prisma.automationExecution.findUnique({
    where: { id: executionId },
    include: {
      automation: {
        include: { instagramAccount: true },
      },
      webhookEvent: true,
    },
  });

  if (!execution) {
    throw new UnrecoverableError(`Execution not found: ${executionId}`);
  }
  if (
    execution.automationId !== automationId ||
    execution.webhookEventId !== webhookEventId
  ) {
    throw new UnrecoverableError("Job IDs do not match execution record");
  }

  const { automation, webhookEvent } = execution;
  const account = automation.instagramAccount;

  if (automation.status !== "ACTIVE" || account.status === "NEEDS_RECONNECT") {
    await markDeliveryActionFailed(
      executionId,
      actionType,
      account.status === "NEEDS_RECONNECT" ? "190" : "INACTIVE",
      account.status === "NEEDS_RECONNECT"
        ? "Instagram account needs reconnect (Error 190)"
        : `Automation is ${automation.status}`
    );
    await syncExecutionFromDeliveryActions(executionId, webhookEventId);
    return;
  }

  const claimed = await claimDeliveryAction(executionId, actionType);
  if (!claimed) {
    console.log(
      `[Worker] ${actionType} already claimed or terminal for executionId=${executionId}`
    );
    return;
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(
      account.encryptedAccessToken,
      workerEnv.metaTokenEncryptionKey
    );
  } catch {
    await markDeliveryActionFailed(
      executionId,
      actionType,
      "DECRYPT_ERROR",
      "Could not decrypt Instagram access token"
    );
    await syncExecutionFromDeliveryActions(executionId, webhookEventId);
    throw new UnrecoverableError("Could not decrypt Instagram access token");
  }

  const variableContext = {
    firstName: webhookEvent.commenterUsername,
    username: webhookEvent.commenterUsername,
    keyword: webhookEvent.commentText,
    link: automation.dmLink,
  };

  if (actionType === "PUBLIC_REPLY") {
    const variations =
      automation.publicReplyVariations.length > 0
        ? automation.publicReplyVariations
        : [automation.publicReplyText];
    const selectedTemplate =
      variations[(claimed.attempts - 1) % variations.length] ||
      automation.publicReplyText;
    let replyText = interpolateVariables(selectedTemplate, variableContext);

    if (automation.dmMeFallbackEnabled && !replyText.toLowerCase().includes("dm me")) {
      const kw = automation.keywords[0] || "LINK";
      replyText = `${replyText} (DM me ${kw} if you didn't get it!)`;
    }

    try {
      const replyId = await publishCommentReply(
        webhookEvent.commentId,
        replyText,
        accessToken
      );
      await markDeliveryActionSent(executionId, "PUBLIC_REPLY", replyId);
      await syncExecutionFromDeliveryActions(executionId, webhookEventId);
    } catch (err) {
      await handleIndependentActionError(
        executionId,
        webhookEventId,
        account.id,
        account.instagramUserId,
        webhookEvent.commentId,
        replyText,
        accessToken,
        "PUBLIC_REPLY",
        err
      );
    }
    return;
  }

  // HOOK_DM
  const isTwoStepButton =
    automation.followRequired || automation.deliveryMode === "BUTTON";
  try {
    let messageId: string;
    if (isTwoStepButton) {
      const rawHookText = automation.followRequired
        ? automation.followInstructionText ||
          "Hey {{first_name}}! Thanks for commenting. Follow our page and tap below (or reply FOLLOWED once you've followed) to get your link 👇"
        : `${automation.dmMessageText}\n\nTap below or reply LINK to get it 👇`;
      const hookText = interpolateVariables(rawHookText, variableContext);
      const buttonTitle = (
        automation.buttonLabel ||
        (automation.followRequired ? "I've followed! ✅" : "Send me the link")
      ).slice(0, 20);
      const quickReplies = [
        {
          content_type: "text" as const,
          title: buttonTitle,
          payload: signFollowCheckPayload(executionId, workerEnv.sessionSecret),
        },
      ];
      messageId = await sendPrivateReplyWithQuickReply(
        account.instagramUserId,
        webhookEvent.commentId,
        hookText,
        quickReplies,
        accessToken
      );
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          conversationState: "AWAITING_TAP",
          followCheckSentAt: new Date(),
        },
      });
    } else {
      const baseDm = interpolateVariables(automation.dmMessageText, variableContext);
      const privateMessage = automation.dmLink
        ? `${baseDm}\n${automation.dmLink}`
        : baseDm;
      messageId = await sendPrivateReply(
        account.instagramUserId,
        webhookEvent.commentId,
        privateMessage,
        accessToken
      );
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { conversationState: "COMPLETED" },
      });
    }

    await markDeliveryActionSent(executionId, "HOOK_DM", messageId);
    await syncExecutionFromDeliveryActions(executionId, webhookEventId);
  } catch (err) {
    await handleIndependentActionError(
      executionId,
      webhookEventId,
      account.id,
      account.instagramUserId,
      webhookEvent.commentId,
      "",
      accessToken,
      "HOOK_DM",
      err
    );
  }
}

async function handleIndependentActionError(
  executionId: string,
  webhookEventId: string,
  accountId: string,
  instagramUserId: string,
  commentId: string,
  expectedReplyText: string,
  accessToken: string,
  actionType: "PUBLIC_REPLY" | "HOOK_DM",
  err: unknown
): Promise<void> {
  if (err instanceof MetaApiError) {
    const errCode = err.metaError?.code ? String(err.metaError.code) : String(err.httpStatus);

    // Token Error 190 -> mark account NEEDS_RECONNECT and pause without burning retries
    if (err.metaError?.code === 190 || err.category === "AUTH_EXPIRED") {
      await prisma.instagramAccount
        .update({
          where: { id: accountId },
          data: { status: "NEEDS_RECONNECT" },
        })
        .catch(() => {});
      await markDeliveryActionFailed(
        executionId,
        actionType,
        "190",
        "Instagram access token expired or revoked by Meta (Error 190). Please reconnect."
      );
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { conversationState: "NEEDS_RECONNECT" },
      });
      await syncExecutionFromDeliveryActions(executionId, webhookEventId);
      throw new UnrecoverableError("Instagram access token expired (Error 190)");
    }

    // D4: Duplicate action handling
    if (err.category === "DUPLICATE_ACTION") {
      if (actionType === "HOOK_DM") {
        // Private reply "already has a private reply" -> SENT-equivalent
        await markDeliveryActionSent(executionId, "HOOK_DM", "already_replied_meta");
        await syncExecutionFromDeliveryActions(executionId, webhookEventId);
        return;
      }
      // For PUBLIC_REPLY, verify via GET /{commentId}/replies before marking SENT
      const reconciledId = await reconcileCommentReply(
        commentId,
        expectedReplyText,
        instagramUserId,
        accessToken
      );
      if (reconciledId) {
        await markDeliveryActionSent(executionId, "PUBLIC_REPLY", reconciledId);
        await syncExecutionFromDeliveryActions(executionId, webhookEventId);
        return;
      }
      await markDeliveryActionFailed(executionId, "PUBLIC_REPLY", errCode, err.message);
      await syncExecutionFromDeliveryActions(executionId, webhookEventId);
      throw new UnrecoverableError(err.message);
    }

    // Transient rate limit / upstream -> revert to PENDING and throw so BullMQ retries with backoff
    if (err.isTransient) {
      await markDeliveryActionPendingForRetry(executionId, actionType, errCode, err.message);
      throw err;
    }

    // Permanent rejection (7-day window, comment deleted, permission denied, etc.)
    await markDeliveryActionFailed(executionId, actionType, errCode, err.message);
    await syncExecutionFromDeliveryActions(executionId, webhookEventId);
    throw new UnrecoverableError(err.message);
  }

  // Ambiguous / UNKNOWN_OUTCOME (timeout, 5xx, socket reset)
  if (actionType === "PUBLIC_REPLY" && expectedReplyText) {
    const reconciledId = await reconcileCommentReply(
      commentId,
      expectedReplyText,
      instagramUserId,
      accessToken
    );
    if (reconciledId) {
      await markDeliveryActionSent(executionId, "PUBLIC_REPLY", reconciledId);
      await syncExecutionFromDeliveryActions(executionId, webhookEventId);
      return;
    }
  }

  const msg =
    err instanceof Error ? err.message : "Uncertain delivery outcome from Meta";
  await markDeliveryActionNeedsReview(executionId, actionType, "UNKNOWN", msg);
  await syncExecutionFromDeliveryActions(executionId, webhookEventId);
}
