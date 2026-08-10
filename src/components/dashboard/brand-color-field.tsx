"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeBrandPrimary } from "@/lib/branding";

export function BrandColorField({ defaultValue }: { defaultValue: string }) {
  const initial = normalizeBrandPrimary(defaultValue);
  const [value, setValue] = useState(initial);

  return (
    <div>
      <Label htmlFor="org-brand">Brand colour</Label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id="org-brand"
          type="color"
          className="h-10 w-14 cursor-pointer rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-1"
          value={normalizeBrandPrimary(value)}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
        />
        <Input
          aria-label="Brand colour hex"
          className="font-mono text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setValue(normalizeBrandPrimary(value))}
        />
        <input
          type="hidden"
          name="brandPrimary"
          value={normalizeBrandPrimary(value)}
        />
      </div>
      <p className="mt-1.5 text-xs text-[var(--ink-tertiary)]">
        Used on the booking page and email buttons.
      </p>
    </div>
  );
}
