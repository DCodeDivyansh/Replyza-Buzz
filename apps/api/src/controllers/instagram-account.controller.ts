import type { RequestHandler } from "express";
import { prisma } from "@replyza/database";
import { logger } from "../utils/logger";
import { decryptToken } from "../utils/token-encryption";
import { subscribeInstagramAccount } from "../services/instagram-oauth.service";

/**
 * List connected Instagram accounts for the authenticated user.
 * Meta Documentation Reference:
 * https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram
 */
export const listInstagramAccounts: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const accounts = await prisma.instagramAccount.findMany({
      where: { userId },
      select: {
        id: true,
        instagramUserId: true,
        username: true,
        status: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Re-subscribes an Instagram account or linked Page to Meta webhooks.
 * Meta Documentation Reference:
 * https://developers.facebook.com/documentation/instagram-platform/webhooks
 */
export const subscribeAccount: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const accountId = req.params.id as string;

    const account = await prisma.instagramAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      res.status(404).json({
        success: false,
        message: "Instagram account not found",
      });
      return;
    }

    const decryptedToken = decryptToken(account.encryptedAccessToken);

    const subResult = await subscribeInstagramAccount(
      account.instagramUserId,
      decryptedToken
    );

    if (!subResult.success) {
      res.status(502).json({
        success: false,
        message: subResult.error || "Failed to subscribe account to webhooks",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Successfully subscribed to Instagram webhooks",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect (delete) a connected Instagram account for the authenticated user.
 */
export const deleteInstagramAccount: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const accountId = req.params.id as string;

    const account = await prisma.instagramAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      res.status(404).json({
        success: false,
        message: "Instagram account not found",
      });
      return;
    }

    await prisma.instagramAccount.delete({
      where: { id: accountId },
    });

    logger.info(
      { userId, accountId, instagramUserId: account.instagramUserId },
      "Instagram account disconnected"
    );

    res.status(200).json({
      success: true,
      message: "Instagram account disconnected successfully",
    });
  } catch (error) {
    next(error);
  }
};
