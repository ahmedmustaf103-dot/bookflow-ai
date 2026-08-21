"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { Surface } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { PublicManagedBookingView } from "@/lib/booking-types";
import {
  cancelPublicManagedBookingAction,
  fetchPublicManageSlotsAction,
  reschedulePublicManagedBookingAction,
} from "@/server/actions/public-manage";

type Slot = { startIso: string; label: string };

type Mode = "view" | "reschedule" | "cancelConfirm";

export function ManageAppointmentClient({
  manageToken,
  initial,
}: {
  manageToken: string;
  initial: PublicManagedBookingView;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [booking, setBooking] = useState(initial);
  const [mode, setMode] = useState<Mode>("view");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setBooking(initial);
  }, [initial]);

  useEffect(() => {
    if (mode !== "reschedule" || !booking.canReschedule) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedStart("");
    void fetchPublicManageSlotsAction({ manageToken }).then((result) => {
      if (cancelled) return;
      setSlotsLoading(false);
      if (!result.ok) {
        setSlots([]);
        setSlotsError(result.error);
        return;
      }
      setSlots(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, manageToken, booking.canReschedule]);

  function onCancelConfirmed() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("manageToken", manageToken);
      formData.set("confirm", "true");
      formData.set("cancelReason", "Cancelled by customer");
      const result = await cancelPublicManagedBookingAction(formData);
      if (!result.ok) {
        setError(result.error);
        toast(result.error, "error");
        return;
      }
      setBooking(result.data);
      setMode("view");
      setSuccess("Your appointment has been cancelled.");
      toast("Appointment cancelled", "success");
      router.refresh();
    });
  }

  function onRescheduleConfirm() {
    if (!selectedStart) {
      setError("Choose a new time");
      return;
    }
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("manageToken", manageToken);
      formData.set("startAt", selectedStart);
      const result = await reschedulePublicManagedBookingAction(formData);
      if (!result.ok) {
        setError(result.error);
        toast(result.error, "error");
        return;
      }
      setBooking(result.data);
      setMode("view");
      setSuccess("Your appointment has been rescheduled.");
      toast("Appointment rescheduled", "success");
      router.refresh();
    });
  }

  return (
    <Surface className="bf-page-enter p-6 sm:p-8">
      <p className="text-xs font-medium tracking-[0.18em] text-[var(--accent)] uppercase">
        Manage appointment
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {booking.organizationName}
        </h1>
        <StatusPill status={booking.status} />
      </div>

      {success ? (
        <p
          className="mt-4 rounded-[var(--radius-control)] bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]"
          role="status"
        >
          {success}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-3">
          <dt className="text-[var(--ink-tertiary)]">Service</dt>
          <dd className="text-right font-medium text-[var(--ink)]">
            {booking.serviceName}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-3">
          <dt className="text-[var(--ink-tertiary)]">When</dt>
          <dd className="text-right font-medium text-[var(--ink)]">
            {booking.whenLabel}
            <span className="mt-0.5 block text-xs font-normal text-[var(--ink-tertiary)]">
              {booking.timezone.replace(/_/g, " ")} · {booking.durationMin} min
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-3">
          <dt className="text-[var(--ink-tertiary)]">With</dt>
          <dd className="text-right font-medium text-[var(--ink)]">
            {booking.resourceName}
          </dd>
        </div>
        {booking.locationName ? (
          <div className="flex justify-between gap-4 pb-1">
            <dt className="text-[var(--ink-tertiary)]">Location</dt>
            <dd className="text-right font-medium text-[var(--ink)]">
              {booking.locationName}
            </dd>
          </div>
        ) : null}
      </dl>

      {mode === "view" ? (
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {booking.canReschedule ? (
            <Button
              type="button"
              onClick={() => {
                setSuccess(null);
                setError(null);
                setMode("reschedule");
              }}
            >
              Reschedule
            </Button>
          ) : null}
          {booking.canCancel ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setSuccess(null);
                setError(null);
                setMode("cancelConfirm");
              }}
            >
              Cancel appointment
            </Button>
          ) : null}
          {booking.status !== "CANCELLED" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.location.href = `/book/manage/${manageToken}/calendar`;
              }}
            >
              Add to calendar
            </Button>
          ) : null}
          {!booking.canCancel && !booking.canReschedule ? (
            <p className="text-sm text-[var(--ink-secondary)]">
              This appointment can no longer be changed online. Contact{" "}
              {booking.organizationName} if you need help.
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "cancelConfirm" ? (
        <div className="mt-8 rounded-[var(--radius-panel)] border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-4">
          <h2 className="text-sm font-semibold text-[var(--danger)]">
            Cancel this appointment?
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-secondary)]">
            {booking.serviceName} on {booking.whenLabel} will be cancelled. This
            cannot be undone from this link.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              onClick={onCancelConfirmed}
            >
              {pending ? "Cancelling…" : "Yes, cancel"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setMode("view");
                setError(null);
              }}
            >
              Keep appointment
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "reschedule" ? (
        <div className="mt-8">
          <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
            Choose a new time
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            Only open slots for {booking.resourceName} are shown.
          </p>

          {slotsLoading ? (
            <div
              className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
              aria-busy
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-[var(--radius-control)] bg-[var(--border)]"
                />
              ))}
            </div>
          ) : slotsError ? (
            <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
              {slotsError}
            </p>
          ) : slots.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-secondary)]">
              No open slots in the next week. Try again later or contact the
              business.
            </p>
          ) : (
            <div
              className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
              role="radiogroup"
              aria-label="New appointment time"
            >
              {slots.map((slot) => (
                <button
                  key={slot.startIso}
                  type="button"
                  role="radio"
                  aria-checked={selectedStart === slot.startIso}
                  onClick={() => {
                    setSelectedStart(slot.startIso);
                    setError(null);
                  }}
                  className={`rounded-[var(--radius-control)] border px-2 py-2 text-left text-xs transition-colors ${
                    selectedStart === slot.startIso
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending || !selectedStart || slotsLoading}
              onClick={onRescheduleConfirm}
            >
              {pending ? "Saving…" : "Confirm new time"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setMode("view");
                setError(null);
                setSelectedStart("");
              }}
            >
              Back
            </Button>
          </div>
        </div>
      ) : null}
    </Surface>
  );
}
