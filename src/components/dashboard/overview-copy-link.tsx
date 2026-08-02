"use client";

import { markBookingLinkShared } from "@/components/dashboard/setup-checklist";
import { CopyField } from "@/components/ui/copy-field";

export function OverviewCopyLink({
  orgId,
  value,
  label,
}: {
  orgId: string;
  value: string;
  label: string;
}) {
  return (
    <CopyField
      value={value}
      label={label}
      onCopied={() => markBookingLinkShared(orgId)}
    />
  );
}
