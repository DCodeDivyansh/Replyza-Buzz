import { ApiResponse } from "@/types/api";

export class ApiClientError extends Error {
  public status: number;
  public data?: ApiResponse<unknown>;
  public validationErrors?: Array<{ field?: string; message: string }>;

  constructor(status: number, message: string, data?: ApiResponse<unknown>) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.data = data;

    if (data?.errors) {
      if (Array.isArray(data.errors)) {
        this.validationErrors = data.errors;
      } else if (typeof data.errors === "object") {
        // Flatten object errors if backend returned { field: ["error"] }
        const errs: Array<{ field: string; message: string }> = [];
        for (const [field, msgs] of Object.entries(data.errors)) {
          if (Array.isArray(msgs)) {
            msgs.forEach((m) => errs.push({ field, message: String(m) }));
          }
        }
        this.validationErrors = errs;
      }
    }
  }
}

// In-memory access token storage
let currentAccessToken: string | null = null;
let lastRefreshTime = 0;
let refreshPromise: Promise<string | null> | null = null;
let onTokenExpiredCallback: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  currentAccessToken = token;
  if (token) {
    lastRefreshTime = Date.now();
  }
}

export function getAccessToken(): string | null {
  return currentAccessToken;
}

export function setOnTokenExpired(callback: () => void) {
  onTokenExpiredCallback = callback;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRefreshOn401?: boolean;
}

/**
 * Execute session refresh. Ensures single-flight execution to respect refresh-token rotation.
 */
export async function refreshSession(): Promise<string | null> {
  // If we refreshed within the last 2 seconds and already have a token, reuse it
  if (currentAccessToken && Date.now() - lastRefreshTime < 2000) {
    return currentAccessToken;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/proxy/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-protection": "1",
        },
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        setAccessToken(null);
        return null;
      }

      const json = (await response.json()) as ApiResponse<{ accessToken: string }>;
      if (json.success && json.data?.accessToken) {
        setAccessToken(json.data.accessToken);
        lastRefreshTime = Date.now();
        return json.data.accessToken;
      }

      setAccessToken(null);
      return null;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const isPublicAuthRoute = (p: string): boolean =>
  ["/auth/login", "/auth/register", "/auth/refresh"].some((route) => p.startsWith(route));

/**
 * Primary HTTP request wrapper with centralized error handling and auto-refresh on 401.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { skipAuth = false, skipRefreshOn401 = false, ...fetchOptions } = options;

  // Prefix with /api/proxy unless already an absolute path
  const url = path.startsWith("/") ? `/api/proxy${path}` : `/api/proxy/${path}`;

  const headers = new Headers(fetchOptions.headers || {});

  if (!headers.has("Content-Type") && fetchOptions.body && typeof fetchOptions.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  // Include CSRF header for state-changing requests
  if (["POST", "PATCH", "DELETE", "PUT"].includes(fetchOptions.method?.toUpperCase() || "")) {
    headers.set("x-csrf-protection", "1");
  }

  // Attach Bearer access token if available and not skipped.
  // If token is missing on an authenticated route, attempt to acquire via session refresh first.
  if (!skipAuth && !headers.has("Authorization") && !isPublicAuthRoute(path)) {
    if (!currentAccessToken) {
      await refreshSession();
    }
    if (currentAccessToken) {
      headers.set("Authorization", `Bearer ${currentAccessToken}`);
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiClientError(503, "Network request failed. Please check your connection.");
  }

  // Handle 401 Unauthorized: Attempt token refresh once if authenticated
  if (res.status === 401 && !skipAuth && !skipRefreshOn401 && !isPublicAuthRoute(path)) {
    const newToken = await refreshSession();
    if (newToken) {
      // Retry original request with new token
      headers.set("Authorization", `Bearer ${newToken}`);
      try {
        res = await fetch(url, {
          ...fetchOptions,
          headers,
          credentials: "include",
        });
      } catch {
        throw new ApiClientError(503, "Network request failed during retry.");
      }
    } else {
      // Session expired completely
      if (onTokenExpiredCallback) {
        onTokenExpiredCallback();
      }
    }
  }

  let responseData: ApiResponse<T>;
  try {
    responseData = await res.json();
  } catch {
    throw new ApiClientError(
      res.status,
      res.ok ? "Invalid response from server" : `Request failed with status ${res.status}`
    );
  }

  if (!res.ok || responseData.success === false) {
    const message = responseData.message || `Request failed with status ${res.status}`;
    throw new ApiClientError(res.status, message, responseData);
  }

  return responseData;
}
