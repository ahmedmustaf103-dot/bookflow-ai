import { createHash } from "node:crypto";

export function hashPrompt(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}
