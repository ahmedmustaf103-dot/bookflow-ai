import {
  BrandAssetUploader,
  CustomDomainActivate,
} from "@/components/dashboard/branding-controls";
import { BrandColorField } from "@/components/dashboard/brand-color-field";
import { ActionForm } from "@/components/forms/action-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { DEFAULT_BRAND_PRIMARY } from "@/lib/branding";
import { appHostHostname, publicBookingUrl } from "@/lib/booking-urls";
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
  const bookUrl = publicBookingUrl(org);
  const appHost = appHostHostname();

  const recentAudit = await ctx.db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Business preferences, branding, booking page, and automation. Team logins are optional if you work alone."
        actions={
          <ButtonLink href="/dashboard/settings/team" size="sm">
            Team
          </ButtonLink>
        }
      />

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">White-label branding</h2>
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          Logo, colours, and favicon appear on your public booking page and
          customer emails.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <BrandAssetUploader
            kind="logo"
            label="Logo"
            currentUrl={org.logoUrl}
          />
          <BrandAssetUploader
            kind="favicon"
            label="Favicon"
            currentUrl={org.faviconUrl}
          />
        </div>
      </Surface>

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
          <BrandColorField
            defaultValue={org.brandPrimary ?? DEFAULT_BRAND_PRIMARY}
          />
          <div>
            <Label htmlFor="org-custom-domain">Custom domain (optional)</Label>
            <Input
              id="org-custom-domain"
              name="customDomain"
              placeholder="bookings.yourbusiness.com"
              defaultValue={org.customDomain ?? ""}
            />
            <CustomDomainActivate
              domain={org.customDomain}
              status={org.customDomainStatus}
              appHost={appHost}
            />
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

          <div className="mt-2 border-t border-[var(--border)] pt-4">
            <h3 className="text-sm font-semibold">Customer automation</h3>
            <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
              Messages queue in the outbox with retries. Nothing sends without a
              client email (and Twilio for SMS reminders).
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              name="followUpEnabled"
              defaultChecked={org.followUpEnabled}
            />
            Send follow-up email after completed visits
          </label>
          <div>
            <Label htmlFor="org-followup-hours">Follow-up delay (hours)</Label>
            <Input
              id="org-followup-hours"
              name="followUpHoursAfter"
              type="number"
              min={1}
              max={168}
              defaultValue={org.followUpHoursAfter}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              name="reviewRequestEnabled"
              defaultChecked={org.reviewRequestEnabled}
            />
            Send review request after completed visits
          </label>
          <div>
            <Label htmlFor="org-review-hours">Review request delay (hours)</Label>
            <Input
              id="org-review-hours"
              name="reviewRequestHoursAfter"
              type="number"
              min={1}
              max={336}
              defaultValue={org.reviewRequestHoursAfter}
            />
          </div>
          <div>
            <Label htmlFor="org-review-url">Review URL (optional)</Label>
            <Input
              id="org-review-url"
              name="reviewUrl"
              type="url"
              placeholder="https://g.page/r/..."
              defaultValue={org.reviewUrl ?? ""}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              name="rebookingEnabled"
              defaultChecked={org.rebookingEnabled}
            />
            Send rebooking reminder after completed visits
          </label>
          <div>
            <Label htmlFor="org-rebook-days">Rebooking delay (days)</Label>
            <Input
              id="org-rebook-days"
              name="rebookingDaysAfter"
              type="number"
              min={1}
              max={365}
              defaultValue={org.rebookingDaysAfter}
            />
          </div>
        </ActionForm>
      </Surface>

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Public booking URL</h2>
        <p className="mt-2 break-all text-sm text-[var(--accent)]">{bookUrl}</p>
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          Slug path: /book/{org.slug}
          {org.customDomainStatus === "ACTIVE" && org.customDomain
            ? ` · live on ${org.customDomain}`
            : ""}
        </p>
      </Surface>

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Google Calendar</h2>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">
          Each barber connects their own Google account. Bookings on their
          chair go to their calendar.
        </p>
        <div className="mt-4">
          <ButtonLink
            href="/dashboard/settings/calendar"
            variant="primary"
            size="sm"
          >
            Open Google Calendar
          </ButtonLink>
        </div>
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
