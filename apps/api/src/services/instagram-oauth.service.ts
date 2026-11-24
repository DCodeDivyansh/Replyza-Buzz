import {
  metaGraphService,
  MetaGraphError,
  type MetaTokenResponse,
  type MetaInstagramAccount,
} from "./meta-graph.service";

export type { MetaTokenResponse, MetaInstagramAccount };

export class InstagramOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramOAuthError";
  }
}

export async function exchangeInstagramCode(
  code: string,
  redirectUri?: string
): Promise<MetaTokenResponse> {
  try {
    return await metaGraphService.exchangeCode(code, redirectUri);
  } catch (err: unknown) {
    if (err instanceof MetaGraphError) {
      throw new InstagramOAuthError(err.message || "Meta authorization code exchange failed");
    }
    throw new InstagramOAuthError(
      err instanceof Error ? err.message : "Meta authorization code exchange failed"
    );
  }
}

/**
 * Subscribes the app to an Instagram account or linked Facebook Page for Webhook deliveries.
 * Meta Documentation Reference:
 * https://developers.facebook.com/documentation/instagram-platform/webhooks
 */
export async function subscribeInstagramAccount(
  instagramUserId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  return metaGraphService.subscribeWebhooks(instagramUserId, accessToken);
}

export async function getAssignedInstagramAccounts(
  accessToken: string
): Promise<MetaInstagramAccount[]> {
  try {
    return await metaGraphService.getAssignedAccounts(accessToken);
  } catch (err: unknown) {
    if (err instanceof MetaGraphError) {
      console.error("Instagram account discovery failed:", {
        httpStatus: err.statusCode,
        code: err.code,
        message: err.message,
      });
      throw new InstagramOAuthError(
        err.message || "Failed to retrieve assigned Instagram accounts"
      );
    }
    throw new InstagramOAuthError(
      err instanceof Error ? err.message : "Failed to retrieve assigned Instagram accounts"
    );
  }
}