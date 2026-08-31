import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";

import type { BookingStatus } from "@/generated/prisma/client";
import { AppointmentActions } from "@/app/(dashboard)/dashboard/appointments/appointment-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { Surface } from "@/components/ui/surface";
import { ButtonLink } from "@/components/ui/button";

type FloorBooking = {
  id: string;
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
  client: { name: string };
  service: { name: string };
  resource: { name: string };
  location: { timezone: string };
};

function timeRange(b: FloorBooking, tz: string) {
  return `${formatInTimeZone(b.startAt, tz, "HH:mm")}–${formatInTimeZone(b.endAt, tz, "HH:mm")}`;
}

function calendarHref(b: FloorBooking, tz: string) {
  const day = formatInTimeZone(b.startAt, tz, "yyyy-MM-dd");
  return `/dashboard/appointments?day=${day}`;
}

export function DashboardFloor({
  current,
  upcoming,
  recentlyCompleted,
  timeZone,
  bookPath,
  showOwnerLinks = true,
  showCrmLink = true,
}: {
  current: FloorBooking | null;
  upcoming: FloorBooking[];
  recentlyCompleted: FloorBooking[];
  timeZone: string;
  bookPath: string;
  showOwnerLinks?: boolean;
  showCrmLink?: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="flex flex-col gap-4">
        <Surface className="relative overflow-hidden pl-5">
          <span
            className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]"
            aria-hidden
          />
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-[var(--accent)] uppercase">
                Current booking
              </p>
              <h2 className="text-sm font-semibold">Who you’re serving now</h2>
            </div>
            <Link
              href="/dashboard/appointments"
              className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Full calendar
            </Link>
          </div>

          {current ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-[var(--ink)]">
                  {current.client.name}
                </p>
                <p className="truncate text-sm text-[var(--ink-secondary)]">
                  {current.service.name}
                </p>
                <p className="mt-1 text-sm tabular-nums text-[var(--ink)]">
                  {timeRange(current, current.location.timezone || timeZone)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
                  Staff: {current.resource.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={current.status} />
                  {current.startAt.getTime() <= Date.now() &&
                  current.endAt.getTime() > Date.now() ? (
                    <span className="text-[11px] font-medium tracking-wide text-[var(--accent)] uppercase">
                      In progress
                    </span>
                  ) : current.endAt.getTime() <= Date.now() ? (
                    <span className="text-[11px] font-medium tracking-wide text-[var(--warning)] uppercase">
                      Overdue
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <AppointmentActions
                  bookingId={current.id}
                  status={current.status}
                />
                <Link
                  href={calendarHref(
                    current,
                    current.location.timezone || timeZone,
                  )}
                  className="text-center text-xs font-medium text-[var(--accent)] hover:underline sm:text-right"
                >
                  View details
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              className="py-8"
              title="No one in the chair"
              description="Upcoming visits show below. Share your booking link if the day is empty."
              action={
                <ButtonLink href={bookPath} size="sm" variant="secondary">
                  Booking page
                </ButtonLink>
              }
            />
          )}
        </Surface>

        <Surface>
          <h2 className="text-sm font-semibold">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--ink-tertiary)]">
              Nothing else on today’s schedule.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {upcoming.map((b) => {
                const tz = b.location.timezone || timeZone;
                return (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {formatInTimeZone(b.startAt, tz, "HH:mm")} —{" "}
                        {b.client.name}
                      </p>
                      <p className="truncate text-xs text-[var(--ink-tertiary)]">
                        {b.service.name} · {b.resource.name}
                      </p>
                    </div>
                    <Link
                      href={calendarHref(b, tz)}
                      className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-[var(--accent)] hover:underline"
                    >
                      Details
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>
      </div>

      <Surface>
        <h2 className="text-sm font-semibold">Recently completed</h2>
        {recentlyCompleted.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink-tertiary)]">
            Completed visits today will show here, then follow-up and review
            automations can run.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {recentlyCompleted.map((b) => {
              const tz = b.location.timezone || timeZone;
              return (
                <li key={b.id} className="py-2.5">
                  <p className="truncate text-sm font-medium">
                    {b.client.name}
                  </p>
                  <p className="text-xs text-[var(--ink-tertiary)]">
                    Today, {formatInTimeZone(b.startAt, tz, "HH:mm")} ·{" "}
                    {b.service.name}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <ul className="mt-6 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
          {showOwnerLinks ? (
            <li>
              <Link
                href="/dashboard/analytics"
                className="text-[var(--accent)] hover:underline"
              >
                Revenue & customer insights →
              </Link>
            </li>
          ) : null}
          {showCrmLink ? (
            <li>
              <Link
                href="/dashboard/clients"
                className="text-[var(--accent)] hover:underline"
              >
                Client CRM →
              </Link>
            </li>
          ) : null}
          {showOwnerLinks ? (
            <li>
              <Link
                href="/dashboard/settings"
                className="text-[var(--accent)] hover:underline"
              >
                Automation settings →
              </Link>
            </li>
          ) : null}
        </ul>
      </Surface>
    </div>
  );
}
