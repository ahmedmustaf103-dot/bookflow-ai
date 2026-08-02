"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
      <div className="rounded-lg border border-[var(--color-border)] bg-white/70 p-6">
        <h2 className="font-display text-2xl">You&apos;re booked</h2>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Confirmation sent if you provided an email. See you soon at{" "}
          {organizationName}.
        </p>
        <p className="mt-4 text-xs text-[var(--color-ink)]/50">Ref: {doneId}</p>
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
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
              className={`rounded-lg border px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
                s.id === serviceId
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                  : "border-[var(--color-border)] bg-white/60"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{s.name}</span>
                <span className="text-sm">
                  {money(s.priceCents, s.currency)}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink)]/65">
                {s.durationMin} min
                {s.description ? ` · ${s.description}` : ""}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
          2. Who
        </h2>
        {filteredResources.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink)]/65">
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
                className={`rounded-md px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
                  r.id === activeResourceId
                    ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                    : "border border-[var(--color-border)]"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
          3. Time
        </h2>
        {slotsLoading ? (
          <p className="mt-3 text-sm text-[var(--color-ink)]/65">Loading times…</p>
        ) : slots.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink)]/65">
            No open slots in the next week.
          </p>
        ) : (
          <div
            className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
            role="radiogroup"
            aria-label="Appointment time"
          >
            {slots.map((slot) => (
              <button
                key={slot.startIso}
                type="button"
                role="radio"
                aria-checked={startAt === slot.startIso}
                onClick={() => setStartAt(slot.startIso)}
                className={`rounded-md px-2 py-2 text-left text-xs focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none sm:text-sm ${
                  startAt === slot.startIso
                    ? "bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-border)] bg-white/60"
                }`}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Full name</span>
            <input
              name="name"
              required
              autoComplete="name"
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Phone (optional)</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Notes (optional)</span>
            <textarea
              name="notes"
              rows={2}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending || !startAt || slotsLoading}>
            {pending ? "Booking…" : "Confirm booking"}
          </Button>
        </form>
      </section>
    </div>
  );
}
