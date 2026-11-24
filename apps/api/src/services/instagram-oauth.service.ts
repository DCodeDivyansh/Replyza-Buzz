import { env } from "../config/env";

interface MetaTokenResponse {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: {
        message?: string;
        type?: string;
        code?: number;
    };
}

interface MetaInstagramAccount {
    id: string;
    username?: string;
}

// interface MetaGraphError {
//   message?: string;
//   type?: string;
//   code?: number;
// }

// interface MetaGraphResponse<T> {
//   id?: string;
//   data?: T[];
//   error?: MetaGraphError;
// }

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
    const baseUrl = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
    const url = new URL(
        `${baseUrl}/${env.META_GRAPH_API_VERSION}/oauth/access_token`
    );

    url.searchParams.set("client_id", env.META_APP_ID);
    url.searchParams.set("client_secret", env.META_APP_SECRET);
    url.searchParams.set("code", code);

    // Required when the code was issued through a redirect flow: Meta checks it
    // against the redirect_uri used in the login dialog request.
    if (redirectUri) {
        url.searchParams.set("redirect_uri", redirectUri);
    }

    const response = await fetch(url);
    const data = (await response.json()) as MetaTokenResponse;

    if (!response.ok || !data.access_token) {
        throw new InstagramOAuthError(
            data.error?.message ?? "Meta authorization code exchange failed"
        );
    }

    return data;
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
  const baseUrl = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
  const url = new URL(
    `${baseUrl}/${env.META_GRAPH_API_VERSION}/${instagramUserId}/subscribed_apps`
  );
  url.searchParams.set("subscribed_fields", "feed,comments,messages");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as { success?: boolean; error?: { message?: string } };
    if (response.ok && (data.success || data.success === undefined)) {
      return { success: true };
    }
    return { success: false, error: data.error?.message || "Webhook subscription failed" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error during subscription",
    };
  }
}

// async function metaGet<T>(
//   path: string,
//   accessToken: string
// ): Promise<MetaGraphResponse<T>> {
//   const url = new URL(
//     `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${path}`
//   );

//   url.searchParams.set("access_token", accessToken);

//   const response = await fetch(url);
//   const data = (await response.json()) as MetaGraphResponse<T>;

//   if (!response.ok || data.error) {
//     throw new InstagramOAuthError(
//       data.error?.message ?? "Meta Graph API request failed"
//     );
//   }

//   return data;
// }

export async function getAssignedInstagramAccounts(
  accessToken: string
): Promise<MetaInstagramAccount[]> {
  const baseUrl = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
  const url = new URL(
    `${baseUrl}/${env.META_GRAPH_API_VERSION}/me/assigned_instagram_accounts`
  );

  url.searchParams.set("fields", "id,username");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await response.json() as {
    data?: MetaInstagramAccount[];
    error?: {
      message?: string;
      type?: string;
      code?: number;
    };
  };

  if (!response.ok || data.error) {
    console.error("Instagram account discovery failed:", {
      httpStatus: response.status,
      error: data.error ?? null
    });

    throw new InstagramOAuthError(
      data.error?.message ?? "Failed to retrieve assigned Instagram accounts"
    );
  }

  return data.data ?? [];
}