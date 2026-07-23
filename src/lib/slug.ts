export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function withSlugSuffix(base: string, suffix: string): string {
  const trimmed = base.slice(0, Math.max(1, 48 - suffix.length - 1));
  return `${trimmed}-${suffix}`;
}
