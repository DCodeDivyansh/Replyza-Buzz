import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "@replyza/shared";

describe("Token Encryption & Decryption (AES-256-GCM)", () => {
  const validKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const wrongKey = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
  const testToken = "IGAA_mock_token_1234567890_abcdef_long_lived_token";

  it("should successfully round-trip encrypt and decrypt a token", () => {
    const encrypted = encryptToken(testToken, validKey);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(testToken);

    // Format should be iv:authTag:ciphertext
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);

    const decrypted = decryptToken(encrypted, validKey);
    expect(decrypted).toBe(testToken);
  });

  it("should fail decryption when provided the wrong key", () => {
    const encrypted = encryptToken(testToken, validKey);
    expect(() => decryptToken(encrypted, wrongKey)).toThrow();
  });

  it("should fail decryption when ciphertext is tampered with", () => {
    const encrypted = encryptToken(testToken, validKey);
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tamperedCiphertext = ciphertext.slice(0, -2) + (ciphertext.endsWith("0") ? "1" : "0");
    const tampered = `${iv}:${authTag}:${tamperedCiphertext}`;

    expect(() => decryptToken(tampered, validKey)).toThrow();
  });

  it("should reject invalid key formats", () => {
    expect(() => encryptToken(testToken, "short-key")).toThrow("Invalid token encryption key");
    expect(() => encryptToken(testToken, "z".repeat(64))).toThrow("Invalid token encryption key");
  });

  it("should reject malformed encrypted strings", () => {
    expect(() => decryptToken("invalid-format", validKey)).toThrow("Invalid encrypted token format");
    expect(() => decryptToken("part1:part2", validKey)).toThrow("Invalid encrypted token format");
  });
});
