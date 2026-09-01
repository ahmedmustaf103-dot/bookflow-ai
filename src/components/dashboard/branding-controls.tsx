"use client";

import { useRef, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  activateCustomDomainAction,
  clearBrandAssetAction,
  uploadBrandAssetAction,
} from "@/server/actions/ops";

export function BrandAssetUploader({
  kind,
  label,
  currentUrl,
}: {
  kind: "logo" | "favicon";
  label: string;
  currentUrl: string | null;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-[var(--radius-panel)] border border-[var(--border)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">{label}</p>
          <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
            PNG, JPEG, WebP, SVG, or ICO · max 2MB
          </p>
        </div>
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt=""
            className="h-10 w-10 rounded-md border border-[var(--border)] bg-white object-contain"
          />
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set("kind", kind);
            fd.set("file", file);
            startTransition(async () => {
              const result = await uploadBrandAssetAction(fd);
              if (!result.ok) {
                toast(result.error, "error");
                return;
              }
              toast("Uploaded", "success");
            });
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
        </Button>
        {currentUrl ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("kind", kind);
              startTransition(async () => {
                const result = await clearBrandAssetAction(fd);
                if (!result.ok) {
                  toast(result.error, "error");
                  return;
                }
                toast("Removed", "success");
              });
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CustomDomainActivate({
  domain,
  status,
  appHost,
}: {
  domain: string | null;
  status: string;
  appHost: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  if (!domain) return null;

  return (
    <div className="mt-3 rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--muted)]/40 p-3 text-xs text-[var(--ink-secondary)]">
      <p className="font-medium text-[var(--ink)]">
        Connect your own website address
      </p>
      <p className="mt-1">
        Ask your web host to point{" "}
        <code className="text-[var(--ink)]">{domain}</code> at{" "}
        <code className="text-[var(--ink)]">{appHost}</code>, then mark it ready
        below.
      </p>
      <p className="mt-2 tabular-nums">
        Status: <span className="font-medium text-[var(--ink)]">{status}</span>
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || status === "ACTIVE"}
          onClick={() => {
            const fd = new FormData();
            fd.set("activate", "on");
            startTransition(async () => {
              const result = await activateCustomDomainAction(fd);
              if (!result.ok) {
                toast(result.error, "error");
                return;
              }
              toast("Website address connected", "success");
            });
          }}
        >
          Mark active
        </Button>
        {status === "ACTIVE" ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              startTransition(async () => {
                const result = await activateCustomDomainAction(fd);
                if (!result.ok) {
                  toast(result.error, "error");
                  return;
                }
                toast("Domain set back to pending", "success");
              });
            }}
          >
            Set pending
          </Button>
        ) : null}
      </div>
    </div>
  );
}
