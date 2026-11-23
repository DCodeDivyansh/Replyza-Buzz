
import {
  encryptToken as sharedEncryptToken,
  decryptToken as sharedDecryptToken,
} from "@replyza/shared";

import { env } from "../config/env";

export function encryptToken(token: string): string {
  return sharedEncryptToken(
    token,
    env.META_TOKEN_ENCRYPTION_KEY
  );
}

export function decryptToken(encryptedToken: string): string {
  return sharedDecryptToken(
    encryptedToken,
    env.META_TOKEN_ENCRYPTION_KEY
  );
}
