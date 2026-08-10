/** Hex brand colour helpers shared by booking UI and emails. */

const HEX = /^#([0-9a-fA-F]{6})$/;

export const DEFAULT_BRAND_PRIMARY = "#0F6E56";

export function normalizeBrandPrimary(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (HEX.test(raw)) return raw.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return DEFAULT_BRAND_PRIMARY;
}

function hexToRgb(hex: string) {
  const h = normalizeBrandPrimary(hex).slice(1);
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

/** Soft tint for chips / backgrounds (mix with white). */
export function brandSoft(hex: string, mix = 0.88) {
  const { r, g, b } = hexToRgb(hex);
  const mr = Math.round(r + (255 - r) * mix);
  const mg = Math.round(g + (255 - g) * mix);
  const mb = Math.round(b + (255 - b) * mix);
  return `#${mr.toString(16).padStart(2, "0")}${mg.toString(16).padStart(2, "0")}${mb.toString(16).padStart(2, "0")}`.toUpperCase();
}

export function brandCssVars(primary: string | null | undefined) {
  const brandPrimary = normalizeBrandPrimary(primary);
  return {
    ["--accent" as string]: brandPrimary,
    ["--accent-soft" as string]: brandSoft(brandPrimary),
  };
}

export function normalizeCustomDomain(value: string | null | undefined) {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}
