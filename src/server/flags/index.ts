/**
 * Feature flags for gradual rollouts.
 * Override via FEATURE_FLAGS JSON, e.g. {"slot_cache":false,"rate_limit":true}
 */

export type FeatureFlag =
  "slot_cache" | "rate_limit" | "vertical_packs" | "request_tracing";

const DEFAULTS: Record<FeatureFlag, boolean> = {
  slot_cache: true,
  rate_limit: true,
  vertical_packs: true,
  request_tracing: true,
};

function parseOverrides(): Partial<Record<FeatureFlag, boolean>> {
  const raw = process.env.FEATURE_FLAGS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<FeatureFlag, boolean>> = {};
    for (const key of Object.keys(DEFAULTS) as FeatureFlag[]) {
      if (typeof parsed[key] === "boolean") {
        out[key] = parsed[key];
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  // Never allow disabling rate limits in production via env misconfig.
  if (flag === "rate_limit" && process.env.NODE_ENV === "production") {
    return true;
  }
  const overrides = parseOverrides();
  if (flag in overrides) return Boolean(overrides[flag]);
  return DEFAULTS[flag];
}

export function getFeatureFlags(): Record<FeatureFlag, boolean> {
  const overrides = parseOverrides();
  return {
    slot_cache: overrides.slot_cache ?? DEFAULTS.slot_cache,
    rate_limit: overrides.rate_limit ?? DEFAULTS.rate_limit,
    vertical_packs: overrides.vertical_packs ?? DEFAULTS.vertical_packs,
    request_tracing: overrides.request_tracing ?? DEFAULTS.request_tracing,
  };
}
