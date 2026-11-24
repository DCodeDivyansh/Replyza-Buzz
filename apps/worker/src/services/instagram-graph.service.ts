import {
  defaultMetaGraphClient,
  MetaGraphError,
  type MetaGraphErrorDetails,
} from "@replyza/shared";

interface MetaApiSuccess {
  id?: string;
  recipient_id?: string;
  message_id?: string;
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly metaError?: MetaGraphErrorDetails
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
  let result: MetaApiSuccess;
  try {
    result = await defaultMetaGraphClient.post<MetaApiSuccess>(path, body, token);
  } catch (err: unknown) {
    if (err instanceof MetaGraphError) {
      if (err.category === "UNKNOWN_OUTCOME" || err.category === "UPSTREAM_TEMPORARY") {
        throw new MetaApiUnknownOutcomeError(err.message);
      }
      throw new MetaApiError(err.message, err.statusCode || 500, {
        message: err.message,
        code: err.code,
        error_subcode: err.subcode,
        fbtrace_id: err.fbtraceId,
      });
    }
    throw new MetaApiUnknownOutcomeError(
      err instanceof Error ? err.message : "No definitive response received from Meta."
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
  try {
    const json = await defaultMetaGraphClient.get<{
      is_user_follow_business?: boolean;
      name?: string;
      username?: string;
    }>(
      encodeURIComponent(igsid),
      { fields: "is_user_follow_business,name,username" },
      token
    );

    return {
      isFollowing: Boolean(json.is_user_follow_business),
      name: json.name,
      username: json.username,
    };
  } catch (err: unknown) {
    if (err instanceof MetaGraphError) {
      throw new MetaApiError(err.message, err.statusCode || 500, {
        message: err.message,
        code: err.code,
        error_subcode: err.subcode,
        fbtrace_id: err.fbtraceId,
      });
    }
    throw new MetaApiError(
      err instanceof Error ? err.message : `Failed to check follower status for ${igsid}`,
      500
    );
  }
}
