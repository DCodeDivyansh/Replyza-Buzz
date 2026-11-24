
import { rateLimit } from "express-rate-limit";
import type { Request } from "express";
import { env } from "../config/env";

/**
 * Derives client IP safely.
 * Only trusts 'x-forwarded-for' header if a valid 'x-replyza-proxy-secret' is provided by Next.js proxy.
 * Otherwise falls back to raw socket remoteAddress to prevent IP spoofing attacks.
 */
export function getClientIp(req: Request): string {
  const proxySecret = req.headers["x-replyza-proxy-secret"];
  const isValidProxy = typeof proxySecret === "string" && proxySecret === env.PROXY_SHARED_SECRET;

  if (isValidProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim().length > 0) {
      return forwarded.split(",")[0].trim();
    }
  }

  return req.socket.remoteAddress || req.ip || "unknown";
}

// General authentication endpoint limit.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

// Login: stricter protection against password guessing.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => getClientIp(req),
  message: {
    success: false,
    message: "Too many login attempts. Please try again later."
  }
});

// Registration: prevent automated account creation.
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later."
  }
});
