"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { SlotDayPicker } from "@/components/booking/slot-day-picker";
import { BookingTour } from "@/components/onboarding/booking-tour";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { fireConfetti } from "@/lib/confetti";
import {
  bookingTourStorageKey,
  browserStorage,
  markTourCompleted,
} from "@/lib/onboarding/tour-storage";
import { createPublicBookingAction } from "@/server/actions/booking";
import { fetchPublicSlotsAction } from "@/server/actions/public-slots";
import type { PublicSlotDay } from "@/lib/booking-types";

type Service = {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  currency: string;
  description: string | null;
};

type Resource = {
  id: string;
  name: string;
  serviceIds: string[];
};

type Step = 1 | 2 | 3 | 4;

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

const STEP_LABELS = ["Service", "Staff", "Time", "Details"] as const;

function StepRail({ active }: { active: Step }) {
  return (
    <ol className="mb-6 flex items-center gap-1" aria-label="Booking steps">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step;
        const isActive = n === active;
        const isDone = n < active;
        return (
          <li key={label} className="flex flex-1 items-center gap-1">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--accent)] text-white"
                  : isDone
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--muted)] text-[var(--ink-tertiary)]"
              }`}
            >
              {isDone ? "✓" : n}
            </div>
            <span
              className={`hidden text-xs sm:inline ${
                isActive
                  ? "font-medium text-[var(--ink)]"
                  : "text-[var(--ink-tertiary)]"
              }`}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 ? (
              <span
                className={`mx-1 h-px flex-1 transition-colors ${
                  isDone ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Chip({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="bf-row-hover inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs text-[var(--ink-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
    >
      <span className="text-[var(--ink-tertiary)]">{label}</span>
      <span className="max-w-[10rem] truncate font-medium text-[var(--ink)]">
        {value}
      </span>
      <span aria-hidden className="text-[var(--ink-tertiary)]">
        ✎
      </span>
    </button>
  );
}

function tileClass(selected: boolean) {
  return `bf-row-hover rounded-[var(--radius-panel)] border px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
    selected
      ? "scale-[1.01] border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
  }`;
}

export function PublicBookingWizard({
  organizationId,
  organizationName,
  services,
  resources,
  guidedTour = false,
}: {
  organizationId: string;
  organizationName: string;
  services: Service[];
  resources: Resource[];
  guidedTour?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const detailsRef = useRef<HTMLElement>(null);
  const tourLiveRef = useRef(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [resourceId, setResourceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [slots, setSlots] = useState<PublicSlotDay[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [doneId, setDoneId] = useState<string | null>(null);
  /** Which completed step is being re-edited; null = follow natural progress */
  const [editing, setEditing] = useState<Step | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const filteredResources = useMemo(
    () => resources.filter((r) => r.serviceIds.includes(serviceId)),
    [resources, serviceId],
  );
  const activeResourceId =
    filteredResources.find((r) => r.id === resourceId)?.id ??
    filteredResources[0]?.id ??
    "";
  const activeResource =
    filteredResources.find((r) => r.id === activeResourceId) ?? null;
  const selectedSlot =
    slots
      .flatMap((day) =>
        day.slots.map((slot) => ({
          ...slot,
          dateLabel: day.label,
        })),
      )
      .find((s) => s.startIso === startAt) ?? null;

  const progress: Step = !serviceId
    ? 1
    : !activeResourceId
      ? 2
      : !startAt
        ? 3
        : 4;

  const activePanel: Step = editing ?? progress;

  useEffect(() => {
    if (!serviceId || !activeResourceId) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setStartAt("");
    void fetchPublicSlotsAction({
      organizationId,
      serviceId,
      resourceId: activeResourceId,
    }).then((result) => {
      if (cancelled) return;
      setSlotsLoading(false);
      if (!result.ok) {
        setSlots([]);
        setError(result.error);
        return;
      }
      setError(null);
      setSlots(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, serviceId, activeResourceId]);

  useEffect(() => {
    if (progress === 4 && editing === null) {
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [progress, editing]);

  const onTourStep = useCallback((index: number) => {
    tourLiveRef.current = true;
    if (index <= 2) {
      setEditing((index + 1) as Step);
      return;
    }
    setEditing(4);
  }, []);

  const onTourDismiss = useCallback(() => {
    tourLiveRef.current = false;
    setEditing(null);
  }, []);

  if (doneId) {
    return (
      <Surface className="bf-page-enter p-6 sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xl text-[var(--accent)]">
          <span className="bf-check">✓</span>
        </div>
        <p className="mt-4 text-center text-xs font-medium tracking-wide text-[var(--accent)] uppercase">
          Confirmed
        </p>
        <h2 className="mt-2 text-center text-xl font-semibold tracking-tight">
          You&apos;re booked
        </h2>
        <p className="mt-2 text-center text-sm text-[var(--ink-secondary)]">
          Confirmation sent if you provided an email. See you soon at{" "}
          {organizationName}.
        </p>
        <p className="mt-4 text-center text-xs text-[var(--ink-tertiary)]">
          Ref: {doneId}
        </p>
        <div className="mt-6 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => {
              setDoneId(null);
              setStartAt("");
              setEditing(null);
              router.refresh();
            }}
          >
            Book another
          </Button>
        </div>
      </Surface>
    );
  }

  return (
    <Surface className="bf-page-enter p-5 sm:p-8">
      {guidedTour ? (
        <BookingTour
          enabled
          onStepChange={onTourStep}
          onDismiss={onTourDismiss}
        />
      ) : null}
      <StepRail active={progress} />

      <div className="mb-6 flex flex-wrap gap-2">
        {service && progress > 1 && activePanel !== 1 ? (
          <Chip
            label="Service"
            value={service.name}
            onEdit={() => setEditing(1)}
          />
        ) : null}
        {activeResource && progress > 2 && activePanel !== 2 ? (
          <Chip
            label="Staff"
            value={activeResource.name}
            onEdit={() => setEditing(2)}
          />
        ) : null}
        {selectedSlot && progress > 3 && activePanel !== 3 ? (
          <Chip
            label="Time"
            value={
              selectedSlot
                ? `${selectedSlot.dateLabel} · ${selectedSlot.label}`
                : ""
            }
            onEdit={() => setEditing(3)}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-8">
        {activePanel === 1 ? (
          <section data-tour="booking-service">
            <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
              1. Service
            </h2>
            <div
              className="mt-3 grid gap-2"
              role="radiogroup"
              aria-label="Service"
            >
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === serviceId}
                  onClick={() => {
                    setServiceId(s.id);
                    setResourceId("");
                    setStartAt("");
                    setEditing(tourLiveRef.current ? 2 : null);
                  }}
                  className={tileClass(s.id === serviceId)}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-sm text-[var(--ink-secondary)] tabular-nums">
                      {money(s.priceCents, s.currency)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                    {s.durationMin} min
                    {s.description ? ` · ${s.description}` : ""}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activePanel === 2 ? (
          <section data-tour="booking-staff">
            <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
              2. Staff
            </h2>
            {filteredResources.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-secondary)]">
                No staff assigned to this service yet.
              </p>
            ) : (
              <div
                className="mt-3 flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Staff"
              >
                {filteredResources.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={r.id === activeResourceId}
                    onClick={() => {
                      setResourceId(r.id);
                      setStartAt("");
                      setEditing(tourLiveRef.current ? 3 : null);
                    }}
                    className={`bf-row-hover rounded-[var(--radius-control)] px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                      r.id === activeResourceId
                        ? "bg-[var(--accent)] text-white"
                        : "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activePanel === 3 ? (
          <section data-tour="booking-time">
            <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
              3. Time
            </h2>
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
            ) : error && slots.length === 0 ? (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : (
              <SlotDayPicker
                days={slots}
                value={startAt}
                onChange={(startIso) => {
                  setStartAt(startIso);
                  if (startIso) setEditing(null);
                }}
                emptyMessage="No open slots in the next 4 weeks."
              />
            )}
          </section>
        ) : null}

        {activePanel === 4 ? (
          <section ref={detailsRef} data-tour="booking-details">
            <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
              4. Your details
            </h2>
            <form
              className="mt-3 flex max-w-md flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!service || !activeResourceId || !startAt) {
                  setError("Pick a service, person, and time first");
                  return;
                }
                const formData = new FormData(e.currentTarget);
                formData.set("organizationId", organizationId);
                formData.set("serviceId", serviceId);
                formData.set("resourceId", activeResourceId);
                formData.set("startAt", startAt);
                formData.set("idempotencyKey", crypto.randomUUID());
                setError(null);
                startTransition(async () => {
                  const result = await createPublicBookingAction(formData);
                  if (!result.ok) {
                    setError(result.error);
                    toast(result.error, "error");
                    return;
                  }
                  setDoneId(result.data.bookingId);
                  toast("Booking confirmed", "success");
                  if (guidedTour) {
                    markTourCompleted(
                      bookingTourStorageKey(),
                      browserStorage(),
                    );
                  }
                  if (result.data.isFirstBooking) {
                    fireConfetti();
                  }
                });
              }}
            >
              <div>
                <Label htmlFor="book-name">Full name</Label>
                <Input
                  id="book-name"
                  name="name"
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="book-email">Email</Label>
                <Input
                  id="book-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="book-phone">Phone (optional)</Label>
                <Input
                  id="book-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                />
              </div>
              <div>
                <Label htmlFor="book-notes">Notes (optional)</Label>
                <Textarea id="book-notes" name="notes" rows={2} />
              </div>
              <label className="flex items-start gap-2.5 text-sm text-[var(--ink-secondary)]">
                <input
                  type="checkbox"
                  name="marketingOptIn"
                  value="on"
                  className="mt-0.5"
                />
                <span>
                  Email me occasional follow-ups, review requests, and rebooking
                  reminders. Confirmations and appointment reminders are always
                  sent.
                </span>
              </label>
              {error ? (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                data-tour="booking-confirm"
                disabled={pending || !startAt || slotsLoading}
              >
                {pending ? "Booking…" : "Confirm booking"}
              </Button>
            </form>
          </section>
        ) : null}
      </div>
    </Surface>
  );
}
