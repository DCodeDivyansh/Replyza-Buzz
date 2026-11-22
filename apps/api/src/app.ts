
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import type { Request } from "express";

import { env } from "./config/env";
import { logger } from "./utils/logger";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";

import { notFoundHandler } from "./middleware/not-found.middleware";
import { errorHandler } from "./middleware/error.middleware";

import automationRoutes from "./routes/automation.routes";
import instagramWebhookRoutes from "./routes/instagram-webhook.routes";

const app = express();

// Hide Express technology information.
app.disable("x-powered-by");

// Security headers.
app.use(helmet());

// Allow requests from our frontend.
app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true
    })
);

// Log incoming HTTP requests.
app.use(pinoHttp({ logger }));

// Parse incoming JSON.
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

app.use(notFoundHandler);
app.use(errorHandler);

// Handle unknown routes.
app.use(notFoundHandler);

// Handle application errors.
app.use(errorHandler);

export default app;
