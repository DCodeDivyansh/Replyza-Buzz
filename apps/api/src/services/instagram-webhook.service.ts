
import { prisma } from "@replyza/database";

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
  return (
    isRecord(error) &&
    error.code === "P2002"
  );
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
      select: { id: true }
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

      try {
        await prisma.webhookEvent.create({
          data: {
            instagramAccountId: instagramAccount.id,
            commentId: comment.id,
            mediaId: media.id,
            commenterInstagramId: commenter.id,
            commenterUsername: isNonEmptyString(commenter.username)
              ? commenter.username
              : null,
            commentText: comment.text,
            eventPayload: JSON.parse(JSON.stringify(comment))
          }
        });

        saved++;
      } catch (error) {
        if (isDuplicateError(error)) {
          duplicates++;
          continue;
        }

        throw error;
      }
    }
  }

  return { saved, duplicates, ignored };
}
