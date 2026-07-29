import "server-only";

import { Ratelimit } from "@upstash/ratelimit";

import { isFeatureEnabled } from "@/server/flags";
import { getRedis } from "@/server/cache/redis";

type MemoryBucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, MemoryBucket>();

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number } {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) {
    return { success: false, remaining: 0 };
  }
  bucket.count += 1;
  return { success: true, remaining: limit - bucket.count };
}

const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(name: string, limit: number, windowSec: number) {
  const cacheKey = `${name}:${limit}:${windowSec}`;
  const existing = upstashLimiters.get(cacheKey);
  if (existing) return existing;

  const redis = getRedis();
  if (!redis) return null;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: `bookflow:rl:${name}`,
  });
  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
};

/**
 * Rate-limit a key. No-ops (always allows) when the rate_limit flag is off.
 * Uses Upstash when configured; otherwise process-local memory (dev / single instance).
 */
export async function rateLimit(input: {
  name: string;
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  if (!isFeatureEnabled("rate_limit")) {
    return { success: true, remaining: input.limit };
  }

  const fullKey = `${input.name}:${input.key}`;
  const limiter = getUpstashLimiter(input.name, input.limit, input.windowSec);

  if (limiter) {
    const result = await limiter.limit(fullKey);
    return { success: result.success, remaining: result.remaining };
  }

  return memoryLimit(fullKey, input.limit, input.windowSec * 1000);
}

export async function assertRateLimit(input: {
  name: string;
  key: string;
  limit: number;
  windowSec: number;
  message?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await rateLimit(input);
  if (result.success) return { ok: true };
  return {
    ok: false,
    error: input.message ?? "Too many requests — try again shortly",
  };
}
