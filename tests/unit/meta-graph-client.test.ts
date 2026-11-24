import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MetaGraphClient,
  MetaGraphError,
} from "../../packages/shared/src/meta-graph-client";

describe("MetaGraphClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("executes successful POST once and returns parsed JSON", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "reply_12345" }),
    } as Response);
    global.fetch = fetchSpy;

    const client = new MetaGraphClient({
      baseUrl: "https://graph.facebook.com",
      apiVersion: "v21.0",
      maxRetries: 2,
    });

    const result = await client.post<{ id: string }>(
      "comment_123/replies",
      new URLSearchParams({ message: "Hello!" }),
      "test_token_secret"
    );

    expect(result).toEqual({ id: "reply_12345" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("https://graph.facebook.com/v21.0/comment_123/replies");
    expect(calledInit.method).toBe("POST");
  });

  it("does NOT retry non-idempotent POST on 429 rate limit and retains Meta error details", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: "(#4) Application request limit reached",
          type: "OAuthException",
          code: 4,
          error_subcode: 1349210,
          fbtrace_id: "trace_429",
        },
      }),
    } as Response);
    global.fetch = fetchSpy;

    const client = new MetaGraphClient({ maxRetries: 2 });

    let caught: unknown;
    try {
      await client.post("comment_123/replies", { message: "Hi" }, "tok");
    } catch (err) {
      caught = err;
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(MetaGraphError);
    const metaErr = caught as MetaGraphError;
    expect(metaErr.category).toBe("RATE_LIMIT");
    expect(metaErr.statusCode).toBe(429);
    expect(metaErr.code).toBe(4);
    expect(metaErr.subcode).toBe(1349210);
    expect(metaErr.message).toBe("(#4) Application request limit reached");
    expect(metaErr.fbtraceId).toBe("trace_429");
    expect(metaErr.isTransient).toBe(true);
  });

  it.each([500, 502, 503, 504])(
    "does NOT retry non-idempotent POST on HTTP %i and classifies as UNKNOWN_OUTCOME (isTransient=false) while preserving Meta metadata",
    async (status) => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({
          error: {
            message: `Upstream failure HTTP ${status}`,
            code: 2,
            error_subcode: 99,
            fbtrace_id: `trace_${status}`,
          },
        }),
      } as Response);
      global.fetch = fetchSpy;

      const client = new MetaGraphClient({ maxRetries: 2 });

      let caught: unknown;
      try {
        await client.post("comment_123/replies", { message: "Hi" }, "tok");
      } catch (err) {
        caught = err;
      }

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(caught).toBeInstanceOf(MetaGraphError);
      const metaErr = caught as MetaGraphError;
      expect(metaErr.category).toBe("UNKNOWN_OUTCOME");
      expect(metaErr.isTransient).toBe(false);
      expect(metaErr.statusCode).toBe(status);
      expect(metaErr.code).toBe(2);
      expect(metaErr.subcode).toBe(99);
      expect(metaErr.message).toBe(`Upstream failure HTTP ${status}`);
      expect(metaErr.fbtraceId).toBe(`trace_${status}`);
    }
  );

  it("treats truncated non-JSON 200 OK on POST as ambiguous UNKNOWN_OUTCOME (isTransient=false)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as unknown as Response);
    global.fetch = fetchSpy;

    const client = new MetaGraphClient({ maxRetries: 2 });

    let caught: unknown;
    try {
      await client.post("comment_123/replies", { message: "Hi" }, "tok");
    } catch (err) {
      caught = err;
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(MetaGraphError);
    const metaErr = caught as MetaGraphError;
    expect(metaErr.category).toBe("UNKNOWN_OUTCOME");
    expect(metaErr.isTransient).toBe(false);
    expect(metaErr.statusCode).toBe(200);
  });

  it("does NOT retry non-idempotent POST on connection reset and classifies as UNKNOWN_OUTCOME", async () => {
    const connErr = new Error("read ECONNRESET");
    const fetchSpy = vi.fn().mockRejectedValue(connErr);
    global.fetch = fetchSpy;

    const client = new MetaGraphClient({ maxRetries: 2 });

    let caught: unknown;
    try {
      await client.post("comment_123/replies", { message: "Hi" }, "tok");
    } catch (err) {
      caught = err;
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(MetaGraphError);
    const metaErr = caught as MetaGraphError;
    expect(metaErr.category).toBe("UNKNOWN_OUTCOME");
    expect(metaErr.isTransient).toBe(false);
    expect(metaErr.message).toContain("ECONNRESET");
  });

  it("does NOT retry non-idempotent POST on timeout and classifies as UNKNOWN_OUTCOME", async () => {
    const fetchSpy = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const abortErr = new Error("The operation was aborted");
          abortErr.name = "AbortError";
          reject(abortErr);
        });
      });
    });
    global.fetch = fetchSpy;

    const client = new MetaGraphClient({ timeoutMs: 25, maxRetries: 2 });

    let caught: unknown;
    try {
      await client.post("comment_123/replies", { message: "Hi" }, "tok");
    } catch (err) {
      caught = err;
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(MetaGraphError);
    const metaErr = caught as MetaGraphError;
    expect(metaErr.category).toBe("UNKNOWN_OUTCOME");
    expect(metaErr.isTransient).toBe(false);
  });

  it("safely retries idempotent GET on 429 and 5xx and succeeds when upstream recovers", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: "Rate limit", code: 17 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("Bad Gateway HTML");
        },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "media_1" }] }),
      } as Response);
    global.fetch = fetchSpy;

    const client = new MetaGraphClient({ maxRetries: 2 });
    const res = await client.get<{ data: { id: string }[] }>(
      "ig_123/media",
      { limit: 10 },
      "tok"
    );

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(res.data).toEqual([{ id: "media_1" }]);
  });

  it("safely retries idempotent GET on connection reset and throws NETWORK_OR_TIMEOUT if exhausted", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("socket hang up"));
    global.fetch = fetchSpy;

    const client = new MetaGraphClient({ maxRetries: 1 });

    let caught: unknown;
    try {
      await client.get("ig_123/media", {}, "tok");
    } catch (err) {
      caught = err;
    }

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(caught).toBeInstanceOf(MetaGraphError);
    const metaErr = caught as MetaGraphError;
    expect(metaErr.category).toBe("NETWORK_OR_TIMEOUT");
    expect(metaErr.isTransient).toBe(true);
  });

  it("does not retry non-transient 400 Meta errors on GET and preserves code/subcode", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: "Error validating access token: Session has expired",
          code: 190,
          error_subcode: 463,
          fbtrace_id: "trace_190",
        },
      }),
    } as Response);
    global.fetch = fetchSpy;

    const client = new MetaGraphClient({ maxRetries: 2 });

    let caught: unknown;
    try {
      await client.get("me/assigned_instagram_accounts", {}, "tok");
    } catch (err) {
      caught = err;
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(MetaGraphError);
    const metaErr = caught as MetaGraphError;
    expect(metaErr.category).toBe("AUTH_EXPIRED");
    expect(metaErr.statusCode).toBe(400);
    expect(metaErr.code).toBe(190);
    expect(metaErr.subcode).toBe(463);
  });
});
