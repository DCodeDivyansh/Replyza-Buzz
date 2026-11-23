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
  body: URLSearchParams
): Promise<MetaApiSuccess> {
  const url =
    `https://graph.facebook.com/${workerEnv.metaGraphApiVersion}/${path}`;

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

  let result: MetaApiSuccess | { error?: MetaApiErrorPayload };

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
      error?.message ?? `Meta API rejected the request (HTTP ${response.status}).`,
      response.status,
      error
    );
  }

  if (!("id" in result) || !result.id) {
    throw new MetaApiUnknownOutcomeError(
      "Meta accepted the request but did not return a reply ID."
    );
  }

  return result;
}

export async function publishCommentReply(
  commentId: string,
  message: string,
  token: string
): Promise<string> {
  const body = new URLSearchParams({ message });

  const result = await graphPost(
    `${encodeURIComponent(commentId)}/replies`,
    token,
    body
  );

  return result.id!;
}
