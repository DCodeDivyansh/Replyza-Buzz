import {
  defaultMetaGraphClient,
  MetaGraphError,
  type MetaErrorCategory,
  type MetaGraphErrorDetails,
} from "@replyza/shared";

interface MetaApiSuccess {
  id?: string;
  recipient_id?: string;
  message_id?: string;
}

export class MetaApiError extends Error {
  public readonly category: MetaErrorCategory;
  public readonly isTransient: boolean;
  public readonly retryAfterMs?: number;

  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly metaError?: MetaGraphErrorDetails,
    category: MetaErrorCategory = "UNKNOWN",
    isTransient: boolean = false,
    retryAfterMs?: number
  ) {
    super(message);
    this.name = "MetaApiError";
    this.category = category;
    this.isTransient = isTransient;
    this.retryAfterMs = retryAfterMs;
  }
}

export class MetaApiUnknownOutcomeError extends Error {
  public readonly httpStatus?: number;
  public readonly metaError?: MetaGraphErrorDetails;

  constructor(
    message: string,
    httpStatus?: number,
    metaError?: MetaGraphErrorDetails
  ) {
    super(message);
    this.name = "MetaApiUnknownOutcomeError";
    this.httpStatus = httpStatus;
    this.metaError = metaError;
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
      const details: MetaGraphErrorDetails = {
        message: err.message,
        code: err.code,
        error_subcode: err.subcode,
        fbtrace_id: err.fbtraceId,
      };
      if (err.category === "UNKNOWN_OUTCOME") {
        throw new MetaApiUnknownOutcomeError(err.message, err.statusCode, details);
      }
      throw new MetaApiError(
        err.message,
        err.statusCode || 500,
        details,
        err.category,
        err.isTransient,
        err.retryAfterMs
      );
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

export type FollowVerificationOutcome =
  | "VERIFIED"
  | "NOT_FOLLOWING"
  | "UNSUPPORTED"
  | "PERMISSION_DENIED"
  | "TRANSIENT_ERROR"
  | "UNKNOWN";

export interface FollowCheckResult {
  outcome: FollowVerificationOutcome;
  isFollowing: boolean;
  name?: string;
  username?: string;
  errorMessage?: string;
}

/**
 * Reconcile an UNKNOWN public comment reply by querying Meta's GET /{comment-id}/replies
 * endpoint. Returns the matching reply ID if found, or null if not found / unable to verify.
 * Meta Documentation: https://developers.facebook.com/documentation/instagram-platform/comment-moderation
 */
export async function reconcileCommentReply(
  commentId: string,
  expectedMessage: string,
  instagramUserId: string,
  token: string
): Promise<string | null> {
  try {
    const res = await defaultMetaGraphClient.get<{
      data?: Array<{ id?: string; text?: string; from?: { id?: string } }>;
    }>(
      `${encodeURIComponent(commentId)}/replies`,
      { fields: "id,text,from", limit: 25 },
      token
    );

    const replies = Array.isArray(res.data) ? res.data : [];
    const normalizedExpected = expectedMessage.trim();
    const match = replies.find((r) => {
      if (!r.id || typeof r.text !== "string") return false;
      const textMatches = r.text.trim() === normalizedExpected;
      if (!textMatches) return false;
      // If `from.id` is returned, verify it matches our business account
      if (r.from?.id && r.from.id !== instagramUserId) return false;
      return true;
    });

    return match?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Checks whether an Instagram-scoped user (IGSID) follows the connected business account.
 * Meta Documentation: https://developers.facebook.com/documentation/instagram-platform/reference/instagram-user
 *
 * IMPORTANT: If `is_user_follow_business` is omitted by Meta (e.g. unsupported access level,
 * user privacy restriction, or API capability limitation), this returns outcome = "UNSUPPORTED"
 * rather than falsely reporting NOT_FOLLOWING.
 */
export async function checkUserFollowsBusiness(
  igsid: string,
  token: string
): Promise<FollowCheckResult> {
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

    if (typeof json.is_user_follow_business !== "boolean") {
      return {
        outcome: "UNSUPPORTED",
        isFollowing: false,
        name: json.name,
        username: json.username,
        errorMessage:
          "Meta Graph API did not return 'is_user_follow_business'. Follow verification is unavailable for this user or app access level.",
      };
    }

    return {
      outcome: json.is_user_follow_business ? "VERIFIED" : "NOT_FOLLOWING",
      isFollowing: json.is_user_follow_business,
      name: json.name,
      username: json.username,
    };
  } catch (err: unknown) {
    if (err instanceof MetaGraphError) {
      if (err.category === "AUTH_EXPIRED") {
        throw new MetaApiError(
          err.message,
          err.statusCode || 401,
          {
            message: err.message,
            code: err.code,
            error_subcode: err.subcode,
            fbtrace_id: err.fbtraceId,
          },
          err.category,
          false
        );
      }

      if (err.category === "PERMISSION_DENIED") {
        return {
          outcome: "PERMISSION_DENIED",
          isFollowing: false,
          errorMessage: err.message,
        };
      }

      if (
        err.category === "INVALID_RESOURCE" ||
        err.message.toLowerCase().includes("nonexisting field") ||
        err.message.toLowerCase().includes("unsupported get request")
      ) {
        return {
          outcome: "UNSUPPORTED",
          isFollowing: false,
          errorMessage: err.message,
        };
      }

      if (err.isTransient || err.category === "RATE_LIMIT" || err.category === "UPSTREAM_TEMPORARY" || err.category === "NETWORK_OR_TIMEOUT") {
        return {
          outcome: "TRANSIENT_ERROR",
          isFollowing: false,
          errorMessage: err.message,
        };
      }

      return {
        outcome: "UNKNOWN",
        isFollowing: false,
        errorMessage: err.message,
      };
    }

    return {
      outcome: "UNKNOWN",
      isFollowing: false,
      errorMessage:
        err instanceof Error ? err.message : `Failed to check follower status for ${igsid}`,
    };
  }
}
