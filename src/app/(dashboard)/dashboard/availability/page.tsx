import { formatInTimeZone } from "date-fns-tz";

import { ActionForm } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { updateAvailabilityRulesAction } from "@/server/actions/tenant";
import { getSlotsForServiceResource } from "@/server/availability/slots";
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

  const resources = await ctx.db.resource.findMany({
    where: { isActive: true },
    include: {
      location: true,
      rules: true,
      services: { include: { service: true } },
    },
    orderBy: { name: "asc" },
  });

  const resource =
    resources.find((r) => r.id === params.resourceId) ?? resources[0] ?? null;

  const services = await ctx.db.service.findMany({
    where: { isActive: true },
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hours"
        description="Weekly availability templates per resource. Slot preview uses the pure availability engine."
      />

      {resources.length === 0 ? (
        <EmptyState
          title="No staff resources"
          description="Add a staff resource first."
        />
      ) : (
        <>
          <div className="inline-flex flex-wrap gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-0.5">
            {resources.map((r) => (
              <a
                key={r.id}
                href={`/dashboard/availability?resourceId=${r.id}${service ? `&serviceId=${service.id}` : ""}`}
                className={`rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                  r.id === resource?.id
                    ? "bg-[var(--ink)] text-[var(--surface)]"
                    : "text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
                }`}
              >
                {r.name}
              </a>
            ))}
          </div>

          {resource ? (
            <Surface className="max-w-xl">
              <h2 className="text-sm font-semibold">Weekly hours</h2>
              <ActionForm
                action={updateAvailabilityRulesAction}
                submitLabel="Save hours"
                resetOnSuccess={false}
                className="mt-4 flex flex-col gap-3"
              >
                <input type="hidden" name="resourceId" value={resource.id} />
                {DAYS.map((label, weekday) => {
                  const rule = rulesByDay.get(weekday);
                  return (
                    <div
                      key={weekday}
                      className="grid grid-cols-[7rem_auto_1fr_1fr] items-center gap-2 text-sm"
                    >
                      <label className="flex items-center gap-2 text-[var(--ink)]">
                        <input
                          type="checkbox"
                          name={`day-${weekday}-enabled`}
                          defaultChecked={Boolean(rule)}
                        />
                        {label.slice(0, 3)}
                      </label>
                      <span className="text-[var(--ink-tertiary)]"> </span>
                      <Input
                        type="time"
                        name={`day-${weekday}-start`}
                        defaultValue={rule ? minToHm(rule.startMin) : "09:00"}
                      />
                      <Input
                        type="time"
                        name={`day-${weekday}-end`}
                        defaultValue={rule ? minToHm(rule.endMin) : "17:00"}
                      />
                    </div>
                  );
                })}
              </ActionForm>
            </Surface>
          ) : null}

          <div>
            <h2 className="text-sm font-semibold">Slot preview (next 7 days)</h2>
            <div className="mt-3 inline-flex flex-wrap gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-0.5">
              {services.map((s) => (
                <a
                  key={s.id}
                  href={`/dashboard/availability?resourceId=${resource?.id}&serviceId=${s.id}`}
                  className={`rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                    s.id === service?.id
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {s.name}
                </a>
              ))}
            </div>

            {previewError ? (
              <p className="mt-4 text-sm text-[var(--danger)]">{previewError}</p>
            ) : null}

            {service && resource ? (
              previewSlots.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--ink-tertiary)]">
                  No open slots in this window.
                </p>
              ) : (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {previewSlots.slice(0, 24).map((slot) => (
                    <li key={slot.start.toISOString()}>
                      <Surface padding="sm" className="text-sm">
                        {formatInTimeZone(
                          slot.start,
                          resource.location.timezone,
                          "EEE MMM d · HH:mm",
                        )}
                      </Surface>
                    </li>
                  ))}
                  {previewSlots.length > 24 ? (
                    <li className="text-sm text-[var(--ink-tertiary)]">
                      +{previewSlots.length - 24} more
                    </li>
                  ) : null}
                </ul>
              )
            ) : (
              <p className="mt-4 text-sm text-[var(--ink-tertiary)]">
                Create a service to preview bookable slots.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
