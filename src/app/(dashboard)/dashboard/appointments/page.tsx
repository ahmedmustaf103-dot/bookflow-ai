import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { addDays, startOfDay } from "date-fns";

import { AppointmentActions } from "./appointment-actions";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireOrgRole } from "@/server/tenant/context";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const ctx = await requireOrgRole("STAFF");
  const params = await searchParams;
  const tz = ctx.organization.timezoneDefault;

  const day = params.day ?? formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const rangeStart = addDays(startOfDay(dayStart), -1);
  const rangeEnd = addDays(startOfDay(dayStart), 2);

  const bookings = await ctx.db.booking.findMany({
    where: {
      startAt: { gte: rangeStart, lt: rangeEnd },
    },
    include: {
      client: true,
      service: true,
      resource: true,
      location: true,
    },
    orderBy: { startAt: "asc" },
  });

  const dayBookings = bookings.filter(
    (b) =>
      formatInTimeZone(b.startAt, b.location.timezone, "yyyy-MM-dd") === day,
  );

  const prev = formatInTimeZone(
    addDays(new Date(`${day}T12:00:00Z`), -1),
    "UTC",
    "yyyy-MM-dd",
  );
  const next = formatInTimeZone(
    addDays(new Date(`${day}T12:00:00Z`), 1),
    "UTC",
    "yyyy-MM-dd",
  );

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Day board for your active organization."
        actions={
          <div className="inline-flex items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <Link
              href={`/dashboard/appointments?day=${prev}`}
              aria-label="Previous day"
              className="rounded-[5px] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            >
              Prev
            </Link>
            <span className="min-w-[7.5rem] px-2 text-center text-xs font-semibold tabular-nums">
              {day}
            </span>
            <Link
              href={`/dashboard/appointments?day=${next}`}
              aria-label="Next day"
              className="rounded-[5px] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            >
              Next
            </Link>
          </div>
        }
      />

      <DataTable
        rows={dayBookings}
        rowKey={(b) => b.id}
        emptyTitle="No appointments this day"
        emptyDescription={`Share /book/${ctx.organization.slug} to get bookings.`}
        columns={[
          {
            key: "time",
            header: "Time",
            className: "w-24",
            cell: (b) => (
              <span className="font-medium tabular-nums">
                {formatInTimeZone(b.startAt, b.location.timezone, "HH:mm")}
              </span>
            ),
          },
          {
            key: "service",
            header: "Service",
            cell: (b) => b.service.name,
          },
          {
            key: "client",
            header: "Client",
            cell: (b) => (
              <div>
                <p className="font-medium">{b.client.name}</p>
                <p className="text-xs text-[var(--ink-tertiary)]">
                  {[b.client.email, b.resource.name].filter(Boolean).join(" · ")}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (b) => (
              <div className="flex flex-col gap-1">
                <StatusPill status={b.status} />
                <span className="text-[10px] text-[var(--ink-tertiary)] uppercase">
                  {b.source}
                </span>
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (b) => (
              <AppointmentActions bookingId={b.id} status={b.status} />
            ),
          },
        ]}
      />

      {dayBookings.length === 0 ? (
        <div className="mt-4">
          <ButtonLink
            href={`/book/${ctx.organization.slug}`}
            variant="secondary"
            size="sm"
          >
            Open booking page
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
