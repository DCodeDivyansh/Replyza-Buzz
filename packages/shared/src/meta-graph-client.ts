/**
 * Centralized Meta Graph API Client
 *
 * Implements unified Graph API interaction across the Replyza Monorepo:
 * - Base URL & Version resolution
 * - Centralized timeout (AbortController)
 * - Error categorization & normalization (OAuth 190, Rate Limits, Messaging Window, Permissions)
 * - Safe retries for transient HTTP 5xx errors with exponential backoff & jitter
 * - Sanitized logging (zero access token exposure)
 */

export type MetaErrorCategory =
  | "AUTH_EXPIRED"
  | "PERMISSION_DENIED"
  | "RATE_LIMIT"
  | "MESSAGING_WINDOW_EXPIRED"
  | "DUPLICATE_ACTION"
  | "INVALID_RESOURCE"
  | "NETWORK_OR_TIMEOUT"
  | "UNKNOWN_OUTCOME"
  | "UPSTREAM_TEMPORARY"
  | "UNKNOWN";

export interface MetaGraphErrorDetails {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
  error_user_title?: string;
  error_user_msg?: string;
}

export class MetaGraphError extends Error {
  public readonly category: MetaErrorCategory;
  public readonly statusCode?: number;
  public readonly code?: number;
  public readonly subcode?: number;
  public readonly isTransient: boolean;
  public readonly fbtraceId?: string;

  constructor(
    message: string,
    category: MetaErrorCategory,
    statusCode?: number,
    code?: number,
    subcode?: number,
    isTransient: boolean = false,
    fbtraceId?: string
  ) {
    super(message);
    this.name = "MetaGraphError";
    this.category = category;
    this.statusCode = statusCode;
    this.code = code;
    this.subcode = subcode;
    this.isTransient = isTransient;
    this.fbtraceId = fbtraceId;
  }
}

export interface MetaGraphClientConfig {
  baseUrl?: string;
  apiVersion?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export function classifyMetaError(statusCode: number, errorData?: MetaGraphErrorDetails): {
  category: MetaErrorCategory;
  isTransient: boolean;
} {
  const code = errorData?.code;
  const subcode = errorData?.error_subcode;
  const message = (errorData?.message || "").toLowerCase();

  // OAuth Error 190 (Token Expired / Revoked / Invalidated)
  if (code === 190 || subcode === 463 || subcode === 467 || message.includes("error validating access token")) {
    return { category: "AUTH_EXPIRED", isTransient: false };
  }

  // Rate Limiting (Codes 4, 17, 32, 613, 368)
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 368 || statusCode === 429) {
    return { category: "RATE_LIMIT", isTransient: true };
  }

  // Permissions (Codes 10, 200..299)
  if (code === 10 || (code !== undefined && code >= 200 && code <= 299) || message.includes("permission")) {
    return { category: "PERMISSION_DENIED", isTransient: false };
  }

  // Messaging Window Expired (e.g. 24h window closed or user cannot be messaged)
  if (code === 551 || subcode === 2534014 || message.includes("messaging window") || message.includes("outside the allowed window")) {
    return { category: "MESSAGING_WINDOW_EXPIRED", isTransient: false };
  }

  // Duplicate / Single Reply Constraint (Code 100 with subcode or duplicate message)
  if (message.includes("already been replied to") || message.includes("cannot be replied to more than once") || subcode === 2534005) {
    return { category: "DUPLICATE_ACTION", isTransient: false };
  }

  // Invalid Resource (Not Found)
  if (code === 100 && (subcode === 33 || message.includes("does not exist") || message.includes("unsupported get request"))) {
    return { category: "INVALID_RESOURCE", isTransient: false };
  }

  // Server Temporary Errors (5xx)
  if (statusCode >= 500) {
    return { category: "UPSTREAM_TEMPORARY", isTransient: true };
  }

  return { category: "UNKNOWN", isTransient: false };
}

export class MetaGraphClient {
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config?: MetaGraphClientConfig) {
    this.baseUrl = (config?.baseUrl || process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com").replace(/\/+$/, "");
    this.apiVersion = config?.apiVersion || process.env.META_GRAPH_API_VERSION || "v21.0";
    this.timeoutMs = config?.timeoutMs ?? 10_000;
    this.maxRetries = config?.maxRetries ?? 2;
  }

  private buildUrl(path: string): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    // If path already starts with /vXX.X or is an absolute URL, avoid duplicating version
    if (/^\/v\d+\.\d+\//.test(cleanPath)) {
      return `${this.baseUrl}${cleanPath}`;
    }
    return `${this.baseUrl}/${this.apiVersion}${cleanPath}`;
  }

  public async get<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined>,
    accessToken: string
  ): Promise<T> {
    const url = new URL(this.buildUrl(endpoint));
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    url.searchParams.set("access_token", accessToken);

    return this.executeWithRetry<T>(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  }

  public async post<T>(
    endpoint: string,
    body: Record<string, unknown> | URLSearchParams,
    accessToken: string
  ): Promise<T> {
    const url = new URL(this.buildUrl(endpoint));
    url.searchParams.set("access_token", accessToken);

    let requestBody: string;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (body instanceof URLSearchParams) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      requestBody = body.toString();
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }

    return this.executeWithRetry<T>(url.toString(), {
      method: "POST",
      headers,
      body: requestBody,
    });
  }

  private async executeWithRetry<T>(
    url: string,
    options: RequestInit,
    attempt = 1
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);

      const isTimeout =
        (err instanceof Error && err.name === "AbortError") ||
        (err instanceof Error && err.message.includes("abort"));

      // For network timeout during non-GET requests, outcome is UNKNOWN
      if (options.method !== "GET" && isTimeout) {
        throw new MetaGraphError(
          "Network timeout while communicating with Meta Graph API. Action outcome unknown.",
          "UNKNOWN_OUTCOME",
          undefined,
          undefined,
          undefined,
          false
        );
      }

      if (attempt <= this.maxRetries && (options.method === "GET" || !isTimeout)) {
        const backoff = Math.min(200 * Math.pow(2, attempt - 1), 2000) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, backoff));
        return this.executeWithRetry<T>(url, options, attempt + 1);
      }

      throw new MetaGraphError(
        err instanceof Error ? err.message : "Meta Graph API network failure",
        isTimeout ? "NETWORK_OR_TIMEOUT" : "NETWORK_OR_TIMEOUT",
        undefined,
        undefined,
        undefined,
        true
      );
    } finally {
      clearTimeout(timer);
    }

    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      if (!res.ok) {
        throw new MetaGraphError(
          `Meta Graph API returned HTTP ${res.status} with non-JSON response`,
          res.status >= 500 ? "UPSTREAM_TEMPORARY" : "UNKNOWN",
          res.status,
          undefined,
          undefined,
          res.status >= 500
        );
      }
    }

    if (!res.ok || json.error) {
      const errorData = (json.error || {}) as MetaGraphErrorDetails;
      const { category, isTransient } = classifyMetaError(res.status, errorData);

      if (isTransient && attempt <= this.maxRetries) {
        const backoff = Math.min(300 * Math.pow(2, attempt - 1), 2000) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, backoff));
        return this.executeWithRetry<T>(url, options, attempt + 1);
      }

      throw new MetaGraphError(
        errorData.message || `Meta Graph API request failed with status ${res.status}`,
        category,
        res.status,
        errorData.code,
        errorData.error_subcode,
        isTransient,
        errorData.fbtrace_id
      );
    }

    return json as T;
  }
}

export const defaultMetaGraphClient = new MetaGraphClient();
