"use client";

import { useEffect, useState } from "react";

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
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    function onRestart() {
      setRestartKey((key) => key + 1);
    }
    window.addEventListener("bookflow:restart-tour", onRestart);
    return () => {
      window.removeEventListener("bookflow:restart-tour", onRestart);
    };
  }, []);

  if (!orgId || kind === "none") return null;

  if (kind === "owner") {
    return (
      <ProductTour
        storageKey={ownerTourStorageKey(orgId)}
        steps={onboardingCopy.ownerTour.steps}
        enabled
        restartKey={restartKey}
      />
    );
  }

  return (
    <ProductTour
      storageKey={staffTourStorageKey(orgId)}
      steps={onboardingCopy.staffTour.steps}
      enabled
      restartKey={restartKey}
    />
  );
}
