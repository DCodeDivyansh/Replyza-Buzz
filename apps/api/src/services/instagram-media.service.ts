import { prisma } from "@replyza/database";
import { redisConnection } from "../queues/automation.queue";
import { decryptToken } from "../utils/token-encryption";
import { logger } from "../utils/logger";
import {
  metaGraphService,
  MetaGraphError,
  type InstagramMediaItem,
  type InstagramMediaResponse,
} from "./meta-graph.service";

export type { InstagramMediaItem, InstagramMediaResponse };

export class InstagramMediaError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: number
  ) {
    super(message);
    this.name = "InstagramMediaError";
  }
}

export async function fetchInstagramAccountMedia(
  userId: string,
  accountId: string,
  cursor?: string
): Promise<InstagramMediaResponse> {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: {
      id: true,
      instagramUserId: true,
      encryptedAccessToken: true,
      status: true,
    },
  });

  if (!account) {
    throw new InstagramMediaError("Instagram account not found", 404);
  }

  if (account.status === "NEEDS_RECONNECT") {
    throw new InstagramMediaError(
      "Instagram account requires reconnection",
      403
    );
  }

  const cacheKey = `ig:media:${accountId}:${cursor || "first"}`;

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as InstagramMediaResponse;
    }
  } catch (err) {
    logger.warn({ err }, "Redis media cache lookup failed, continuing to Meta API");
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(account.encryptedAccessToken);
  } catch {
    throw new InstagramMediaError("Failed to decrypt Instagram access token", 500);
  }

  let result: InstagramMediaResponse;
  try {
    result = await metaGraphService.getMedia(account.instagramUserId, accessToken, cursor);
  } catch (err: unknown) {
    if (err instanceof MetaGraphError) {
      await metaGraphService.handleAccountError(account.id, err);

      if (err.category === "AUTH_EXPIRED") {
        throw new InstagramMediaError(
          "Instagram access token expired or invalid. Please reconnect your account.",
          401,
          190
        );
      }

      throw new InstagramMediaError(
        err.message,
        err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 502,
        err.code
      );
    }

    throw new InstagramMediaError(
      err instanceof Error ? err.message : "Failed to fetch Instagram media",
      502
    );
  }

  try {
    // Cache for 5 minutes (300 seconds)
    await redisConnection.setex(cacheKey, 300, JSON.stringify(result));
  } catch (err) {
    logger.warn({ err }, "Failed to write media results to Redis cache");
  }

  return result;
}
