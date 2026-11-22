
import type { Request, Response } from "express";
import { env } from "../config/env";

export function getHealth(
  _req: Request,
  res: Response
): void {
  res.status(200).json({
    success: true,
    message: "Replyza API is running",
    data: {
      status: "healthy",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString()
    }
  });
}
