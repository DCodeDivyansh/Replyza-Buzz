
import type { RequestHandler } from "express";
import { env } from "../config/env";

export const csrfProtection: RequestHandler = (
  req,
  res,
  next
) => {
  const origin = req.get("origin");
  const csrfHeader = req.get("x-csrf-protection");

  // In production, require the exact frontend origin.
  if (env.NODE_ENV === "production") {
    if (!origin || origin !== env.FRONTEND_URL) {
      res.status(403).json({
        success: false,
        message: "Invalid request origin"
      });
      return;
    }
  } else if (origin && origin !== env.FRONTEND_URL) {
    // Reject unexpected origins during development too.
    res.status(403).json({
      success: false,
      message: "Invalid request origin"
    });
    return;
  }

  // Require a custom header on cookie-authenticated requests.
  if (csrfHeader !== "1") {
    res.status(403).json({
      success: false,
      message: "CSRF validation failed"
    });
    return;
  }

  next();
};
