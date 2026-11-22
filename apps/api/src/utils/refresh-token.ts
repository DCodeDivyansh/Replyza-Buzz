
import { randomBytes, createHash, randomUUID } from "node:crypto";

export function generateRefreshToken() {
  // Generate 512 bits of cryptographically secure randomness.
  const token = randomBytes(64).toString("base64url");

  // Store only the SHA-256 hash in PostgreSQL.
  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  return {
    token,
    tokenHash
  };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function generateTokenFamilyId(): string {
  return randomUUID();
}
