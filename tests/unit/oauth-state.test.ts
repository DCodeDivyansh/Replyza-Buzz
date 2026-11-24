import { describe, it, expect } from "vitest";
import {
  createInstagramOAuthState,
  verifyInstagramOAuthState,
} from "../../apps/api/src/utils/instagram-oauth-state";

describe("OAuth State Sign / Verify / Expiry / Tampering", () => {
  const userId = "123e4567-e89b-12d3-a456-426614174000";

  it("should create and verify a valid state", () => {
    const state = createInstagramOAuthState(userId);
    expect(state).toBeDefined();

    const verified = verifyInstagramOAuthState(state);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(userId);
    expect(verified?.nonce).toBeDefined();
    expect(verified?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should reject tampered payload", () => {
    const state = createInstagramOAuthState(userId);
    const [payload, signature] = state.split(".");

    // Alter one character in base64url payload
    const tamperedPayload = payload.slice(0, -2) + (payload.endsWith("a") ? "b" : "a");
    const tamperedState = `${tamperedPayload}.${signature}`;

    expect(verifyInstagramOAuthState(tamperedState)).toBeNull();
  });

  it("should reject tampered signature", () => {
    const state = createInstagramOAuthState(userId);
    const [payload, signature] = state.split(".");

    const tamperedSignature = signature.slice(0, -2) + (signature.endsWith("x") ? "y" : "x");
    const tamperedState = `${payload}.${tamperedSignature}`;

    expect(verifyInstagramOAuthState(tamperedState)).toBeNull();
  });

  it("should reject expired state", () => {
    // Construct an expired state with valid signature
    const expiredPayload = {
      userId,
      nonce: "mock_nonce_12345",
      expiresAt: Date.now() - 1000, // 1 second in the past
    };

    const encoded = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
    // We sign it using the same HMAC mechanism
    const { createHmac } = require("node:crypto");
    const signature = createHmac("sha256", process.env.SESSION_SECRET!)
      .update(encoded)
      .digest("base64url");

    const expiredState = `${encoded}.${signature}`;
    expect(verifyInstagramOAuthState(expiredState)).toBeNull();
  });

  it("should reject state without signature delimiter", () => {
    expect(verifyInstagramOAuthState("malformed_state_without_dots")).toBeNull();
    expect(verifyInstagramOAuthState("too.many.dots.here")).toBeNull();
  });
});
