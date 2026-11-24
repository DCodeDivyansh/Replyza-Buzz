import type { RequestHandler } from "express";
import crypto from "node:crypto";
import { prisma } from "@replyza/database";
import { env } from "../config/env";
import { logger } from "../utils/logger";

function base64UrlDecode(input: string): Buffer {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

/**
 * Meta User Data Deletion Callback
 *
 * Official Documentation Reference:
 * https://developers.facebook.com/documentation/development/compliance-and-security/data-deletion/
 *
 * Verifies signed_request from Meta using META_APP_SECRET, deletes matching user/account data,
 * and returns confirmation URL and code required by Meta platform policies.
 */
export const handleMetaDataDeletion: RequestHandler = async (req, res, next) => {
  try {
    const signedRequest = req.body?.signed_request || req.query?.signed_request;

    if (typeof signedRequest !== "string" || !signedRequest.includes(".")) {
      res.status(400).json({
        success: false,
        message: "Invalid or missing signed_request parameter",
      });
      return;
    }

    const [encodedSig, encodedPayload] = signedRequest.split(".");

    if (!encodedSig || !encodedPayload) {
      res.status(400).json({
        success: false,
        message: "Malformed signed_request format",
      });
      return;
    }

    // Verify signature
    const sigBuffer = base64UrlDecode(encodedSig);
    const expectedSigBuffer = crypto
      .createHmac("sha256", env.META_APP_SECRET)
      .update(encodedPayload)
      .digest();

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      logger.warn("Meta data deletion callback signature verification failed");
      res.status(403).json({
        success: false,
        message: "Invalid signed_request signature",
      });
      return;
    }

    // Parse payload
    const payloadJson = base64UrlDecode(encodedPayload).toString("utf8");
    let data: { user_id?: string; algorithm?: string };
    try {
      data = JSON.parse(payloadJson);
    } catch {
      res.status(400).json({
        success: false,
        message: "Failed to parse signed_request payload",
      });
      return;
    }

    const metaUserId = data.user_id;
    const confirmationCode = crypto.randomUUID();

    if (metaUserId) {
      const account = await prisma.instagramAccount.findUnique({
        where: { instagramUserId: metaUserId },
      });

      if (account) {
        // Cascade deletion removes connected automations, webhook events, and executions
        await prisma.instagramAccount.delete({
          where: { id: account.id },
        });

        logger.info(
          { metaUserId, accountId: account.id, confirmationCode },
          "Meta data deletion request executed successfully"
        );
      } else {
        logger.info(
          { metaUserId, confirmationCode },
          "Meta data deletion request processed (no matching account found)"
        );
      }
    }

    const statusUrl = `${env.FRONTEND_URL}/data-deletion?id=${confirmationCode}`;

    // Meta-mandated response schema: { url, confirmation_code }
    res.status(200).json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    next(error);
  }
};
