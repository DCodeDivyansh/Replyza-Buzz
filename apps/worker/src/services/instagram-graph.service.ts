import { workerEnv } from "../config/env";

interface MetaApiSuccess {
  id?: string;
  recipient_id?: string;
  message_id?: string;
}

interface MetaApiErrorPayload {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly metaError?: MetaApiErrorPayload
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

export class MetaApiUnknownOutcomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaApiUnknownOutcomeError";
  }
}

async function graphPost(
  path: string,
  token: string,
  body: URLSearchParams,
  expectedResponseField: "id" | "message_id"
): Promise<string> {
  const baseUrl = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
  const url =
    `${baseUrl}/${workerEnv.metaGraphApiVersion}/${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new MetaApiUnknownOutcomeError(
      "No definitive response received from Meta."
    );
  }

  let result: MetaApiSuccess | { error: MetaApiErrorPayload };

  try {
    result = await response.json();
  } catch {
    throw new MetaApiUnknownOutcomeError(
      `Meta returned an unreadable response (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    const error = "error" in result ? result.error : undefined;

    if (response.status >= 500 || response.status === 429) {
      throw new MetaApiUnknownOutcomeError(
        `Meta returned HTTP ${response.status}; outcome requires reconciliation.`
      );
    }

    throw new MetaApiError(
      error?.message ??
      `Meta API rejected the request (HTTP ${response.status}).`,
      response.status,
      error
    );
  }

  if ("error" in result) {
    throw new MetaApiUnknownOutcomeError(
      "Meta returned an unexpected error response."
    );
  }

  const responseId =
    expectedResponseField === "id"
      ? result.id
      : result.message_id;

  if (typeof responseId !== "string" || !responseId) {
    throw new MetaApiUnknownOutcomeError(
      `Meta accepted the request but did not return ${expectedResponseField}.`
    );
  }

  return responseId;
}

export async function publishCommentReply(
  commentId: string,
  message: string,
  token: string
): Promise<string> {
  const body = new URLSearchParams({ message });

  return graphPost(
    `${encodeURIComponent(commentId)}/replies`,
    token,
    body,
    "id"
  );
}

export async function sendPrivateReply(
  instagramUserId: string,
  commentId: string,
  message: string,
  token: string
): Promise<string> {
  const body = new URLSearchParams({
    recipient: JSON.stringify({
      comment_id: commentId,
    }),
    message: JSON.stringify({
      text: message,
    }),
  });

  return graphPost(
    `${encodeURIComponent(instagramUserId)}/messages`,
    token,
    body,
    "message_id"
  );
}

export interface QuickReplyOption {
  content_type: "text";
  title: string;
  payload: string;
}

export async function sendPrivateReplyWithQuickReply(
  instagramUserId: string,
  commentId: string,
  message: string,
  quickReplies: QuickReplyOption[],
  token: string
): Promise<string> {
  const body = new URLSearchParams({
    recipient: JSON.stringify({
      comment_id: commentId,
    }),
    message: JSON.stringify({
      text: message,
      quick_replies: quickReplies,
    }),
  });

  return graphPost(
    `${encodeURIComponent(instagramUserId)}/messages`,
    token,
    body,
    "message_id"
  );
}

export async function sendDirectMessage(
  instagramUserId: string,
  recipientIgsid: string,
  message: string,
  token: string,
  quickReplies?: QuickReplyOption[]
): Promise<string> {
  const messagePayload: { text: string; quick_replies?: QuickReplyOption[] } = {
    text: message,
  };
  if (quickReplies && quickReplies.length > 0) {
    messagePayload.quick_replies = quickReplies;
  }

  const body = new URLSearchParams({
    recipient: JSON.stringify({
      id: recipientIgsid,
    }),
    message: JSON.stringify(messagePayload),
  });

  return graphPost(
    `${encodeURIComponent(instagramUserId)}/messages`,
    token,
    body,
    "message_id"
  );
}

export async function checkUserFollowsBusiness(
  igsid: string,
  token: string
): Promise<{ isFollowing: boolean; name?: string; username?: string }> {
  const baseUrl = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
  const url = new URL(`${baseUrl}/v27.0/${encodeURIComponent(igsid)}`);
  url.searchParams.set("fields", "is_user_follow_business,name,username");
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const json = (await res.json()) as {
    is_user_follow_business?: boolean;
    name?: string;
    username?: string;
    error?: { message?: string };
  };

  if (!res.ok || json.error) {
    throw new MetaApiError(
      json.error?.message || `Failed to check follower status for ${igsid}`,
      res.status,
      json.error
    );
  }

  return {
    isFollowing: Boolean(json.is_user_follow_business),
    name: json.name,
    username: json.username,
  };
}
