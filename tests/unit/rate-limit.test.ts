import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { getClientIp } from "../../apps/api/src/middleware/rate-limit.middleware";
import { env } from "../../apps/api/src/config/env";

describe("Rate Limiting IP Extraction", () => {
  it("trusts x-forwarded-for when valid x-replyza-proxy-secret is present", () => {
    const mockReq = {
      headers: {
        "x-replyza-proxy-secret": env.PROXY_SHARED_SECRET,
        "x-forwarded-for": "203.0.113.195, 198.51.100.1",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as Request;

    const ip = getClientIp(mockReq);
    expect(ip).toBe("203.0.113.195");
  });

  it("ignores spoofed x-forwarded-for when proxy secret is missing", () => {
    const mockReq = {
      headers: {
        "x-forwarded-for": "203.0.113.195",
      },
      socket: { remoteAddress: "192.168.1.50" },
    } as unknown as Request;

    const ip = getClientIp(mockReq);
    expect(ip).toBe("192.168.1.50");
  });

  it("ignores spoofed x-forwarded-for when proxy secret is incorrect", () => {
    const mockReq = {
      headers: {
        "x-replyza-proxy-secret": "wrong_secret_attack",
        "x-forwarded-for": "203.0.113.195",
      },
      socket: { remoteAddress: "192.168.1.50" },
    } as unknown as Request;

    const ip = getClientIp(mockReq);
    expect(ip).toBe("192.168.1.50");
  });

  it("falls back to remoteAddress when no forwarded header exists even with secret", () => {
    const mockReq = {
      headers: {
        "x-replyza-proxy-secret": env.PROXY_SHARED_SECRET,
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as Request;

    const ip = getClientIp(mockReq);
    expect(ip).toBe("127.0.0.1");
  });
});
