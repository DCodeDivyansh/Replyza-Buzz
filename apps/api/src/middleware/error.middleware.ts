
import type {
  ErrorRequestHandler
} from "express";

import { logger } from "../utils/logger";
import { env } from "../config/env";

export const errorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  _next
) => {
  logger.error(
    { err },
    "Unhandled application error"
  );

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "Something went wrong"
          : err instanceof Error
            ? err.message
            : "Unknown error"
    }
  });
};
