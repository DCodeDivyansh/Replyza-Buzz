
import type { Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "@replyza/database";
import { automationQueue, redisConnection } from "../queues/automation.queue";
import { followCheckQueue } from "../queues/follow-check.queue";

export async function getReadiness(
  _req: Request,
  res: Response
): Promise<void> {
  let dbOk = false;
  let redisOk = false;
  let outboxPending = 0;
  let automationQueueCounts: Record<string, number> | null = null;
  let followCheckQueueCounts: Record<string, number> | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    outboxPending = await prisma.outboxEvent.count({
      where: { status: "PENDING" },
    });
  } catch {
    dbOk = false;
  }

  try {
    const pong = await redisConnection.ping();
    redisOk = pong === "PONG";
    if (redisOk) {
      [automationQueueCounts, followCheckQueueCounts] = await Promise.all([
        automationQueue.getJobCounts("waiting", "active", "failed", "delayed"),
        followCheckQueue.getJobCounts("waiting", "active", "failed", "delayed"),
      ]);
    }
  } catch {
    redisOk = false;
  }

  if (dbOk && redisOk) {
    res.status(200).json({
      status: "ready",
      db: "ok",
      redis: "ok",
      outboxPending,
      queues: {
        automation: automationQueueCounts,
        followCheck: followCheckQueueCounts,
      },
    });
  } else {
    res.status(503).json({
      status: "unready",
      db: dbOk ? "ok" : "disconnected",
      redis: redisOk ? "ok" : "disconnected",
      outboxPending: dbOk ? outboxPending : null,
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
