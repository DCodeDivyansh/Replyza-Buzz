
import type { Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "@replyza/database";

export async function getHealth(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "Replyza API is running",
      data: {
        status: "healthy",
        database: "connected",
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Database connection failed",
      data: {
        status: "unhealthy",
        database: "disconnected",
        environment: env.NODE_ENV
      }
    });
  }
}
