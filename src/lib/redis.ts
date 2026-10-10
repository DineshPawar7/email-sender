import IORedis from "ioredis";

// BullMQ ke liye maxRetriesPerRequest: null zaroori hai
export function createRedis() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
}

const g = globalThis as unknown as { redis?: IORedis };
export const redis = g.redis ?? createRedis();
if (process.env.NODE_ENV !== "production") g.redis = redis;
