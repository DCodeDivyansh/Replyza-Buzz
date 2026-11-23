
import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";
import { env } from "../config/env";

const algorithm = "aes-256-gcm";
const key = Buffer.from(env.META_TOKEN_ENCRYPTION_KEY, "hex");

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex")
  ].join(":");
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedToken.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted token format");
  }

  const decipher = createDecipheriv(
    algorithm,
    key,
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]).toString("utf8");
}
