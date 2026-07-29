import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const globalForRedis = globalThis as unknown as {
  bookflowRedis: Redis | null | undefined;
};

/** Returns Upstash Redis when configured; otherwise null (memory fallbacks apply). */
export function getRedis(): Redis | null {
  if (globalForRedis.bookflowRedis !== undefined) {
    return globalForRedis.bookflowRedis;
  }

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    globalForRedis.bookflowRedis = null;
    return null;
  }

  try {
    const client = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    globalForRedis.bookflowRedis = client;
    return client;
  } catch (e) {
    logger.warn({ err: e }, "Failed to init Upstash Redis");
    globalForRedis.bookflowRedis = null;
    return null;
  }
}

export function isRedisConfigured(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}
