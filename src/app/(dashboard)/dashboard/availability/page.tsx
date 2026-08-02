import { formatInTimeZone } from "date-fns-tz";

import { ActionForm } from "@/components/forms/action-form";
import { updateAvailabilityRulesAction } from "@/server/actions/tenant";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import { db } from "@/server/db";
import { requireOrgRole } from "@/server/tenant/context";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function minToHm(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ resourceId?: string; serviceId?: string }>;
}) {
  const ctx = await requireOrgRole("ADMIN");
  const params = await searchParams;

  const resources = await db.resource.findMany({
    where: { organizationId: ctx.organization.id, isActive: true },
    include: {
      location: true,
      rules: true,
      services: { include: { service: true } },
    },
    orderBy: { name: "asc" },
  });

  const resource =
    resources.find((r) => r.id === params.resourceId) ?? resources[0] ?? null;

  const services = await db.service.findMany({
    where: { organizationId: ctx.organization.id, isActive: true },
    orderBy: { name: "asc" },
  });

  const service =
    services.find((s) => s.id === params.serviceId) ?? services[0] ?? null;

  const rulesByDay = new Map(
    (resource?.rules ?? []).map((r) => [r.weekday, r]),
  );

  let previewSlots: Array<{ start: Date; end: Date }> = [];
  let previewError: string | null = null;

  if (resource && service) {
    try {
      previewSlots = await getSlotsForServiceResource({
        organizationId: ctx.organization.id,
        serviceId: service.id,
        resourceId: resource.id,
        requireLink: false,
      });
    } catch (e) {
      previewError = e instanceof Error ? e.message : "Failed to load slots";
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Hours</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Weekly availability templates per resource. Slot preview uses the pure
          availability engine.
        </p>
      </div>

      {resources.length === 0 ? (
        <p className="text-sm text-[var(--color-ink)]/60">
          Add a staff resource first.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {resources.map((r) => (
              <a
                key={r.id}
                href={`/dashboard/availability?resourceId=${r.id}${service ? `&serviceId=${service.id}` : ""}`}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  r.id === resource?.id
                    ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                    : "border border-[var(--color-border)]"
                }`}
              >
                {r.name}
              </a>
            ))}
          </div>

          {resource ? (
            <ActionForm
              action={updateAvailabilityRulesAction}
              submitLabel="Save hours"
              resetOnSuccess={false}
              className="flex max-w-xl flex-col gap-3"
            >
              <input type="hidden" name="resourceId" value={resource.id} />
              {DAYS.map((label, weekday) => {
                const rule = rulesByDay.get(weekday);
                return (
                  <div
                    key={weekday}
                    className="grid grid-cols-[7rem_auto_1fr_1fr] items-center gap-2 text-sm"
                  >
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={`day-${weekday}-enabled`}
                        defaultChecked={Boolean(rule)}
                      />
                      {label.slice(0, 3)}
                    </label>
                    <span className="text-[var(--color-ink)]/40"> </span>
                    <input
                      type="time"
                      name={`day-${weekday}-start`}
                      defaultValue={rule ? minToHm(rule.startMin) : "09:00"}
                      className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5"
                    />
                    <input
                      type="time"
                      name={`day-${weekday}-end`}
                      defaultValue={rule ? minToHm(rule.endMin) : "17:00"}
                      className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5"
                    />
                  </div>
                );
              })}
            </ActionForm>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">
              Slot preview (next 7 days)
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {services.map((s) => (
                <a
                  key={s.id}
                  href={`/dashboard/availability?resourceId=${resource?.id}&serviceId=${s.id}`}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    s.id === service?.id
                      ? "bg-[var(--color-accent)] text-white"
                      : "border border-[var(--color-border)]"
                  }`}
                >
                  {s.name}
                </a>
              ))}
            </div>

            {previewError ? (
              <p className="mt-4 text-sm text-red-700">{previewError}</p>
            ) : null}

            {service && resource ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {previewSlots.slice(0, 24).map((slot) => (
                  <li
                    key={slot.start.toISOString()}
                    className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  >
                    {formatInTimeZone(
                      slot.start,
                      resource.location.timezone,
                      "EEE MMM d · HH:mm",
                    )}
                  </li>
                ))}
                {previewSlots.length === 0 ? (
                  <li className="text-sm text-[var(--color-ink)]/60">
                    No open slots in this window.
                  </li>
                ) : null}
                {previewSlots.length > 24 ? (
                  <li className="text-sm text-[var(--color-ink)]/50">
                    +{previewSlots.length - 24} more
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[var(--color-ink)]/60">
                Create a service to preview bookable slots.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
