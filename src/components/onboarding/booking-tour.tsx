"use client";

import { useCallback } from "react";

import { ProductTour } from "@/components/onboarding/product-tour";
import { onboardingCopy } from "@/lib/onboarding/copy";
import { bookingTourStorageKey } from "@/lib/onboarding/tour-storage";

export function BookingTour({
  enabled,
  persist,
  organizationId,
  restartKey = 0,
  onStepChange,
  onDismiss,
}: {
  enabled: boolean;
  persist: boolean;
  organizationId?: string;
  restartKey?: number;
  onStepChange?: (index: number) => void;
  onDismiss?: () => void;
}) {
  const handleStep = useCallback(
    (index: number) => {
      onStepChange?.(index);
    },
    [onStepChange],
  );

  return (
    <ProductTour
      storageKey={bookingTourStorageKey(persist ? organizationId : undefined)}
      steps={onboardingCopy.bookingTour.steps}
      enabled={enabled}
      persist={persist}
      restartKey={restartKey}
      onStepChange={handleStep}
      onDismiss={onDismiss}
    />
  );
}
