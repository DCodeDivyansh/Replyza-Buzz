
import { createHash } from "node:crypto";
import { prisma } from "@replyza/database";
import { matchAndQueueAutomation } from "./automation-matcher.service";
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

    const instagramAccount = await prisma.instagramAccount.findUnique({
      where: { instagramUserId: rawEntry.id },
      select: { id: true },
    });

    if (!instagramAccount) {
      logger.warn(
        {
          entryId: rawEntry.id,
          doc: "https://developers.facebook.com/documentation/instagram-platform/webhooks",
        },
        "Received webhook for unknown or disconnected Instagram account"
      );
      ignored++;
      continue;
    }

    // 1. Process messaging events (e.g. Quick Reply clicks for Follow-to-Get-Link)
    if (Array.isArray(rawEntry.messaging)) {
      for (const rawMsg of rawEntry.messaging) {
        if (!isRecord(rawMsg)) {
          ignored++;
          continue;
        }

        const sender = isRecord(rawMsg.sender) ? rawMsg.sender : null;
        const senderId = sender && isNonEmptyString(sender.id) ? sender.id : null;
        let payloadString: string | null = null;

        if (isRecord(rawMsg.message) && isRecord(rawMsg.message.quick_reply)) {
          if (isNonEmptyString(rawMsg.message.quick_reply.payload)) {
            payloadString = rawMsg.message.quick_reply.payload;
          }
        } else if (isRecord(rawMsg.postback) && isNonEmptyString(rawMsg.postback.payload)) {
          payloadString = rawMsg.postback.payload;
        }

        // Derive durable providerEventId for messaging webhook deduplication
        let providerEventId: string;
        if (isRecord(rawMsg.message) && isNonEmptyString(rawMsg.message.mid)) {
          providerEventId = rawMsg.message.mid;
        } else if (isRecord(rawMsg.postback) && isNonEmptyString(rawMsg.postback.mid)) {
          providerEventId = rawMsg.postback.mid;
        } else {
          providerEventId = createHash("sha256")
            .update(JSON.stringify(rawMsg))
            .digest("hex");
        }

        let executionId: string | null = null;
        let validExecution = false;

        if (senderId && payloadString && payloadString.startsWith("FOLLOW_CHECK:")) {
          const candidateExecutionId = payloadString.slice("FOLLOW_CHECK:".length);
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
        }

        // Persist messaging webhook event for deduplication
        try {
          await prisma.messagingWebhookEvent.create({
            data: {
              instagramAccountId: instagramAccount.id,
              providerEventId,
              senderId: senderId ?? "UNKNOWN",
              recipientId: rawEntry.id,
              payload: payloadString,
              executionId,
              rawPayload: JSON.parse(JSON.stringify(rawMsg)),
              status: "RECEIVED",
            },
          });
          saved++;
        } catch (error) {
          if (isDuplicateError(error)) {
            logger.info(
              { providerEventId, accountId: instagramAccount.id },
              "Duplicate messaging webhook event ignored"
            );
            duplicates++;
            continue;
          }
          throw error;
        }

        if (validExecution && executionId && senderId) {
          await enqueueFollowCheck({
            executionId,
            igsid: senderId,
            instagramUserId: rawEntry.id,
            providerEventId,
          });
        }
      }
    }

    // 2. Process changes events (e.g. comments)
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

        // Recover an event that was saved previously but not queued.
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

      // Run matching for both new and duplicate deliveries.
      // If Redis is unavailable, this throws and the webhook returns 500.
      // A subsequent Meta retry can then attempt queue insertion again.
      await matchAndQueueAutomation(webhookEventId);
    }
  }

  return { saved, duplicates, ignored };
}
