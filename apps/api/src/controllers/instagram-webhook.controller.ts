
import type { RequestHandler } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env";
import { logger } from "../utils/logger";
import { persistInstagramCommentEvents } from "../services/instagram-webhook.service";

function safeCompare(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader) return false;

  const match = signatureHeader.match(/^sha256=([a-f0-9]{64})$/i);

  if (!match) return false;

  const expectedSignature = createHmac("sha256", env.META_APP_SECRET)
    .update(rawBody)
    .digest();

  const receivedSignature = Buffer.from(match[1], "hex");

  return (
    expectedSignature.length === receivedSignature.length &&
    timingSafeEqual(expectedSignature, receivedSignature)
  );
}

export const verifyInstagramWebhook: RequestHandler = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode !== "subscribe" ||
    typeof token !== "string" ||
    typeof challenge !== "string"
  ) {
    res.sendStatus(400);
    return;
  }

  if (!safeCompare(token, env.META_WEBHOOK_VERIFY_TOKEN)) {
    logger.warn("Instagram webhook verification failed");
    res.sendStatus(403);
    return;
  }

  logger.info("Instagram webhook verification successful");

  res.status(200).type("text/plain").send(challenge);
};


export const receiveInstagramWebhook: RequestHandler = async (req, res) => {
  const rawBody = req.rawBody;

  if (!rawBody) {
    res.status(400).json({
      success: false,
      message: "Missing raw request body"
    });
    return;
  }

  const signature = req.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    logger.warn("Instagram webhook signature validation failed");
    res.status(401).json({
      success: false,
      message: "Invalid webhook signature"
    });
    return;
  }

  const body: unknown = req.body;

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid webhook payload"
    });
    return;
  }

  try {
    const result = await persistInstagramCommentEvents(
      body as Record<string, unknown>
    );

    logger.info(
      {
        saved: result.saved,
        duplicates: result.duplicates,
        ignored: result.ignored
      },
      "Instagram webhook events persisted"
    );

    res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    logger.error(
      { err: error },
      "Failed to persist Instagram webhook event"
    );

    res.status(500).json({
      success: false,
      message: "Failed to process webhook event"
    });
  }
};

