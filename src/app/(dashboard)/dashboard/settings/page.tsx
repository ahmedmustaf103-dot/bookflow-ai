import { ActionForm } from "@/components/forms/action-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { env } from "@/lib/env";
import { updateOrganizationSettingsAction } from "@/server/actions/ops";
import { planAllowsReminders } from "@/server/billing/entitlements";
import { db } from "@/server/db";
import { isGoogleCalendarConfigured } from "@/server/integrations/google-calendar";
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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>;
}) {
  const ctx = await requireOrgRole("ADMIN");
  const org = ctx.organization;
  const bookUrl = `${env.NEXT_PUBLIC_APP_URL}/book/${org.slug}`;
  const { gcal } = await searchParams;
  const gcalConfigured = isGoogleCalendarConfigured();
  // Use root db — tenantDb proxy does not expose googleCalendarConnection.
  const gcalConnection = await db.googleCalendarConnection.findUnique({
    where: { organizationId: org.id },
  });

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

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Google Calendar</h2>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">
          Push new, rescheduled, and cancelled bookings to your Google Calendar.
        </p>
        {gcal === "connected" ? (
          <p className="mt-2 text-sm text-[var(--accent)]">Connected.</p>
        ) : null}
        {gcal === "disconnected" ? (
          <p className="mt-2 text-sm text-[var(--ink-secondary)]">Disconnected.</p>
        ) : null}
        {gcal === "error" ? (
          <p className="mt-2 text-sm text-[var(--danger)]">
            Couldn’t complete Google connection. Try again.
          </p>
        ) : null}
        {gcal === "not_configured" ? (
          <p className="mt-2 text-sm text-[var(--danger)]">
            Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET to
            the environment first.
          </p>
        ) : null}

        {!gcalConfigured ? (
          <p className="mt-3 text-xs text-[var(--ink-tertiary)]">
            Google Calendar sync is not configured on this server. See
            .env.example for OAuth setup.
          </p>
        ) : gcalConnection ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm">
              Connected as{" "}
              <span className="font-medium">
                {gcalConnection.accountEmail ?? "Google account"}
              </span>
            </p>
            <form action="/api/integrations/google-calendar/disconnect" method="post">
              <Button type="submit" variant="secondary" size="sm">
                Disconnect
              </Button>
            </form>
          </div>
        ) : (
          <div className="mt-4">
            <ButtonLink
              href="/api/integrations/google-calendar/connect"
              variant="primary"
              size="sm"
            >
              Connect Google Calendar
            </ButtonLink>
          </div>
        )}
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
