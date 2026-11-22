
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "./config/env";
import { logger } from "./utils/logger";

import healthRoutes from "./routes/health.routes";

import { notFoundHandler } from "./middleware/not-found.middleware";
import { errorHandler } from "./middleware/error.middleware";

import authRoutes from "./routes/auth.routes";

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
    limit: "1mb"
  })
);

// API routes.
app.use("/api/v1", healthRoutes);
app.use("/api/v1/auth", authRoutes);

// Handle unknown routes.
app.use(notFoundHandler);

// Handle application errors.
app.use(errorHandler);

export default app;
