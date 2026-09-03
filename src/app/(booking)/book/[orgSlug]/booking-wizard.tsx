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
import { onboardingCopy } from "@/lib/onboarding/copy";
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

type RailStep = 1 | 2 | 3 | 4 | 5;
type Panel = 1 | 2 | 3 | 4;

const WIZARD_STEPS = onboardingCopy.bookingWizard.steps;

function StepRail({
  current,
  completedUpTo,
}: {
  current: RailStep;
  completedUpTo: RailStep | 0;
}) {
  return (
    <ol
      className="mb-6 flex min-w-0 items-center gap-0.5"
      aria-label="Booking steps"
    >
      {WIZARD_STEPS.map((step, i) => {
        const n = (i + 1) as RailStep;
        const isActive = n === current;
        const isDone = n <= completedUpTo && n !== current;
        return (
          <li
            key={step.id}
            className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1"
          >
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
              className={`hidden truncate text-[11px] sm:inline ${
                isActive
                  ? "font-medium text-[var(--ink)]"
                  : "text-[var(--ink-tertiary)]"
              }`}
            >
              {step.rail}
            </span>
            {i < WIZARD_STEPS.length - 1 ? (
              <span
                className={`mx-0.5 h-px min-w-1 flex-1 sm:mx-1 ${
                  n <= completedUpTo
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--border)]"
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

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(cents / 100);
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
  isDemo = false,
}: {
  organizationId: string;
  organizationName: string;
  services: Service[];
  resources: Resource[];
  isDemo?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const detailsRef = useRef<HTMLElement>(null);
  const tourLiveRef = useRef(false);
  const [serviceId, setServiceId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [slots, setSlots] = useState<PublicSlotDay[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [doneId, setDoneId] = useState<string | null>(null);
  /** Which step is being viewed; null = follow natural progress */
  const [editing, setEditing] = useState<RailStep | null>(null);
  const [tourRestartKey, setTourRestartKey] = useState(0);

  const copy = onboardingCopy.bookingWizard;
  const service = services.find((s) => s.id === serviceId) ?? null;
  const filteredResources = useMemo(
    () => resources.filter((r) => r.serviceIds.includes(serviceId)),
    [resources, serviceId],
  );
  const selectedResourceId =
    filteredResources.find((r) => r.id === resourceId)?.id ?? "";
  const selectedResource =
    filteredResources.find((r) => r.id === selectedResourceId) ?? null;
  const selectedSlot =
    slots
      .flatMap((day) =>
        day.slots.map((slot) => ({
          ...slot,
          dateLabel: day.label,
        })),
      )
      .find((s) => s.startIso === startAt) ?? null;

  const progress: RailStep = !serviceId
    ? 1
    : !selectedResourceId
      ? 2
      : !startAt
        ? 3
        : 4;

  const railCurrent: RailStep = editing ?? progress;
  const activePanel: Panel = railCurrent === 5 ? 4 : (railCurrent as Panel);

  useEffect(() => {
    if (!serviceId || !selectedResourceId) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setStartAt("");
    void fetchPublicSlotsAction({
      organizationId,
      serviceId,
      resourceId: selectedResourceId,
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
  }, [organizationId, serviceId, selectedResourceId]);

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
    setEditing((index + 1) as RailStep);
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
              setServiceId("");
              setResourceId("");
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
    <Surface className="bf-page-enter min-w-0 overflow-x-hidden p-5 sm:p-8">
      <BookingTour
        enabled
        persist={!isDemo}
        organizationId={organizationId}
        restartKey={tourRestartKey}
        onStepChange={onTourStep}
        onDismiss={onTourDismiss}
      />
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-[var(--ink-tertiary)] sm:text-sm">
          {copy.steps[railCurrent - 1]?.title}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 shrink-0 sm:h-8"
          onClick={() => {
            tourLiveRef.current = true;
            setEditing(1);
            setTourRestartKey((key) => key + 1);
          }}
        >
          {onboardingCopy.common.showGuide}
        </Button>
      </div>
      <StepRail
        current={railCurrent}
        completedUpTo={progress === 1 ? 0 : ((progress - 1) as RailStep)}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {service && progress > 1 && activePanel !== 1 ? (
          <Chip
            label="Service"
            value={service.name}
            onEdit={() => setEditing(1)}
          />
        ) : null}
        {selectedResource && progress > 2 && activePanel !== 2 ? (
          <Chip
            label="Staff"
            value={selectedResource.name}
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
          <section data-tour="booking-service" className="scroll-mt-24">
            <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
              1. {copy.steps[0].title}
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
                  className={`${tileClass(s.id === serviceId)} min-h-11`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-sm font-medium break-words">
                      {s.name}
                    </span>
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
          <section data-tour="booking-staff" className="scroll-mt-24">
            <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
              2. {copy.steps[1].title}
            </h2>
            {!serviceId ? (
              <p className="mt-3 text-sm text-[var(--ink-secondary)]">
                {copy.chooseServiceFirst}
              </p>
            ) : filteredResources.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-secondary)]">
                {copy.emptyStaff}
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
                    aria-checked={r.id === resourceId}
                    onClick={() => {
                      setResourceId(r.id);
                      setStartAt("");
                      setEditing(tourLiveRef.current ? 3 : null);
                    }}
                    className={`bf-row-hover min-h-11 rounded-[var(--radius-control)] px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                      r.id === resourceId
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
          <section data-tour="booking-time" className="scroll-mt-24">
            <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
              3. {copy.steps[2].title}
            </h2>
            {!serviceId || !selectedResourceId ? (
              <p className="mt-3 text-sm text-[var(--ink-secondary)]">
                {copy.chooseServiceFirst}
              </p>
            ) : slotsLoading ? (
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
                  if (startIso) {
                    setEditing(tourLiveRef.current ? 4 : null);
                  }
                }}
                emptyMessage="No open slots in the next 4 weeks."
              />
            )}
          </section>
        ) : null}

        {activePanel === 4 ? (
          <section
            ref={detailsRef}
            data-tour="booking-details"
            className="scroll-mt-24"
          >
            <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
              {railCurrent === 5
                ? `5. ${copy.steps[4].title}`
                : `4. ${copy.steps[3].title}`}
            </h2>
            <form
              className="mt-3 flex max-w-md flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!service || !selectedResourceId || !startAt) {
                  setError(copy.pickFirst);
                  return;
                }
                const formData = new FormData(e.currentTarget);
                formData.set("organizationId", organizationId);
                formData.set("serviceId", serviceId);
                formData.set("resourceId", selectedResourceId);
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
                  if (!isDemo) {
                    markTourCompleted(
                      bookingTourStorageKey(organizationId),
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
