import "server-only";

import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { UserFacingError } from "@/lib/action-errors";
import { env } from "@/lib/env";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
  ["image/x-icon", "ico"],
  ["image/vnd.microsoft.icon", "ico"],
]);

export type BrandAssetKind = "logo" | "favicon";

export async function storeBrandAsset(input: {
  organizationId: string;
  kind: BrandAssetKind;
  file: File;
}) {
  const mime = input.file.type;
  const ext = ALLOWED.get(mime);
  if (!ext) {
    throw new UserFacingError(
      "Use PNG, JPEG, WebP, SVG, or ICO images under 2MB",
    );
  }
  if (input.file.size <= 0 || input.file.size > MAX_BYTES) {
    throw new UserFacingError("Image must be under 2MB");
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const filename = `${input.kind}-${Date.now()}.${ext}`;

  if (env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`orgs/${input.organizationId}/${filename}`, bytes, {
      access: "public",
      contentType: mime,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }

  // Local / self-host fallback — files served from /uploads/...
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "orgs",
    input.organizationId,
  );
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  return `${env.NEXT_PUBLIC_APP_URL}/uploads/orgs/${input.organizationId}/${filename}`;
}
