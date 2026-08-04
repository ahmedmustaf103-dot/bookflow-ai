import "server-only";

import type { Slot } from "@/server/availability/engine";
import { getRedis } from "@/server/cache/redis";
import { isFeatureEnabled } from "@/server/flags";
import { logger } from "@/lib/logger";

const SLOT_TTL_SEC = 60;
const memorySlots = new Map<string, { expiresAt: number; slots: Slot[] }>();

function slotCacheKey(input: {
  organizationId: string;
  serviceId: string;
  resourceId: string;
  fromDate: string;
  toDate: string;
}): string {
  return `slots:v2:${input.organizationId}:${input.serviceId}:${input.resourceId}:${input.fromDate}:${input.toDate}`;
}

export async function getCachedSlots(input: {
  organizationId: string;
  serviceId: string;
  resourceId: string;
  fromDate: string;
  toDate: string;
}): Promise<Slot[] | null> {
  if (!isFeatureEnabled("slot_cache")) return null;

  const key = slotCacheKey(input);
  const redis = getRedis();

  if (redis) {
    try {
      const raw = await redis.get<Array<{ start: string; end: string }>>(key);
      if (!raw) return null;
      return raw.map((s) => ({
        start: new Date(s.start),
        end: new Date(s.end),
      }));
    } catch (e) {
      logger.warn({ err: e }, "slot cache get failed");
      return null;
    }
  }

  const entry = memorySlots.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memorySlots.delete(key);
    return null;
  }
  return entry.slots.map((s) => ({
    start: new Date(s.start),
    end: new Date(s.end),
  }));
}

export async function setCachedSlots(
  input: {
    organizationId: string;
    serviceId: string;
    resourceId: string;
    fromDate: string;
    toDate: string;
  },
  slots: Slot[],
): Promise<void> {
  if (!isFeatureEnabled("slot_cache")) return;

  const key = slotCacheKey(input);
  const serializable = slots.map((s) => ({
    start: s.start.toISOString(),
    end: s.end.toISOString(),
  }));
  const redis = getRedis();

  if (redis) {
    try {
      await redis.set(key, serializable, { ex: SLOT_TTL_SEC });
    } catch (e) {
      logger.warn({ err: e }, "slot cache set failed");
    }
    return;
  }

  memorySlots.set(key, {
    expiresAt: Date.now() + SLOT_TTL_SEC * 1000,
    slots: slots.map((s) => ({
      start: new Date(s.start),
      end: new Date(s.end),
    })),
  });
}

/** Invalidate all cached slot windows for a resource (booking write / hours change). */
export async function invalidateSlotsForResource(
  resourceId: string,
): Promise<void> {
  if (!isFeatureEnabled("slot_cache")) return;

  const redis = getRedis();
  if (redis) {
    try {
      const pattern = `slots:v2:*:*:${resourceId}:*`;
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, {
          match: pattern,
          count: 100,
        });
        cursor = String(next);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (e) {
      logger.warn({ err: e, resourceId }, "slot cache invalidate failed");
    }
    return;
  }

  const needle = `:${resourceId}:`;
  for (const key of memorySlots.keys()) {
    if (key.includes(needle)) memorySlots.delete(key);
  }
}
