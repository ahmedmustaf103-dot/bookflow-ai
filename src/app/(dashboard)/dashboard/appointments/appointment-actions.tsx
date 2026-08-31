"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { BookingStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const actions = ACTIONS[status] ?? [];

  if (actions.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        {actions.map((action) => (
          <Button
            key={action.to}
            type="button"
            size="sm"
            variant={
              action.to === "CANCELLED"
                ? "danger"
                : action.to === "COMPLETED"
                  ? "primary"
                  : "secondary"
            }
            disabled={pending}
            aria-busy={pending}
            className={`min-h-11 sm:h-8 ${
              action.to === "CANCELLED" && actions.length % 2 === 1
                ? "col-span-2 sm:col-span-1"
                : ""
            }`}
            onClick={() => {
              if (
                action.to === "CANCELLED" &&
                !window.confirm("Cancel this appointment?")
              ) {
                return;
              }
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
                  toast(result.error, "error");
                  return;
                }
                toast(
                  action.to === "CANCELLED"
                    ? "Appointment cancelled"
                    : `Marked ${action.label.toLowerCase()}`,
                  "success",
                );
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
