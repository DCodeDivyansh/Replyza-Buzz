
import { prisma } from "@replyza/database";
import { matchAndQueueAutomation } from "./automation-matcher.service";

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
      ignored++;
      continue;
    }

    if (!Array.isArray(rawEntry.changes)) {
      ignored++;
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
