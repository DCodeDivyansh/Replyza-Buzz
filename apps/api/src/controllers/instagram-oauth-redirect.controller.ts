import type { RequestHandler } from "express";
import { prisma } from "@replyza/database";
import { env } from "../config/env";
import {
  exchangeInstagramCode,
  getAssignedInstagramAccounts,
  subscribeInstagramAccount
} from "../services/instagram-oauth.service";
import { verifyInstagramOAuthState } from "../utils/instagram-oauth-state";
import { encryptToken } from "../utils/token-encryption";
import { logger } from "../utils/logger";

function backToApp(status: "connected" | "error", message?: string): string {
  const url = new URL("/instagram", env.FRONTEND_URL);
  url.searchParams.set("instagram", status);

  if (message) {
    url.searchParams.set("message", message);
  }

  return url.toString();
}

// Meta redirects the browser here (GET) after the login dialog.
export const instagramOAuthRedirectCallback: RequestHandler = async (
  req,
  res
) => {
  const { code, state, error } = req.query;

  if (typeof error === "string") {
    res.redirect(
      backToApp("error", "Instagram authorization was cancelled or denied")
    );
    return;
  }

  if (typeof code !== "string" || typeof state !== "string") {
    res.redirect(backToApp("error", "Missing authorization code or state"));
    return;
  }

  const statePayload = verifyInstagramOAuthState(state);

  if (!statePayload) {
    res.redirect(backToApp("error", "Invalid or expired OAuth state"));
    return;
  }

  try {
    // The redirect_uri must be identical to the one used in the login dialog.
    const tokenResponse = await exchangeInstagramCode(
      code,
      env.META_REDIRECT_URI
    );
    const accessToken = tokenResponse.access_token;

    if (!accessToken) {
      throw new Error("Meta did not return an access token");
    }

    const accounts = await getAssignedInstagramAccounts(accessToken);

    if (accounts.length === 0) {
      res.redirect(
        backToApp(
          "error",
          "No Instagram accounts were assigned to this authorization"
        )
      );
      return;
    }

    // MVP: connect the first account returned by Meta.
    const instagramAccount = accounts[0];

    const existingAccount = await prisma.instagramAccount.findUnique({
      where: { instagramUserId: instagramAccount.id }
    });

    if (existingAccount && existingAccount.userId !== statePayload.userId) {
      res.redirect(
        backToApp(
          "error",
          "This Instagram account is already connected to another user"
        )
      );
      return;
    }

    const encryptedAccessToken = encryptToken(accessToken);
    const tokenExpiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    await prisma.instagramAccount.upsert({
      where: { instagramUserId: instagramAccount.id },
      create: {
        userId: statePayload.userId,
        instagramUserId: instagramAccount.id,
        username: instagramAccount.username ?? null,
        encryptedAccessToken,
        status: "ACTIVE",
        tokenExpiresAt
      },
      update: {
        username: instagramAccount.username ?? null,
        encryptedAccessToken,
        status: "ACTIVE",
        tokenExpiresAt
      }
    });

    // Automatically subscribe linked Page / Instagram account to webhooks
    // Meta Doc: https://developers.facebook.com/documentation/instagram-platform/webhooks
    await subscribeInstagramAccount(instagramAccount.id, accessToken).catch((subErr) => {
      logger.warn({ subErr, instagramUserId: instagramAccount.id }, "Automatic webhook subscription failed during redirect callback");
    });

    logger.info(
      {
        userId: statePayload.userId,
        instagramUserId: instagramAccount.id,
        username: instagramAccount.username
      },
      "Instagram account connected"
    );

    res.redirect(backToApp("connected"));
  } catch (err) {
    logger.error({ err }, "Instagram OAuth redirect callback failed");
    res.redirect(
      backToApp("error", "Unable to connect Instagram. Check the API logs.")
    );
  }
};