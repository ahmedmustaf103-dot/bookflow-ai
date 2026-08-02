import { ActionForm } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { env } from "@/lib/env";
import { updateOrganizationSettingsAction } from "@/server/actions/ops";
import { planAllowsReminders } from "@/server/billing/entitlements";
import { requireOrgRole } from "@/server/tenant/context";

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
  const ctx = await requireOrgRole("ADMIN");
  const org = ctx.organization;
  const bookUrl = `${env.NEXT_PUBLIC_APP_URL}/book/${org.slug}`;

  const recentAudit = await ctx.db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Business preferences, booking page, and reminders."
      />

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Organization</h2>
        <ActionForm
          action={updateOrganizationSettingsAction}
          submitLabel="Save settings"
          resetOnSuccess={false}
          className="mt-4 flex flex-col gap-3"
        >
          <div>
            <Label htmlFor="org-name">Business name</Label>
            <Input id="org-name" name="name" required defaultValue={org.name} />
          </div>
          <div>
            <Label htmlFor="org-timezone">Default timezone</Label>
            <Select
              id="org-timezone"
              name="timezoneDefault"
              defaultValue={org.timezoneDefault}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="org-reminder">Reminder lead time (hours)</Label>
            <Input
              id="org-reminder"
              name="reminderHoursBefore"
              type="number"
              min={1}
              max={168}
              defaultValue={org.reminderHoursBefore}
            />
            <p className="mt-1.5 text-xs text-[var(--ink-tertiary)]">
              {planAllowsReminders(org.plan)
                ? "Email reminders enqueue on new bookings (Growth/Business/Trial). SMS reminders require Growth/Business plus Twilio."
                : "Email reminders require Growth or Business (Trial still gets email for testing)."}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              name="publicBookingEnabled"
              defaultChecked={org.publicBookingEnabled}
            />
            Public booking page enabled
          </label>
        </ActionForm>
      </Surface>

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Public booking URL</h2>
        <p className="mt-2 break-all text-sm text-[var(--accent)]">{bookUrl}</p>
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          Slug: {org.slug}
        </p>
      </Surface>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Recent audit log</h2>
        {recentAudit.length === 0 ? (
          <EmptyState title="No audited actions yet" />
        ) : (
          <Surface padding="none" className="overflow-hidden">
            <ul className="divide-y divide-[var(--border)] text-sm">
              {recentAudit.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <p className="font-medium">{row.action}</p>
                  <p className="text-xs text-[var(--ink-tertiary)]">
                    {row.createdAt.toISOString()}
                    {row.entityType ? ` · ${row.entityType}` : ""}
                    {row.entityId ? `:${row.entityId.slice(0, 8)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </div>
    </div>
  );
}
