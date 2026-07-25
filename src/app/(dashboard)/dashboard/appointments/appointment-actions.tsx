"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
  const actions = ACTIONS[status] ?? [];

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.to}
          type="button"
          disabled={pending}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:opacity-50"
          onClick={() => {
            const formData = new FormData();
            formData.set("bookingId", bookingId);
            formData.set("to", action.to);
            if (action.to === "CANCELLED") {
              formData.set("cancelReason", "Cancelled by staff");
            }
            startTransition(async () => {
              await transitionBookingAction(formData);
              router.refresh();
            });
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
