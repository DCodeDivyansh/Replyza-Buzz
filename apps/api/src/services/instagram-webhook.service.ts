import { createHash } from "node:crypto";
import { prisma } from "@replyza/database";
import {
  matchCommentKeywords,
  verifyFollowCheckPayload,
} from "@replyza/shared";
import { env } from "../config/env";
import { features } from "../config/features";
import { matchAndQueueAutomation } from "./automation-matcher.service";
import { redisConnection } from "../queues/automation.queue";
import { enqueueFollowCheck } from "../queues/follow-check.queue";
import { logger } from "../utils/logger";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isDuplicateError(error: unknown): boolean {
  return isRecord(error) && error.code === "P2002";
}

async function tryFastPathDedupe(key: string): Promise<boolean> {
  try {
    const res = await redisConnection.set(key, "1", "EX", 300, "NX");
    return res === "OK";
  } catch {
    // Redis unavailable — fall back seamlessly to authoritative PostgreSQL unique constraints
    return true;
  }
}

export async function persistInstagramCommentEvents(
  payload: UnknownRecord
): Promise<{ saved: number; duplicates: number; ignored: number }> {
  if (payload.object !== "instagram" || !Array.isArray(payload.entry)) {
    return { saved: 0, duplicates: 0, ignored: 1 };
  }

  let saved = 0;
  let duplicates = 0;
  let ignored = 0;

  for (const rawEntry of payload.entry) {
    if (!isRecord(rawEntry) || !isNonEmptyString(rawEntry.id)) {
      ignored++;
      continue;
    }

    const entryInstagramUserId = rawEntry.id;

    const instagramAccount = await prisma.instagramAccount.findUnique({
      where: { instagramUserId: entryInstagramUserId },
      select: { id: true },
    });

    if (!instagramAccount) {
      logger.warn(
        {
          entryId: entryInstagramUserId,
          doc: "https://developers.facebook.com/documentation/instagram-platform/webhooks",
        },
        "Received webhook for unknown or disconnected Instagram account"
      );
      ignored++;
      continue;
    }

    // 1. Process messaging events (Quick Reply taps, Postbacks, text-fallback consent, DM-me fallback)
    if (Array.isArray(rawEntry.messaging)) {
      for (const rawMsg of rawEntry.messaging) {
        if (!isRecord(rawMsg)) {
          ignored++;
          continue;
        }

        const msgObj = isRecord(rawMsg.message) ? rawMsg.message : null;
        // Filter echo messages sent by our own Instagram account (prevent DM loops)
        if (msgObj && msgObj.is_echo === true) {
          ignored++;
          continue;
        }

        const sender = isRecord(rawMsg.sender) ? rawMsg.sender : null;
        const senderId =
          sender && isNonEmptyString(sender.id) ? sender.id : null;
        if (!senderId || senderId === entryInstagramUserId) {
          ignored++;
          continue;
        }

        let payloadString: string | null = null;
        let inboundText: string | null = null;

        if (msgObj) {
          if (isNonEmptyString(msgObj.text)) {
            inboundText = msgObj.text;
          }
          if (
            isRecord(msgObj.quick_reply) &&
            isNonEmptyString(msgObj.quick_reply.payload)
          ) {
            payloadString = msgObj.quick_reply.payload;
          }
        } else if (
          isRecord(rawMsg.postback) &&
          isNonEmptyString(rawMsg.postback.payload)
        ) {
          payloadString = rawMsg.postback.payload;
        }

        let providerEventId: string;
        if (msgObj && isNonEmptyString(msgObj.mid)) {
          providerEventId = msgObj.mid;
        } else if (
          isRecord(rawMsg.postback) &&
          isNonEmptyString(rawMsg.postback.mid)
        ) {
          providerEventId = rawMsg.postback.mid;
        } else {
          providerEventId = createHash("sha256")
            .update(JSON.stringify(rawMsg))
            .digest("hex");
        }

        // Fast-path Redis dedupe (authoritative check remains in PostgreSQL)
        const isFreshMsg = await tryFastPathDedupe(
          `ig:dedupe:msg:${entryInstagramUserId}:${providerEventId}`
        );
        if (!isFreshMsg) {
          duplicates++;
          continue;
        }

        let executionId: string | null = null;
        let validExecution = false;

        if (payloadString && payloadString.startsWith("FOLLOW_CHECK:")) {
          let candidateExecutionId: string | null = null;

          if (features.FOLLOW_CHECK_SIGNED_TOKENS) {
            candidateExecutionId = verifyFollowCheckPayload(
              payloadString,
              env.SESSION_SECRET
            );
            if (!candidateExecutionId) {
              logger.warn(
                { accountId: instagramAccount.id, senderId },
                "Rejected unsigned or tampered FOLLOW_CHECK payload"
              );
              ignored++;
              continue;
            }
          } else {
            candidateExecutionId = payloadString.slice("FOLLOW_CHECK:".length);
          }

          if (candidateExecutionId) {
            const execution = await prisma.automationExecution.findFirst({
              where: {
                id: candidateExecutionId,
                automation: {
                  instagramAccountId: instagramAccount.id,
                },
              },
              select: { id: true },
            });

            if (execution) {
              executionId = execution.id;
              validExecution = true;
            } else {
              logger.warn(
                { candidateExecutionId, accountId: instagramAccount.id },
                "Follow check execution does not belong to this Instagram account or does not exist"
              );
            }
          }
        } else if (inboundText) {
          // Desktop / text-fallback consent: check if sender has an open AWAITING_TAP/AWAITING_FOLLOW execution
          const openExecution = await prisma.automationExecution.findFirst({
            where: {
              automation: { instagramAccountId: instagramAccount.id },
              OR: [
                { commenterIgsid: senderId },
                { webhookEvent: { commenterInstagramId: senderId } },
              ],
              conversationState: {
                in: ["HOOK_SENT", "AWAITING_TAP", "AWAITING_FOLLOW"],
              },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });

          if (openExecution) {
            executionId = openExecution.id;
            validExecution = true;
          } else if (features.DM_ME_FALLBACK) {
            // Opt-in DM-me fallback: match inbound DM text against active dmMeFallbackEnabled automations
            const dmFallbacks = await prisma.automation.findMany({
              where: {
                instagramAccountId: instagramAccount.id,
                status: "ACTIVE",
                dmMeFallbackEnabled: true,
              },
              orderBy: { createdAt: "asc" },
            });

            for (const auto of dmFallbacks) {
              const mode =
                auto.triggerType === "ANY_COMMENT"
                  ? "ANY"
                  : auto.keywordMatchMode;
              const match = matchCommentKeywords(
                inboundText,
                mode,
                auto.keywords
              );
              if (match.matched) {
                // Create synthetic WebhookEvent + Execution for DM-me fallback (deduped by providerEventId)
                const synthetic = await prisma.$transaction(async (tx) => {
                  const we = await tx.webhookEvent.upsert({
                    where: {
                      instagramAccountId_commentId: {
                        instagramAccountId: instagramAccount.id,
                        commentId: `dm:${providerEventId}`,
                      },
                    },
                    create: {
                      instagramAccountId: instagramAccount.id,
                      commentId: `dm:${providerEventId}`,
                      mediaId: auto.mediaId ?? "dm_fallback",
                      commenterInstagramId: senderId,
                      commentText: inboundText!,
                      eventPayload: JSON.parse(JSON.stringify(rawMsg)),
                      status: "PROCESSED",
                    },
                    update: {},
                    select: { id: true },
                  });

                  const exec = await tx.automationExecution.upsert({
                    where: { webhookEventId: we.id },
                    create: {
                      automationId: auto.id,
                      webhookEventId: we.id,
                      commenterIgsid: senderId,
                      status: "PROCESSING",
                      publicReplyStatus: "SKIPPED",
                      privateReplyStatus: "SUCCESS",
                      conversationState: "TAPPED",
                    },
                    update: {},
                    select: { id: true },
                  });
                  return exec.id;
                });

                executionId = synthetic;
                validExecution = true;
                break;
              }
            }
          }
        }

        // Persist messaging webhook event and outbox record atomically
        let messagingEventId: string | null = null;
        let outboxId: string | null = null;
        let outboxPending = false;

        try {
          const created = await prisma.$transaction(async (tx) => {
            const msgEvent = await tx.messagingWebhookEvent.create({
              data: {
                instagramAccountId: instagramAccount.id,
                providerEventId,
                senderId,
                recipientId: entryInstagramUserId,
                payload: payloadString ?? inboundText,
                executionId,
                rawPayload: JSON.parse(JSON.stringify(rawMsg)),
                status: "RECEIVED",
              },
              select: { id: true },
            });

            let obId: string | null = null;
            if (validExecution && executionId) {
              const ob = await tx.outboxEvent.upsert({
                where: {
                  eventType_aggregateId: {
                    eventType: "FOLLOW_CHECK",
                    aggregateId: msgEvent.id,
                  },
                },
                create: {
                  eventType: "FOLLOW_CHECK",
                  aggregateId: msgEvent.id,
                  payload: {
                    executionId,
                    igsid: senderId,
                    instagramUserId: entryInstagramUserId,
                    providerEventId,
                    messagingEventId: msgEvent.id,
                  },
                  status: "PENDING",
                },
                update: {},
                select: { id: true },
              });
              obId = ob.id;
            }

            return { msgEventId: msgEvent.id, obId };
          });

          messagingEventId = created.msgEventId;
          outboxId = created.obId;
          outboxPending = Boolean(outboxId);
          saved++;
        } catch (error) {
          if (isDuplicateError(error)) {
            logger.info(
              { providerEventId, accountId: instagramAccount.id },
              "Duplicate messaging webhook event received"
            );
            duplicates++;

            const existingMsg = await prisma.messagingWebhookEvent.findUnique({
              where: {
                instagramAccountId_providerEventId: {
                  instagramAccountId: instagramAccount.id,
                  providerEventId,
                },
              },
              select: { id: true, executionId: true },
            });

            if (existingMsg && existingMsg.executionId) {
              const pendingOutbox = await prisma.outboxEvent.findUnique({
                where: {
                  eventType_aggregateId: {
                    eventType: "FOLLOW_CHECK",
                    aggregateId: existingMsg.id,
                  },
                },
                select: { id: true, status: true },
              });

              if (pendingOutbox && pendingOutbox.status === "PENDING") {
                messagingEventId = existingMsg.id;
                outboxId = pendingOutbox.id;
                outboxPending = true;
                executionId = existingMsg.executionId;
              }
            }

            if (!outboxPending) {
              continue;
            }
          } else {
            throw error;
          }
        }

        if (outboxPending && outboxId && executionId) {
          try {
            await enqueueFollowCheck({
              executionId,
              igsid: senderId,
              instagramUserId: entryInstagramUserId,
              providerEventId,
            });

            await prisma.outboxEvent.updateMany({
              where: { id: outboxId, status: "PENDING" },
              data: {
                status: "DISPATCHED",
                dispatchedAt: new Date(),
                lastError: null,
              },
            });

            if (messagingEventId) {
              await prisma.messagingWebhookEvent.updateMany({
                where: { id: messagingEventId, status: "RECEIVED" },
                data: { status: "PROCESSING" },
              });
            }
          } catch (err) {
            const errMsg =
              err instanceof Error ? err.message : "Redis enqueue failed";
            logger.warn(
              { executionId, outboxId, err: errMsg },
              "Immediate follow-check BullMQ dispatch failed; OutboxEvent preserved for recovery"
            );
            await prisma.outboxEvent
              .updateMany({
                where: { id: outboxId, status: "PENDING" },
                data: {
                  attempts: { increment: 1 },
                  lastError: errMsg,
                  nextAttemptAt: new Date(Date.now() + 5_000),
                },
              })
              .catch(() => {});
          }
        }
      }
    }

    // 2. Process changes events (comments)
    if (!Array.isArray(rawEntry.changes)) {
      if (!Array.isArray(rawEntry.messaging)) {
        ignored++;
      }
      continue;
    }

    for (const rawChange of rawEntry.changes) {
      if (
        !isRecord(rawChange) ||
        rawChange.field !== "comments" ||
        !isRecord(rawChange.value)
      ) {
        ignored++;
        continue;
      }

      const comment = rawChange.value;
      const media = comment.media;
      const commenter = comment.from;

      if (
        !isNonEmptyString(comment.id) ||
        !isRecord(media) ||
        !isNonEmptyString(media.id) ||
        !isRecord(commenter) ||
        !isNonEmptyString(commenter.id) ||
        typeof comment.text !== "string"
      ) {
        ignored++;
        continue;
      }

      // D1: Ignore comments authored by our own connected Instagram account to prevent reply loops
      if (commenter.id === entryInstagramUserId) {
        logger.debug(
          { commentId: comment.id, accountId: instagramAccount.id },
          "Ignoring own-account comment to prevent reply loop"
        );
        ignored++;
        continue;
      }

      // D11: Redis fast-path dedupe (authoritative check remains PostgreSQL unique constraint)
      const isFreshComment = await tryFastPathDedupe(
        `ig:dedupe:comment:${entryInstagramUserId}:${comment.id}`
      );
      if (!isFreshComment) {
        duplicates++;
        continue;
      }

      let webhookEventId: string;

      try {
        const event = await prisma.webhookEvent.create({
          data: {
            instagramAccountId: instagramAccount.id,
            commentId: comment.id,
            mediaId: media.id,
            commenterInstagramId: commenter.id,
            commenterUsername: isNonEmptyString(commenter.username)
              ? commenter.username
              : null,
            commentText: comment.text,
            eventPayload: JSON.parse(JSON.stringify(comment)),
          },
          select: { id: true },
        });

        webhookEventId = event.id;
        saved++;
      } catch (error) {
        if (!isDuplicateError(error)) {
          throw error;
        }

        duplicates++;

        const existingEvent = await prisma.webhookEvent.findUnique({
          where: {
            instagramAccountId_commentId: {
              instagramAccountId: instagramAccount.id,
              commentId: comment.id,
            },
          },
          select: { id: true },
        });

        if (!existingEvent) {
          throw new Error(
            `Duplicate webhook event could not be retrieved: ${comment.id}`
          );
        }

        webhookEventId = existingEvent.id;
      }

      await matchAndQueueAutomation(webhookEventId);
    }
  }

  return { saved, duplicates, ignored };
}
