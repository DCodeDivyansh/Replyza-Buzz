
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
    code: string
): Promise<MetaTokenResponse> {
    const url = new URL(
        `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/oauth/access_token`
    );

    url.searchParams.set("client_id", env.META_APP_ID);
    url.searchParams.set("client_secret", env.META_APP_SECRET);
    url.searchParams.set("code", code);

    const response = await fetch(url);
    const data = (await response.json()) as MetaTokenResponse;
    console.log("Meta token exchange diagnostic:", {
        httpStatus: response.status,
        responseKeys: Object.keys(data),
        tokenType: data.token_type ?? null,
        expiresIn: data.expires_in ?? null,
        hasAccessToken: Boolean(data.access_token),
        error: data.error ?? null
    });

    if (!response.ok || !data.access_token) {
        throw new InstagramOAuthError(
            data.error?.message ?? "Meta authorization code exchange failed"
        );
    }

    return data;
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
  const url = new URL(
    `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/me/assigned_instagram_accounts`
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

