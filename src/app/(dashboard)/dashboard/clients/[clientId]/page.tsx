import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { ActionForm } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { StatusPill } from "@/components/ui/status-pill";
import { Surface } from "@/components/ui/surface";
import { TagChip } from "@/components/ui/tag-chip";
import { formatMoney } from "@/lib/client-tags";
import { updateClientAction } from "@/server/actions/ops";
import { requireOrgRole } from "@/server/tenant/context";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const ctx = await requireOrgRole("STAFF");
  const { clientId } = await params;
  const tzDefault = ctx.organization.timezoneDefault;

  const client = await ctx.db.client.findFirst({
    where: { id: clientId },
    include: {
      bookings: {
        include: {
          service: true,
          resource: true,
          location: true,
        },
        orderBy: { startAt: "desc" },
        take: 80,
      },
    },
  });

  if (!client) notFound();

  const now = Date.now();
  const completed = client.bookings.filter((b) => b.status === "COMPLETED");
  const lifetimeValueCents = completed.reduce(
    (sum, b) => sum + b.service.priceCents,
    0,
  );
  const currency =
    completed[0]?.service.currency ??
    client.bookings[0]?.service.currency ??
    "GBP";
  const noShows = client.bookings.filter((b) => b.status === "NO_SHOW").length;
  const isRepeat = client.bookings.length >= 2;

  const upcoming = client.bookings
    .filter(
      (b) =>
        b.startAt.getTime() >= now &&
        (b.status === "PENDING" || b.status === "CONFIRMED"),
    )
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const pastOnly = client.bookings
    .filter((b) => !upcoming.some((u) => u.id === b.id))
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());

  const lastVisit =
    pastOnly.find((b) => b.status === "COMPLETED") ??
    pastOnly.find((b) => b.startAt.getTime() < now) ??
    null;
  const nextVisit = upcoming[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/clients"
        className="text-sm text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
      >
        ← Clients
      </Link>

      <PageHeader
        title={client.name}
        description={
          [client.email, client.phone].filter(Boolean).join(" · ") ||
          "No contact details yet"
        }
        actions={
          isRepeat ? (
            <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold tracking-wide text-[var(--accent)] uppercase">
              Repeat customer
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--ink-tertiary)]">
              New customer
            </span>
          )
        }
      />

      {client.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {client.tags.map((t) => (
            <TagChip
              key={t}
              label={t}
              href={`/dashboard/clients?tag=${encodeURIComponent(t)}`}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Lifetime value"
          value={formatMoney(lifetimeValueCents, currency)}
          hint={`${completed.length} completed`}
        />
        <Stat
          label="Visits"
          value={client.bookings.length}
          hint={
            noShows > 0
              ? `${noShows} no-show${noShows === 1 ? "" : "s"}`
              : "All recorded bookings"
          }
        />
        <Stat
          label="Last appointment"
          value={
            lastVisit
              ? formatInTimeZone(
                  lastVisit.startAt,
                  lastVisit.location.timezone || tzDefault,
                  "MMM d",
                )
              : "—"
          }
          hint={
            lastVisit
              ? formatInTimeZone(
                  lastVisit.startAt,
                  lastVisit.location.timezone || tzDefault,
                  "HH:mm · ",
                ) + lastVisit.service.name
              : "No past visits"
          }
        />
        <Stat
          label="Next appointment"
          value={
            nextVisit
              ? formatInTimeZone(
                  nextVisit.startAt,
                  nextVisit.location.timezone || tzDefault,
                  "MMM d",
                )
              : "—"
          }
          hint={
            nextVisit
              ? formatInTimeZone(
                  nextVisit.startAt,
                  nextVisit.location.timezone || tzDefault,
                  "HH:mm · ",
                ) + nextVisit.service.name
              : "Nothing booked"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Surface className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Profile & notes</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            Internal notes stay with your team — clients never see them.
          </p>
          <ActionForm
            action={updateClientAction}
            submitLabel="Save profile"
            resetOnSuccess={false}
            className="mt-4 flex flex-col gap-3"
          >
            <input type="hidden" name="clientId" value={client.id} />
            <div>
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                name="name"
                required
                defaultValue={client.name}
              />
            </div>
            <div>
              <Label htmlFor="client-email">Email</Label>
              <Input
                id="client-email"
                name="email"
                type="email"
                defaultValue={client.email ?? ""}
                placeholder="Email"
              />
            </div>
            <div>
              <Label htmlFor="client-phone">Phone</Label>
              <Input
                id="client-phone"
                name="phone"
                defaultValue={client.phone ?? ""}
                placeholder="Phone"
              />
            </div>
            <div>
              <Label htmlFor="client-tags">Tags</Label>
              <Input
                id="client-tags"
                name="tags"
                defaultValue={client.tags.join(", ")}
                placeholder="vip, colour, student"
              />
              <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">
                Comma-separated. Used for filters on the clients list.
              </p>
            </div>
            <div>
              <Label htmlFor="client-notes">Notes</Label>
              <Textarea
                id="client-notes"
                name="notes"
                rows={6}
                defaultValue={client.notes ?? ""}
                placeholder="Preferences, allergies, conversation history…"
              />
            </div>
          </ActionForm>
        </Surface>

        <div className="flex flex-col gap-4 lg:col-span-3">
          <Surface className="p-5">
            <h2 className="text-sm font-semibold">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-secondary)]">
                No upcoming appointments.
              </p>
            ) : (
              <ol className="mt-4 space-y-0">
                {upcoming.map((b, index) => (
                  <TimelineItem
                    key={b.id}
                    booking={b}
                    isLast={index === upcoming.length - 1}
                    accent
                  />
                ))}
              </ol>
            )}
          </Surface>

          <Surface className="p-5">
            <h2 className="text-sm font-semibold">Appointment history</h2>
            {pastOnly.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No bookings yet" />
              </div>
            ) : (
              <ol className="mt-4 space-y-0">
                {pastOnly.map((b, index) => (
                  <TimelineItem
                    key={b.id}
                    booking={b}
                    isLast={index === pastOnly.length - 1}
                  />
                ))}
              </ol>
            )}
          </Surface>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  booking: b,
  isLast,
  accent,
}: {
  booking: {
    id: string;
    startAt: Date;
    status: string;
    notes: string | null;
    service: { name: string; priceCents: number; currency: string };
    resource: { name: string };
    location: { timezone: string };
  };
  isLast: boolean;
  accent?: boolean;
}) {
  const day = formatInTimeZone(
    b.startAt,
    b.location.timezone,
    "yyyy-MM-dd",
  );
  const when = formatInTimeZone(
    b.startAt,
    b.location.timezone,
    "EEE MMM d · HH:mm",
  );

  return (
    <li className="relative flex gap-3 pb-5 pl-4 last:pb-0">
      {!isLast ? (
        <span
          className="absolute top-3 bottom-0 left-[0.2rem] w-px bg-[var(--border)]"
          aria-hidden
        />
      ) : null}
      <span
        className={`absolute top-1.5 left-0 h-2 w-2 rounded-full ${
          accent ? "bg-[var(--accent)]" : "bg-[var(--ink-tertiary)]"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/dashboard/appointments?day=${day}`}
              className="text-sm font-medium hover:text-[var(--accent)]"
            >
              {when}
            </Link>
            <p className="text-sm text-[var(--ink-secondary)]">
              {b.service.name}
              <span className="text-[var(--ink-tertiary)]">
                {" "}
                · {b.resource.name}
              </span>
            </p>
            {b.notes ? (
              <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                Note: {b.notes}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusPill status={b.status} />
            <span className="text-[11px] tabular-nums text-[var(--ink-tertiary)]">
              {formatMoney(b.service.priceCents, b.service.currency)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
