"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/ui/surface";
import { createPublicBookingAction } from "@/server/actions/booking";
import { fetchPublicSlotsAction } from "@/server/actions/public-slots";

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

type Slot = {
  startIso: string;
  label: string;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

const STEPS = ["Service", "Staff", "Time", "Details"] as const;

function StepRail({ active }: { active: number }) {
  return (
    <ol className="mb-8 flex items-center gap-1" aria-label="Booking steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const isActive = n === active;
        const isDone = n < active;
        return (
          <li key={label} className="flex flex-1 items-center gap-1">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                isActive
                  ? "bg-[var(--accent)] text-white"
                  : isDone
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--muted)] text-[var(--ink-tertiary)]"
              }`}
            >
              {n}
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
            {i < STEPS.length - 1 ? (
              <span
                className={`mx-1 h-px flex-1 ${
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

function tileClass(selected: boolean) {
  return `rounded-[var(--radius-panel)] border px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
    selected
      ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
  }`;
}

export function PublicBookingWizard({
  organizationId,
  organizationName,
  services,
  resources,
}: {
  organizationId: string;
  organizationName: string;
  services: Service[];
  resources: Resource[];
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [resourceId, setResourceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [doneId, setDoneId] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const filteredResources = useMemo(
    () => resources.filter((r) => r.serviceIds.includes(serviceId)),
    [resources, serviceId],
  );

  const activeResourceId =
    filteredResources.find((r) => r.id === resourceId)?.id ??
    filteredResources[0]?.id ??
    "";

  const step = !serviceId
    ? 1
    : !activeResourceId
      ? 2
      : !startAt
        ? 3
        : 4;

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

  if (doneId) {
    return (
      <Surface className="bf-page-enter p-6 sm:p-8">
        <p className="text-xs font-medium tracking-wide text-[var(--accent)] uppercase">
          Confirmed
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">
          You&apos;re booked
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          Confirmation sent if you provided an email. See you soon at{" "}
          {organizationName}.
        </p>
        <p className="mt-4 text-xs text-[var(--ink-tertiary)]">Ref: {doneId}</p>
        <Button
          className="mt-6"
          variant="secondary"
          onClick={() => {
            setDoneId(null);
            setStartAt("");
            router.refresh();
          }}
        >
          Book another
        </Button>
      </Surface>
    );
  }

  return (
    <Surface className="bf-page-enter p-5 sm:p-8">
      <StepRail active={step} />

      <div className="flex flex-col gap-8">
        <section>
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
                }}
                className={tileClass(s.id === serviceId)}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-sm tabular-nums text-[var(--ink-secondary)]">
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

        <section>
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
                  }}
                  className={`rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                    r.id === activeResourceId
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
            3. Time
          </h2>
          {slotsLoading ? (
            <p className="mt-3 text-sm text-[var(--ink-secondary)]" aria-live="polite">
              Loading times…
            </p>
          ) : slots.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-secondary)]">
              No open slots in the next week.
            </p>
          ) : (
            <div
              className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
              role="radiogroup"
              aria-label="Appointment time"
              aria-busy={slotsLoading}
            >
              {slots.map((slot) => (
                <button
                  key={slot.startIso}
                  type="button"
                  role="radio"
                  aria-checked={startAt === slot.startIso}
                  onClick={() => setStartAt(slot.startIso)}
                  className={`rounded-[var(--radius-control)] px-2 py-2 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none sm:text-sm ${
                    startAt === slot.startIso
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
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
                  return;
                }
                setDoneId(result.data.bookingId);
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
            {error ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending || !startAt || slotsLoading}>
              {pending ? "Booking…" : "Confirm booking"}
            </Button>
          </form>
        </section>
      </div>
    </Surface>
  );
}
