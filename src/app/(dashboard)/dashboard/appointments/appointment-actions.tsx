"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { BookingStatus } from "@/generated/prisma/client";
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
      <div className="flex flex-wrap justify-end gap-2">
        {actions.map((action) => (
          <button
            key={action.to}
            type="button"
            disabled={pending}
            className="min-h-10 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
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
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
