import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "FOLLOW_CHECK:";
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function computeHmac(executionId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`follow-check:${executionId}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Generates an HMAC-signed Quick Reply payload for Follow-to-Get-Link flows.
 * Format: FOLLOW_CHECK:<executionId>.<32-hex-hmac>
 */
export function signFollowCheckPayload(
  executionId: string,
  secret: string
): string {
  if (!secret) {
    throw new Error("Signing secret is required for FOLLOW_CHECK payload");
  }
  const sig = computeHmac(executionId, secret);
  return `${PREFIX}${executionId}.${sig}`;
}

/**
 * Verifies an incoming FOLLOW_CHECK payload using constant-time comparison.
 * Rejects unsigned or tampered payloads and returns null.
 */
export function verifyFollowCheckPayload(
  payload: string,
  secret: string
): string | null {
  if (!secret || typeof payload !== "string" || !payload.startsWith(PREFIX)) {
    return null;
  }

  const body = payload.slice(PREFIX.length);
  const dotIdx = body.indexOf(".");
  if (dotIdx <= 0) {
    return null;
  }

  const executionId = body.slice(0, dotIdx);
  const providedSig = body.slice(dotIdx + 1);

  if (!UUID_REGEX.test(executionId) || !/^[a-f0-9]{32}$/i.test(providedSig)) {
    return null;
  }

  const expectedSig = computeHmac(executionId, secret);
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  const providedBuf = Buffer.from(providedSig.toLowerCase(), "utf8");

  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return null;
  }

  return executionId;
}
