"use client";

import { ProductTour } from "@/components/onboarding/product-tour";
import { onboardingCopy } from "@/lib/onboarding/copy";
import {
  ownerTourStorageKey,
  staffTourStorageKey,
} from "@/lib/onboarding/tour-storage";

export type DashboardTourKind = "owner" | "staff" | "none";

export function DashboardTour({
  kind,
  orgId,
}: {
  kind: DashboardTourKind;
  orgId: string | null;
}) {
  if (!orgId || kind === "none") return null;

  if (kind === "owner") {
    return (
      <ProductTour
        storageKey={ownerTourStorageKey(orgId)}
        steps={onboardingCopy.ownerTour.steps}
        enabled
      />
    );
  }

  return (
    <ProductTour
      storageKey={staffTourStorageKey(orgId)}
      steps={onboardingCopy.staffTour.steps}
      enabled
    />
  );
}
