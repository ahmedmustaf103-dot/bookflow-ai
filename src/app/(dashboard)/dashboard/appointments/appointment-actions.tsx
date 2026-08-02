"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { BookingStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { transitionBookingAction } from "@/server/actions/booking";

const ACTIONS: Partial<
  Record<BookingStatus, Array<{ to: BookingStatus; label: string }>>
> = {
  PENDING: [
    { to: "CONFIRMED", label: "Confirm" },
    { to: "CANCELLED", label: "Cancel" },
  ],
  CONFIRMED: [
    { to: "COMPLETED", label: "Complete" },
    { to: "NO_SHOW", label: "No-show" },
    { to: "CANCELLED", label: "Cancel" },
  ],
};

export function AppointmentActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const actions = ACTIONS[status] ?? [];

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {actions.map((action) => (
          <Button
            key={action.to}
            type="button"
            size="sm"
            variant={action.to === "CANCELLED" ? "danger" : "secondary"}
            disabled={pending}
            aria-busy={pending}
            onClick={() => {
              const formData = new FormData();
              formData.set("bookingId", bookingId);
              formData.set("to", action.to);
              if (action.to === "CANCELLED") {
                formData.set("cancelReason", "Cancelled by staff");
              }
              setError(null);
              startTransition(async () => {
                const result = await transitionBookingAction(formData);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
