
import type { Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "@replyza/database";
import { redisConnection } from "../queues/automation.queue";

export async function getReadiness(
  _req: Request,
  res: Response
): Promise<void> {
  let dbOk = false;
  let redisOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  try {
    const pong = await redisConnection.ping();
    redisOk = pong === "PONG";
  } catch {
    redisOk = false;
  }

  if (dbOk && redisOk) {
    res.status(200).json({
      status: "ready",
      db: "ok",
      redis: "ok",
    });
  } else {
    res.status(503).json({
      status: "unready",
      db: dbOk ? "ok" : "disconnected",
      redis: redisOk ? "ok" : "disconnected",
    });
  }
}

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
