"use client";

import { useCallback } from "react";

import { ProductTour } from "@/components/onboarding/product-tour";
import { onboardingCopy } from "@/lib/onboarding/copy";
import { bookingTourStorageKey } from "@/lib/onboarding/tour-storage";

export function BookingTour({
  enabled,
  onStepChange,
  onDismiss,
}: {
  enabled: boolean;
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
      storageKey={bookingTourStorageKey()}
      steps={onboardingCopy.bookingTour.steps}
      enabled={enabled}
      onStepChange={handleStep}
      onDismiss={onDismiss}
    />
  );
}
