import IORedis from "ioredis";

export const redisConnection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  }
);

redisConnection.on("connect", () => {
  console.log("[Redis] Connected");
});

redisConnection.on("error", (error) => {
  console.error("[Redis] Connection error:", error.message);
});