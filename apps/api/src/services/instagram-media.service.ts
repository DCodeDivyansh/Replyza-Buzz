import { prisma } from "@replyza/database";
import { redisConnection } from "../queues/automation.queue";
import { decryptToken } from "../utils/token-encryption";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  thumbnail_url?: string;
  media_url?: string;
  permalink?: string;
  timestamp: string;
}

export interface InstagramMediaResponse {
  data: InstagramMediaItem[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
}

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

  const baseUrl = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
  const url = new URL(`${baseUrl}/${env.META_GRAPH_API_VERSION}/${account.instagramUserId}/media`);
  url.searchParams.set(
    "fields",
    "id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp"
  );
  url.searchParams.set("limit", "24");
  if (cursor) {
    url.searchParams.set("after", cursor);
  }
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = await res.json();

  if (!res.ok || json.error) {
    const error = json.error || {};
    const errorCode = error.code;

    // Detect expired / invalidated OAuth token (Error Code 190)
    if (errorCode === 190) {
      logger.warn(
        { accountId: account.id, errorCode },
        "Instagram access token expired or invalid, updating status to NEEDS_RECONNECT"
      );
      await prisma.instagramAccount.update({
        where: { id: account.id },
        data: { status: "NEEDS_RECONNECT" },
      });
      throw new InstagramMediaError(
        "Instagram access token expired or invalid. Please reconnect your account.",
        401,
        190
      );
    }

    throw new InstagramMediaError(
      error.message || `Meta API request failed with status ${res.status}`,
      res.status >= 400 && res.status < 500 ? res.status : 502,
      errorCode
    );
  }

  const result: InstagramMediaResponse = {
    data: Array.isArray(json.data) ? json.data : [],
    paging: json.paging,
  };

  try {
    // Cache for 5 minutes (300 seconds)
    await redisConnection.setex(cacheKey, 300, JSON.stringify(result));
  } catch (err) {
    logger.warn({ err }, "Failed to write media results to Redis cache");
  }

  return result;
}
