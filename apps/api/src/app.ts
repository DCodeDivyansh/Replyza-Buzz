
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import type { Request } from "express";
import crypto from "node:crypto";

import { env } from "./config/env";
import { logger } from "./utils/logger";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import automationRoutes from "./routes/automation.routes";
import instagramWebhookRoutes from "./routes/instagram-webhook.routes";
import instagramOAuthRoutes from "./routes/instagram-oauth.routes";
import instagramAccountRoutes from "./routes/instagram-account.routes";
import metaRoutes from "./routes/meta.routes";

import { notFoundHandler } from "./middleware/not-found.middleware";
import { errorHandler } from "./middleware/error.middleware";

const app = express();

app.set("trust proxy", 1);

app.disable("x-powered-by");

// Generate a unique CSP nonce for every request.
app.use((_req, res, next) => {
  const nonce = crypto.randomBytes(16).toString("base64");
  res.locals.cspNonce = nonce;

  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' https://connect.facebook.net`,
      "connect-src 'self' https://connect.facebook.net https://graph.facebook.com https://www.facebook.com",
      "frame-src 'self' https://www.facebook.com https://web.facebook.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:"
    ].join("; ")
  );

  next();
});

// Security headers. CSP is set by the nonce middleware above.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups"
    }
  })
);

// Allow requests from our frontend.
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true
  })
);

// Log incoming HTTP requests.
app.use(pinoHttp({ logger }));

// Parse incoming JSON and preserve raw body for Meta signature validation.
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      (req as Request).rawBody = Buffer.from(buffer);
    }
  })
);

// Parse incoming cookies.
app.use(cookieParser());

// API routes.
app.use("/api/v1", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/automations", automationRoutes);
app.use("/api/v1/webhooks", instagramWebhookRoutes);
app.use("/api/v1/instagram/oauth", instagramOAuthRoutes);
app.use("/api/v1/instagram", instagramAccountRoutes);
app.use("/api/v1/meta", metaRoutes);

// Error handling must come after all routes.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
