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
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  bookingWhereForScope,
  resolveStaffResourceScope,
} from "@/server/staff/scope";
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
  const requestedResourceId = params.resourceId?.trim() || undefined;
  const scope = await resolveStaffResourceScope({
    organizationId: ctx.organization.id,
    userId: ctx.user.id,
    role: ctx.membership.role,
  });
  const resourceId =
    requestedResourceId &&
    (scope.all || scope.resourceIds.includes(requestedResourceId))
      ? requestedResourceId
      : undefined;

  const { from, to } = rangeForView(day, view, tz);

  const [bookings, resources] = await Promise.all([
    ctx.db.booking.findMany({
      where: {
        startAt: { gte: from, lt: to },
        ...bookingWhereForScope(scope),
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
      where: {
        isActive: true,
        ...(scope.all ? {} : { id: { in: scope.resourceIds } }),
      },
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
        description={
          scope.all
            ? "Day, week, and month views — drag bookings to reschedule. Filter by staff."
            : scope.resourceIds.length === 0
              ? "Ask the owner to assign your login to a chair on Staff so appointments show here."
              : "Your appointments — drag to reschedule."
        }
        actions={
          scope.all || scope.resourceIds.length > 0 ? (
            <>
              <ButtonLink href="/dashboard/appointments/new" size="sm">
                New appointment
              </ButtonLink>
              {scope.all ? (
                <ButtonLink
                  href={`/book/${ctx.organization.slug}`}
                  variant="secondary"
                  size="sm"
                >
                  Booking page
                </ButtonLink>
              ) : null}
            </>
          ) : null
        }
      />

      {!scope.all && scope.resourceIds.length === 0 ? (
        <EmptyState
          title="No chair assigned"
          description="The owner can assign your login to a bookable chair under Staff. Until then, this calendar stays empty."
        />
      ) : (
        <CalendarBoard
          day={day}
          view={view}
          timezone={tz}
          resourceId={resourceId}
          resources={resources}
          bookings={calendarBookings}
        />
      )}
    </div>
  );
}
