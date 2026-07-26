import { ActionForm } from "@/components/forms/action-form";
import { env } from "@/lib/env";
import { updateOrganizationSettingsAction } from "@/server/actions/ops";
import { planAllowsReminders } from "@/server/billing/entitlements";
import { db } from "@/server/db";
import { requireOrgOrRedirect } from "@/server/tenant/context";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Australia/Sydney",
];

export default async function SettingsPage() {
  const ctx = await requireOrgOrRedirect();
  const org = ctx.organization;
  const bookUrl = `${env.NEXT_PUBLIC_APP_URL}/book/${org.slug}`;

  const recentAudit = await db.auditLog.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Settings</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Business preferences, booking page, and reminders.
        </p>
      </div>

      <section className="max-w-lg">
        <h2 className="text-lg font-semibold">Organization</h2>
        <ActionForm
          action={updateOrganizationSettingsAction}
          submitLabel="Save settings"
          className="mt-4 flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            Business name
            <input
              name="name"
              required
              defaultValue={org.name}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Default timezone
            <select
              name="timezoneDefault"
              defaultValue={org.timezoneDefault}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Reminder lead time (hours)
            <input
              name="reminderHoursBefore"
              type="number"
              min={1}
              max={168}
              defaultValue={org.reminderHoursBefore}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
            />
            <span className="text-xs text-[var(--color-ink)]/50">
              {planAllowsReminders(org.plan)
                ? "Email reminders enqueue on new bookings (Growth/Business/Trial)."
                : "Reminders require Growth or Business — Trial still gets them for testing."}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="publicBookingEnabled"
              defaultChecked={org.publicBookingEnabled}
            />
            Public booking page enabled
          </label>
        </ActionForm>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] p-5 text-sm">
        <h2 className="font-semibold">Public booking URL</h2>
        <p className="mt-2 break-all text-[var(--color-accent)]">{bookUrl}</p>
        <p className="mt-1 text-[var(--color-ink)]/55">Slug: {org.slug}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Recent audit log</h2>
        <ul className="mt-3 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] text-sm">
          {recentAudit.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <p className="font-medium">{row.action}</p>
              <p className="text-[var(--color-ink)]/55">
                {row.createdAt.toISOString()}
                {row.entityType ? ` · ${row.entityType}` : ""}
                {row.entityId ? `:${row.entityId.slice(0, 8)}` : ""}
              </p>
            </li>
          ))}
          {recentAudit.length === 0 ? (
            <li className="px-4 py-6 text-[var(--color-ink)]/60">
              No audited actions yet.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
