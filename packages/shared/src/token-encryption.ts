import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(keyHex: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error("Invalid token encryption key");
  }

  return Buffer.from(keyHex, "hex");
}

export function encryptToken(
  token: string,
  keyHex: string
): string {
  const key = getEncryptionKey(keyHex);
  const iv = randomBytes(12);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptToken(
  encryptedToken: string,
  keyHex: string
): string {
  const key = getEncryptionKey(keyHex);
  const parts = encryptedToken.split(":");

  if (
    parts.length !== 3 ||
    !parts.every(part => /^[a-fA-F0-9]+$/.test(part))
  ) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error("Invalid encrypted token components");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
