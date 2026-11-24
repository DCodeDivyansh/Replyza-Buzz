
import { Job, UnrecoverableError } from "bullmq";
import { randomUUID } from "node:crypto";
import { prisma } from "@replyza/database";
import { decryptToken, interpolateVariables } from "@replyza/shared";

import type { AutomationJobData } from "../queues/automation.queue";

import { workerEnv } from "../config/env";

import {
  claimAction,
  completePublicReply,
  completePrivateReply,
  markActionFailed,
  markActionUnknown,
} from "../services/action-state.service";

import {
  claimExecution,
  renewExecutionLease,
  releaseExecutionLease,
  recoverExpiredExecution,
  assertExecutionOwnership,
} from "../services/execution-lease.service";

import {
  publishCommentReply,
  sendPrivateReply,
  sendPrivateReplyWithQuickReply,
  MetaApiError,
  MetaApiUnknownOutcomeError,
} from "../services/instagram-graph.service";

type ActionResult =
  | "SUCCESS"
  | "FAILED"
  | "UNKNOWN"
  | "SKIPPED"
  | "BLOCKED";


async function executeAction(
  executionId: string,
  leaseToken: string,
  action: "public" | "private",
  isLeaseLost: () => boolean,
  send: () => Promise<string>,
  save: (resultId: string) => Promise<void>
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
      `[Worker] ${action} action was not claimed. State: ${currentStatus}`
    );

    if (currentStatus === "PROCESSING" || currentStatus === "PENDING") {
      console.warn(
        `[Worker] ${action} action is unresolved. Automatic resend prevented.`
      );

      return "BLOCKED";
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
      `[Worker] ${action} action completed: ${executionId}`
    );

    return "SUCCESS";
  } catch (error) {
    if (error instanceof MetaApiError) {
      // Meta error code 190 indicates expired or invalidated OAuth token:
      // https://developers.facebook.com/documentation/instagram-platform/support/error-handling
      if (error.metaError?.code === 190) {
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
      }

      await markActionFailed(
        executionId,
        action,
        leaseToken,
        error.metaError?.code === 190
          ? "Instagram access token expired or revoked by Meta (Error 190). Please reconnect your account."
          : error.message
      );

      console.error(
        `[Worker] ${action} action rejected by Meta:`,
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
      `[Worker] ${action} action outcome unknown:`,
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

    let finalStatus: "COMPLETED" | "PARTIAL" | "FAILED";

    if (
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
        completedAt: new Date(),
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });

    if (updated.count !== 1) {
      throw new Error(
        `Execution ownership lost during finalization: ${executionId}`
      );
    }

    await tx.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    console.log(
      `[Worker] Execution finalized: ${executionId} | ` +
      `Public: ${publicStatus} | ` +
      `Private: ${privateStatus} | ` +
      `Final: ${finalStatus}`
    );
  });
}



export async function processAutomationJob(
  job: Job<AutomationJobData>
): Promise<void> {
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
    execution.status === "FAILED"
  ) {
    console.log(
      `[Worker] Execution already terminal: ${execution.status}`
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
        )
    );

    if (leaseLost) {
      throw new Error(
        `Execution lease lost after public action: ${executionId}`
      );
    }

    if (publicResult === "BLOCKED") {
      await finalizeExecution(
        executionId,
        webhookEventId,
        leaseToken
      );
      return;
    }

    // Action 2: Private Instagram reply.
    let privateActionSender: () => Promise<string>;

    if (automation.followRequired) {
      const instructionText = interpolateVariables(
        automation.followInstructionText ||
          "Hey {{first_name}}! Thanks for commenting. Follow our page and tap the button below to get your link instantly! 👇",
        variableContext
      );
      const quickReplies = [
        {
          content_type: "text" as const,
          title: "I've followed! ✅",
          payload: `FOLLOW_CHECK:${executionId}`,
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

    if (automation.followRequired && privateResult === "SUCCESS") {
      await prisma.automationExecution.updateMany({
        where: {
          id: executionId,
          leaseToken,
          leaseExpiresAt: { gt: new Date() },
        },
        data: {
          followCheckStatus: "PENDING",
          followCheckSentAt: new Date(),
        },
      });
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
