import { formatInTimeZone } from "date-fns-tz";
import { addDays, startOfDay } from "date-fns";

import { AppointmentActions } from "./appointment-actions";
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
  // Load a wide UTC window; display filtered by local day labels
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Appointments</h1>
          <p className="mt-2 text-[var(--color-ink)]/70">
            Day board for your active organization.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <a
            href={`/dashboard/appointments?day=${prev}`}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5"
          >
            Prev
          </a>
          <span className="min-w-[9rem] text-center font-medium">{day}</span>
          <a
            href={`/dashboard/appointments?day=${next}`}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5"
          >
            Next
          </a>
        </div>
      </div>

      <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
        {dayBookings.map((b) => (
          <li
            key={b.id}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {formatInTimeZone(b.startAt, b.location.timezone, "HH:mm")} ·{" "}
                {b.service.name}
              </p>
              <p className="text-sm text-[var(--color-ink)]/65">
                {b.client.name}
                {b.client.email ? ` · ${b.client.email}` : ""} ·{" "}
                {b.resource.name}
              </p>
              <p className="mt-1 text-xs tracking-wide text-[var(--color-ink)]/45 uppercase">
                {b.status} · {b.source}
              </p>
            </div>
            <AppointmentActions bookingId={b.id} status={b.status} />
          </li>
        ))}
        {dayBookings.length === 0 ? (
          <li className="px-4 py-8 text-sm text-[var(--color-ink)]/60">
            No appointments this day. Share your booking link:{" "}
            <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5">
              /book/{ctx.organization.slug}
            </code>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
