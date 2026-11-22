import { env } from "./env";

export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production"
    ? "none" as const
    : "lax" as const,
  path: "/api/v1/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000
};