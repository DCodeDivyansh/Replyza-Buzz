
import type { RequestHandler } from "express";
import { prisma } from "@replyza/database";
import {
    exchangeInstagramCode,
    getAssignedInstagramAccounts,
    subscribeInstagramAccount
} from "../services/instagram-oauth.service";
import { verifyInstagramOAuthState } from "../utils/instagram-oauth-state";
import { encryptToken } from "../utils/token-encryption";
import { logger } from "../utils/logger";
import { env } from "../config/env";

export const instagramOAuthCallback: RequestHandler = async (
    req,
    res
) => {
    const code =
        req.method === "GET"
            ? req.query.code
            : req.body?.code;

    const state =
        req.method === "GET"
            ? req.query.state
            : req.body?.state;
    const metaError = req.query.error;

    if (typeof metaError === "string") {
        res.status(400).json({
            success: false,
            message: "Instagram authorization was cancelled or denied"
        });
        return;
    }

    if (
        typeof code !== "string" ||
        typeof state !== "string"
    ) {
        res.status(400).json({
            success: false,
            message: "Missing authorization code or state"
        });
        return;
    }

    const statePayload = verifyInstagramOAuthState(state);

    if (!statePayload) {
        res.status(400).json({
            success: false,
            message: "Invalid or expired OAuth state"
        });
        return;
    }

    try {
        const tokenResponse = await exchangeInstagramCode(code, env.META_REDIRECT_URI);
        const accessToken = tokenResponse.access_token;

        if (!accessToken) {
            throw new Error("Meta did not return an access token");
        }

        const accounts = await getAssignedInstagramAccounts(accessToken);

        if (accounts.length === 0) {
            res.status(400).json({
                success: false,
                message: "No Instagram accounts were assigned to this authorization"
            });
            return;
        }

        // MVP: connect the first account returned by Meta.
        const instagramAccount = accounts[0];

        const existingAccount = await prisma.instagramAccount.findUnique({
            where: { instagramUserId: instagramAccount.id }
        });

        if (
            existingAccount &&
            existingAccount.userId !== statePayload.userId
        ) {
            res.status(409).json({
                success: false,
                message: "This Instagram account is already connected to another Replyza user"
            });
            return;
        }

        const encryptedAccessToken = encryptToken(accessToken);

        await prisma.instagramAccount.upsert({
            where: { instagramUserId: instagramAccount.id },
            create: {
                userId: statePayload.userId,
                instagramUserId: instagramAccount.id,
                username: instagramAccount.username ?? null,
                encryptedAccessToken,
                status: "ACTIVE",
                tokenExpiresAt: tokenResponse.expires_in
                    ? new Date(Date.now() + tokenResponse.expires_in * 1000)
                    : null
            },
            update: {
                username: instagramAccount.username ?? null,
                encryptedAccessToken,
                status: "ACTIVE",
                tokenExpiresAt: tokenResponse.expires_in
                    ? new Date(Date.now() + tokenResponse.expires_in * 1000)
                    : null
            }
        });

        // Automatically subscribe linked Page / Instagram account to webhooks
        // Meta Doc: https://developers.facebook.com/documentation/instagram-platform/webhooks
        await subscribeInstagramAccount(instagramAccount.id, accessToken).catch((subErr) => {
            logger.warn({ subErr, instagramUserId: instagramAccount.id }, "Automatic webhook subscription failed during OAuth callback");
        });

        logger.info(
            {
                userId: statePayload.userId,
                instagramUserId: instagramAccount.id,
                username: instagramAccount.username
            },
            "Instagram account connected"
        );

        res.status(200).json({
            success: true,
            message: "Instagram account connected successfully",
            data: {
                instagramUserId: instagramAccount.id,
                username: instagramAccount.username ?? null
            }
        });
    } catch (error) {
        logger.error(
            { err: error },
            "Instagram OAuth callback failed"
        );

        res.status(502).json({
            success: false,
            message: "Unable to connect Instagram. Check the API logs for the Meta error."
        });
    }
};
