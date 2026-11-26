import {
  MetaGraphClient,
  MetaGraphError,
  defaultMetaGraphClient,
  type MetaErrorCategory,
} from "@replyza/shared";
import { prisma } from "@replyza/database";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export { MetaGraphError, type MetaErrorCategory };

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

export interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface MetaInstagramAccount {
  id: string;
  username?: string;
}

export class MetaGraphService {
  constructor(private readonly client: MetaGraphClient = defaultMetaGraphClient) {}

  /**
   * Helper that checks if an error is an authentication error (Error 190) and marks
   * the account status in the database as NEEDS_RECONNECT.
   */
  public async handleAccountError(accountId: string, error: unknown): Promise<void> {
    if (error instanceof MetaGraphError && error.category === "AUTH_EXPIRED") {
      logger.warn(
        { accountId, code: error.code, subcode: error.subcode },
        "Instagram OAuth token expired or invalidated; flagging account as NEEDS_RECONNECT"
      );
      try {
        await prisma.instagramAccount.update({
          where: { id: accountId },
          data: { status: "NEEDS_RECONNECT" },
        });
      } catch (dbErr) {
        logger.error({ dbErr, accountId }, "Failed to update account status to NEEDS_RECONNECT");
      }
    }
  }

  /**
   * Exchange an OAuth authorization code for a short-lived or long-lived access token.
   */
  public async exchangeCode(code: string, redirectUri?: string): Promise<MetaTokenResponse> {
    const params: Record<string, string | undefined> = {
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      code,
      redirect_uri: redirectUri,
    };

    return this.client.get<MetaTokenResponse>("oauth/access_token", params, "");
  }

  /**
   * Discover assigned Instagram professional accounts linked to the user's Facebook account.
   */
  public async getAssignedAccounts(accessToken: string): Promise<MetaInstagramAccount[]> {
    const res = await this.client.get<{ data?: MetaInstagramAccount[] }>(
      "me/assigned_instagram_accounts",
      { fields: "id,username" },
      accessToken
    );
    return res.data || [];
  }

  /**
   * Fetch paginated media items for an Instagram creator or business account.
   */
  public async getMedia(
    instagramUserId: string,
    accessToken: string,
    cursor?: string,
    limit = 24
  ): Promise<InstagramMediaResponse> {
    return this.client.get<InstagramMediaResponse>(
      `${instagramUserId}/media`,
      {
        fields: "id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp",
        limit,
        after: cursor,
      },
      accessToken
    );
  }

  /**
   * Subscribe an account for Instagram webhook deliveries (comments, messages).
   */
  public async subscribeWebhooks(
    instagramUserId: string,
    accessToken: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await this.client.post<{ success?: boolean }>(
        `${instagramUserId}/subscribed_apps`,
        new URLSearchParams({ subscribed_fields: "feed,comments,messages,messaging_postbacks" }),
        accessToken
      );
      return { success: res.success ?? true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Webhook subscription failed",
      };
    }
  }
}

export const metaGraphService = new MetaGraphService();
