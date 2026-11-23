
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

interface OAuthStatePayload {
  userId: string;
  nonce: string;
  expiresAt: number;
}

function sign(value: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

export function createInstagramOAuthState(userId: string): string {
  const payload: OAuthStatePayload = {
    userId,
    nonce: randomBytes(24).toString("hex"),
    expiresAt: Date.now() + 10 * 60 * 1000
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

export function verifyInstagramOAuthState(
  state: string
): OAuthStatePayload | null {
  const parts = state.split(".");

  if (parts.length !== 2) return null;

  const [encoded, receivedSignature] = parts;
  const expectedSignature = sign(encoded);

  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);

  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as OAuthStatePayload;

    if (
      typeof payload.userId !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt < Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
