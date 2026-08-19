import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { CalendarBoard, type CalendarBooking } from "./calendar-board";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrgRole } from "@/server/tenant/context";

type View = "day" | "week" | "month";

function rangeForView(day: string, view: View, tz: string) {
  const anchor = fromZonedTime(`${day}T12:00:00`, tz);
  if (view === "month") {
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    return {
      from: fromZonedTime(
        `${formatInTimeZone(start, tz, "yyyy-MM-dd")}T00:00:00`,
        tz,
      ),
      to: fromZonedTime(
        `${formatInTimeZone(addDays(end, 1), tz, "yyyy-MM-dd")}T00:00:00`,
        tz,
      ),
    };
  }
  if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    return {
      from: fromZonedTime(
        `${formatInTimeZone(start, tz, "yyyy-MM-dd")}T00:00:00`,
        tz,
      ),
      to: fromZonedTime(
        `${formatInTimeZone(addDays(end, 1), tz, "yyyy-MM-dd")}T00:00:00`,
        tz,
      ),
    };
  }
  return {
    from: fromZonedTime(`${day}T00:00:00`, tz),
    to: fromZonedTime(
      `${formatInTimeZone(addDays(anchor, 1), tz, "yyyy-MM-dd")}T00:00:00`,
      tz,
    ),
  };
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    day?: string;
    view?: string;
    resourceId?: string;
  }>;
}) {
  const ctx = await requireOrgRole("STAFF");
  const params = await searchParams;
  const tz = ctx.organization.timezoneDefault;
  const day = params.day ?? formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const view: View =
    params.view === "week" || params.view === "month" ? params.view : "day";
  const resourceId = params.resourceId?.trim() || undefined;

  const { from, to } = rangeForView(day, view, tz);

  const [bookings, resources] = await Promise.all([
    ctx.db.booking.findMany({
      where: {
        startAt: { gte: from, lt: to },
        ...(resourceId ? { resourceId } : {}),
        status: { not: "CANCELLED" },
      },
      include: {
        client: true,
        service: true,
        resource: true,
        location: true,
      },
      orderBy: { startAt: "asc" },
    }),
    ctx.db.resource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const calendarBookings: CalendarBooking[] = bookings.map((b) => ({
    id: b.id,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    source: b.source,
    clientName: b.client.name,
    serviceName: b.service.name,
    resourceId: b.resourceId,
    resourceName: b.resource.name,
    timezone: b.location.timezone,
    durationMin: b.service.durationMin,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Calendar"
        description="Day, week, and month views — drag bookings to reschedule. Filter by staff."
        actions={
          <>
            <ButtonLink href="/dashboard/appointments/new" size="sm">
              New appointment
            </ButtonLink>
            <ButtonLink
              href={`/book/${ctx.organization.slug}`}
              variant="secondary"
              size="sm"
            >
              Booking page
            </ButtonLink>
          </>
        }
      />

      <CalendarBoard
        day={day}
        view={view}
        timezone={tz}
        resourceId={resourceId}
        resources={resources}
        bookings={calendarBookings}
      />
    </div>
  );
}
