import { prisma } from "@replyza/database";
import {
  buildCuelinksDeepLink,
  isCuelinksUrl,
  isValidHttpUrl,
} from "@replyza/shared";
import { decryptToken, encryptToken } from "../utils/token-encryption";
import { logger } from "../utils/logger";
import type {
  ConvertCuelinksInput,
  UpsertCuelinksInput,
} from "../validators/cuelinks.validator";

export class CuelinksError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "CuelinksError";
  }
}

export interface CuelinksStatusResponse {
  connected: boolean;
  provider: "CUELINKS";
  publisherId: string | null;
  hasApiKey: boolean;
  isEnabled: boolean;
  updatedAt: Date | null;
}

export async function getCuelinksIntegration(
  userId: string
): Promise<CuelinksStatusResponse> {
  const row = await prisma.affiliateIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "CUELINKS",
      },
    },
    select: {
      publisherId: true,
      apiKeyEncrypted: true,
      isEnabled: true,
      updatedAt: true,
    },
  });

  if (!row) {
    return {
      connected: false,
      provider: "CUELINKS",
      publisherId: null,
      hasApiKey: false,
      isEnabled: false,
      updatedAt: null,
    };
  }

  return {
    connected: true,
    provider: "CUELINKS",
    publisherId: row.publisherId,
    hasApiKey: Boolean(row.apiKeyEncrypted),
    isEnabled: row.isEnabled,
    updatedAt: row.updatedAt,
  };
}

export async function upsertCuelinksIntegration(
  userId: string,
  input: UpsertCuelinksInput
): Promise<CuelinksStatusResponse> {
  const existing = await prisma.affiliateIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "CUELINKS",
      },
    },
    select: { apiKeyEncrypted: true },
  });

  let nextEncryptedKey: string | null | undefined;
  if (input.apiKey === undefined) {
    nextEncryptedKey = existing?.apiKeyEncrypted ?? null;
  } else if (input.apiKey === null || input.apiKey === "") {
    nextEncryptedKey = null;
  } else {
    nextEncryptedKey = encryptToken(input.apiKey);
  }

  const saved = await prisma.affiliateIntegration.upsert({
    where: {
      userId_provider: {
        userId,
        provider: "CUELINKS",
      },
    },
    create: {
      userId,
      provider: "CUELINKS",
      publisherId: input.publisherId,
      apiKeyEncrypted: nextEncryptedKey,
      isEnabled: input.isEnabled ?? true,
    },
    update: {
      publisherId: input.publisherId,
      apiKeyEncrypted: nextEncryptedKey,
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
    },
    select: {
      publisherId: true,
      apiKeyEncrypted: true,
      isEnabled: true,
      updatedAt: true,
    },
  });

  return {
    connected: true,
    provider: "CUELINKS",
    publisherId: saved.publisherId,
    hasApiKey: Boolean(saved.apiKeyEncrypted),
    isEnabled: saved.isEnabled,
    updatedAt: saved.updatedAt,
  };
}

export async function deleteCuelinksIntegration(
  userId: string
): Promise<{ disconnected: boolean }> {
  const res = await prisma.affiliateIntegration.deleteMany({
    where: {
      userId,
      provider: "CUELINKS",
    },
  });
  return { disconnected: res.count > 0 };
}

async function tryCuelinksShortLinkApi(
  apiKey: string,
  publisherId: string,
  targetUrl: string,
  subid?: string
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch("https://www.cuelinks.com/api/v2/links.json", {
      method: "POST",
      headers: {
        Authorization: `Token token=${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        channel_id: publisherId,
        subid: subid?.trim() || "replyza",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn(
        { status: res.status },
        "Cuelinks short-link API returned non-OK status; falling back to deeplink"
      );
      return null;
    }

    const json = (await res.json()) as {
      short_url?: string;
      affiliate_url?: string;
      link?: string;
      url?: string;
      data?: { short_url?: string; affiliate_url?: string; url?: string };
    };
    const candidate =
      json.short_url ||
      json.affiliate_url ||
      json.link ||
      json.data?.short_url ||
      json.data?.affiliate_url ||
      json.data?.url ||
      json.url;

    if (typeof candidate === "string" && isValidHttpUrl(candidate)) {
      return candidate;
    }
    return null;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "Cuelinks short-link API failed or timed out; falling back to deeplink"
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function convertToCuelinksUrl(
  userId: string,
  input: ConvertCuelinksInput
): Promise<{
  originalUrl: string;
  affiliateUrl: string;
  method: "api" | "deeplink";
  alreadyConverted: boolean;
}> {
  const integration = await prisma.affiliateIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "CUELINKS",
      },
    },
    select: {
      publisherId: true,
      apiKeyEncrypted: true,
      isEnabled: true,
    },
  });

  if (!integration || !integration.isEnabled) {
    throw new CuelinksError(
      "Cuelinks is not connected. Add your Publisher ID in Settings → Integrations.",
      400
    );
  }

  const cleanUrl = input.url.trim();

  if (isCuelinksUrl(cleanUrl)) {
    return {
      originalUrl: cleanUrl,
      affiliateUrl: cleanUrl,
      method: "deeplink",
      alreadyConverted: true,
    };
  }

  if (integration.apiKeyEncrypted) {
    let apiKey: string | null = null;
    try {
      apiKey = decryptToken(integration.apiKeyEncrypted);
    } catch {
      logger.warn({ userId }, "Failed to decrypt Cuelinks API key; falling back to deeplink");
    }

    if (apiKey) {
      const shortUrl = await tryCuelinksShortLinkApi(
        apiKey,
        integration.publisherId,
        cleanUrl,
        input.subid
      );
      if (shortUrl) {
        return {
          originalUrl: cleanUrl,
          affiliateUrl: shortUrl,
          method: "api",
          alreadyConverted: false,
        };
      }
    }
  }

  const deepLink = buildCuelinksDeepLink(
    integration.publisherId,
    cleanUrl,
    input.subid
  );

  return {
    originalUrl: cleanUrl,
    affiliateUrl: deepLink,
    method: "deeplink",
    alreadyConverted: false,
  };
}
