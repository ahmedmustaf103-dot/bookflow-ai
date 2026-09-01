"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { AppointmentActions } from "./appointment-actions";
import type { BookingStatus } from "@/generated/prisma/client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/ui/status-pill";
import { Surface } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { rescheduleBookingAction } from "@/server/actions/booking";

export type CalendarBooking = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  clientName: string;
  serviceName: string;
  resourceId: string;
  resourceName: string;
  timezone: string;
  durationMin: number;
};

type View = "day" | "week" | "month";

const HOUR_START = 7;
const HOUR_END = 21;
const PX_PER_MIN = 1.2;
const SNAP_MIN = 15;

function buildHref(opts: { day: string; view: View; resourceId?: string }) {
  const sp = new URLSearchParams();
  sp.set("day", opts.day);
  sp.set("view", opts.view);
  if (opts.resourceId) sp.set("resourceId", opts.resourceId);
  return `/dashboard/appointments?${sp}`;
}

function minutesFromMidnight(iso: string, tz: string) {
  const hm = formatInTimeZone(new Date(iso), tz, "H:m");
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function canDrag(status: string) {
  return status === "PENDING" || status === "CONFIRMED";
}

function bookingsOnDay(
  bookings: CalendarBooking[],
  dateStr: string,
  timezone: string,
) {
  return bookings.filter(
    (b) =>
      formatInTimeZone(
        new Date(b.startAt),
        b.timezone || timezone,
        "yyyy-MM-dd",
      ) === dateStr,
  );
}

export function CalendarBoard({
  day,
  view,
  timezone,
  resourceId,
  resources,
  bookings,
  newAppointmentHref = "/dashboard/appointments/new",
}: {
  day: string;
  view: View;
  timezone: string;
  resourceId?: string;
  resources: Array<{ id: string; name: string }>;
  bookings: CalendarBooking[];
  newAppointmentHref?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const anchor = parseISO(`${day}T12:00:00`);
  const selected = bookings.find((b) => b.id === selectedId) ?? null;
  const dayBookings = useMemo(
    () => bookingsOnDay(bookings, day, timezone),
    [bookings, day, timezone],
  );

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = HOUR_START; h <= HOUR_END; h++) list.push(h);
    return list;
  }, []);

  const gridHeight = (HOUR_END - HOUR_START) * 60 * PX_PER_MIN;

  function navigate(nextDay: string, nextView = view) {
    router.push(buildHref({ day: nextDay, view: nextView, resourceId }));
  }

  function onDropToSlot(dateStr: string, minuteOfDay: number) {
    if (!draggingId) return;
    const booking = bookings.find((b) => b.id === draggingId);
    if (!booking || !canDrag(booking.status)) return;

    const snapped = Math.round(minuteOfDay / SNAP_MIN) * SNAP_MIN;
    const hh = String(Math.floor(snapped / 60)).padStart(2, "0");
    const mm = String(snapped % 60).padStart(2, "0");
    const startAt = fromZonedTime(
      `${dateStr}T${hh}:${mm}:00`,
      booking.timezone || timezone,
    );

    const formData = new FormData();
    formData.set("bookingId", booking.id);
    formData.set("startAt", startAt.toISOString());
    setDraggingId(null);

    startTransition(async () => {
      const result = await rescheduleBookingAction(formData);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Appointment moved", "success");
      router.refresh();
    });
  }

  function onReschedule(
    booking: CalendarBooking,
    dateStr: string,
    timeStr: string,
  ) {
    const [h, m] = timeStr.split(":").map(Number);
    const minuteOfDay = (h ?? 0) * 60 + (m ?? 0);
    const snapped = Math.round(minuteOfDay / SNAP_MIN) * SNAP_MIN;
    const hh = String(Math.floor(snapped / 60)).padStart(2, "0");
    const mm = String(snapped % 60).padStart(2, "0");
    const startAt = fromZonedTime(
      `${dateStr}T${hh}:${mm}:00`,
      booking.timezone || timezone,
    );
    const formData = new FormData();
    formData.set("bookingId", booking.id);
    formData.set("startAt", startAt.toISOString());
    startTransition(async () => {
      const result = await rescheduleBookingAction(formData);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Appointment moved", "success");
      router.refresh();
    });
  }

  const weekDays = eachDayOfInterval({
    start: startOfWeek(anchor, { weekStartsOn: 1 }),
    end: endOfWeek(anchor, { weekStartsOn: 1 }),
  });

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
  });

  const prev =
    view === "month"
      ? format(addDays(startOfMonth(anchor), -1), "yyyy-MM-dd")
      : view === "week"
        ? format(addDays(anchor, -7), "yyyy-MM-dd")
        : format(addDays(anchor, -1), "yyyy-MM-dd");
  const next =
    view === "month"
      ? format(addDays(endOfMonth(anchor), 1), "yyyy-MM-dd")
      : view === "week"
        ? format(addDays(anchor, 7), "yyyy-MM-dd")
        : format(addDays(anchor, 1), "yyyy-MM-dd");

  const title =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : view === "week"
        ? `${format(weekDays[0]!, "MMM d")} – ${format(weekDays[6]!, "MMM d, yyyy")}`
        : format(anchor, "EEEE, MMM d");

  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col gap-3"
        data-tour="staff-appointment-actions"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex w-full items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-0.5 sm:w-auto">
              {(["day", "week", "month"] as View[]).map((v) => (
                <Link
                  key={v}
                  href={buildHref({ day, view: v, resourceId })}
                  className={`min-h-11 flex-1 rounded-[5px] px-3 py-2 text-center text-sm font-medium capitalize sm:min-h-0 sm:flex-none sm:py-1.5 sm:text-xs ${
                    view === v
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {v}
                </Link>
              ))}
            </div>

            <div className="inline-flex w-full items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-0.5 sm:w-auto">
              <button
                type="button"
                onClick={() => navigate(prev)}
                className="min-h-11 flex-1 rounded-[5px] px-3 py-2 text-sm font-medium text-[var(--ink-secondary)] hover:bg-[var(--muted)] sm:min-h-0 sm:flex-none sm:py-1.5 sm:text-xs"
                aria-label="Previous"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => navigate(todayStr)}
                className={`min-h-11 flex-1 rounded-[5px] px-3 py-2 text-sm font-medium hover:bg-[var(--muted)] sm:min-h-0 sm:flex-none sm:py-1.5 sm:text-xs ${
                  day === todayStr
                    ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                    : "text-[var(--ink-secondary)]"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => navigate(next)}
                className="min-h-11 flex-1 rounded-[5px] px-3 py-2 text-sm font-medium text-[var(--ink-secondary)] hover:bg-[var(--muted)] sm:min-h-0 sm:flex-none sm:py-1.5 sm:text-xs"
                aria-label="Next"
              >
                Next
              </button>
            </div>
          </div>

          <p className="text-base font-semibold tabular-nums sm:text-sm">
            {title}
            {pending ? (
              <span className="ml-2 text-xs font-normal text-[var(--ink-tertiary)]">
                Saving…
              </span>
            ) : null}
          </p>
        </div>

        {resources.length > 1 ? (
          <label className="flex flex-col gap-1.5 text-xs text-[var(--ink-secondary)] sm:flex-row sm:items-center sm:gap-2">
            <span className="font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
              Staff
            </span>
            <select
              className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-base sm:h-8 sm:w-auto sm:text-sm"
              value={resourceId ?? ""}
              onChange={(e) => {
                router.push(
                  buildHref({
                    day,
                    view,
                    resourceId: e.target.value || undefined,
                  }),
                );
              }}
            >
              <option value="">All staff</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {view === "month" ? (
          <MonthGrid
            days={monthDays}
            anchor={anchor}
            day={day}
            resourceId={resourceId}
            bookings={bookings}
            timezone={timezone}
            compact
          />
        ) : (
          <WeekStrip
            days={weekDays}
            day={day}
            view={view}
            resourceId={resourceId}
            bookings={bookings}
            timezone={timezone}
            todayStr={todayStr}
          />
        )}
        <DayAgenda
          day={day}
          timezone={timezone}
          bookings={dayBookings}
          selectedId={selectedId}
          onSelect={setSelectedId}
          newAppointmentHref={newAppointmentHref}
        />
        {selected ? (
          <BookingDetail
            booking={selected}
            pending={pending}
            onClose={() => setSelectedId(null)}
            onReschedule={onReschedule}
            showDragHint={false}
          />
        ) : null}
        <ButtonLink
          href={newAppointmentHref}
          className="min-h-12 w-full text-base"
        >
          Walk-in / new appointment
        </ButtonLink>
      </div>

      <div className="hidden md:block">
        {view === "month" ? (
          <MonthGrid
            days={monthDays}
            anchor={anchor}
            day={day}
            resourceId={resourceId}
            bookings={bookings}
            timezone={timezone}
          />
        ) : view === "week" ? (
          <TimeGrid
            days={weekDays}
            hours={hours}
            gridHeight={gridHeight}
            bookings={bookings}
            timezone={timezone}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDragStart={setDraggingId}
            onDropToSlot={onDropToSlot}
            compact
          />
        ) : (
          <TimeGrid
            days={[anchor]}
            hours={hours}
            gridHeight={gridHeight}
            bookings={bookings}
            timezone={timezone}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDragStart={setDraggingId}
            onDropToSlot={onDropToSlot}
          />
        )}
        {selected ? (
          <div className="mt-4">
            <BookingDetail
              booking={selected}
              pending={pending}
              onClose={() => setSelectedId(null)}
              onReschedule={onReschedule}
              showDragHint={canDrag(selected.status)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WeekStrip({
  days,
  day,
  view,
  resourceId,
  bookings,
  timezone,
  todayStr,
}: {
  days: Date[];
  day: string;
  view: View;
  resourceId?: string;
  bookings: CalendarBooking[];
  timezone: string;
  todayStr: string;
}) {
  return (
    <div
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      role="navigation"
      aria-label="Days this week"
    >
      {days.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const count = bookingsOnDay(bookings, dateStr, timezone).length;
        const selected = dateStr === day;
        const isToday = dateStr === todayStr;
        return (
          <Link
            key={dateStr}
            href={buildHref({ day: dateStr, view, resourceId })}
            className={`flex min-h-14 min-w-[3rem] flex-1 flex-col items-center justify-center rounded-[var(--radius-control)] border px-1.5 py-1.5 ${
              selected
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : isToday
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]"
            }`}
          >
            <span className="text-[10px] font-medium uppercase opacity-80">
              {format(d, "EEE")}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {format(d, "d")}
            </span>
            {count > 0 ? (
              <span
                className={`mt-0.5 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-[var(--accent)]"}`}
                aria-label={`${count} appointments`}
              />
            ) : (
              <span className="mt-0.5 h-1 w-1" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

function DayAgenda({
  day,
  timezone,
  bookings,
  selectedId,
  onSelect,
  newAppointmentHref,
}: {
  day: string;
  timezone: string;
  bookings: CalendarBooking[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  newAppointmentHref: string;
}) {
  const now = Date.now();
  const nextUp = bookings.find((b) => new Date(b.endAt).getTime() > now);

  return (
    <Surface padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold">
          {format(parseISO(`${day}T12:00:00`), "EEEE d MMM")}
        </h2>
        <span className="text-xs text-[var(--ink-tertiary)]">
          {bookings.length}{" "}
          {bookings.length === 1 ? "appointment" : "appointments"}
        </span>
      </div>
      {bookings.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium">Nothing booked this day</p>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            Add a walk-in or share the booking page.
          </p>
          <ButtonLink
            href={newAppointmentHref}
            size="sm"
            className="mt-4 min-h-11"
          >
            New appointment
          </ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {bookings.map((b) => {
            const selected = selectedId === b.id;
            const isNext = nextUp?.id === b.id;
            const tz = b.timezone || timezone;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onSelect(b.id)}
                  className={`flex min-h-16 w-full items-start gap-3 px-4 py-3 text-left ${
                    selected
                      ? "bg-[var(--accent-soft)]"
                      : "hover:bg-[var(--muted)]/60"
                  }`}
                >
                  <div className="w-14 shrink-0 pt-0.5">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatInTimeZone(new Date(b.startAt), tz, "HH:mm")}
                    </p>
                    <p className="text-xs text-[var(--ink-tertiary)] tabular-nums">
                      {formatInTimeZone(new Date(b.endAt), tz, "HH:mm")}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {b.clientName}
                      </p>
                      {isNext ? (
                        <span className="text-[10px] font-semibold tracking-wide text-[var(--accent)] uppercase">
                          Next
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-[var(--ink-secondary)]">
                      {b.serviceName} · {b.resourceName}
                    </p>
                    <div className="mt-1">
                      <StatusPill status={b.status} />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

function BookingDetail({
  booking,
  pending,
  onClose,
  onReschedule,
  showDragHint,
}: {
  booking: CalendarBooking;
  pending: boolean;
  onClose: () => void;
  onReschedule: (
    booking: CalendarBooking,
    dateStr: string,
    timeStr: string,
  ) => void;
  showDragHint: boolean;
}) {
  const tz = booking.timezone;
  const dateValue = formatInTimeZone(
    new Date(booking.startAt),
    tz,
    "yyyy-MM-dd",
  );
  const timeValue = formatInTimeZone(new Date(booking.startAt), tz, "HH:mm");

  return (
    <Surface className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold sm:text-sm">
            {booking.clientName}
          </p>
          <p className="text-sm text-[var(--ink-secondary)]">
            {booking.serviceName} · {booking.resourceName}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-tertiary)] tabular-nums sm:text-xs">
            {formatInTimeZone(
              new Date(booking.startAt),
              tz,
              "EEE MMM d · HH:mm",
            )}{" "}
            – {formatInTimeZone(new Date(booking.endAt), tz, "HH:mm")}
          </p>
        </div>
        <StatusPill status={booking.status} />
      </div>

      <div className="mt-4">
        <AppointmentActions
          bookingId={booking.id}
          status={booking.status as BookingStatus}
        />
      </div>

      {canDrag(booking.status) ? (
        <form
          className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const dateStr = String(new FormData(form).get("date") ?? "");
            const timeStr = String(new FormData(form).get("time") ?? "");
            if (!dateStr || !timeStr) return;
            onReschedule(booking, dateStr, timeStr);
          }}
        >
          <p className="text-sm font-medium">Reschedule</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`reschedule-date-${booking.id}`}>Date</Label>
              <Input
                id={`reschedule-date-${booking.id}`}
                name="date"
                type="date"
                required
                defaultValue={dateValue}
                key={`${booking.id}-${dateValue}`}
              />
            </div>
            <div>
              <Label htmlFor={`reschedule-time-${booking.id}`}>Time</Label>
              <Input
                id={`reschedule-time-${booking.id}`}
                name="time"
                type="time"
                step={900}
                required
                defaultValue={timeValue}
                key={`${booking.id}-${timeValue}`}
              />
            </div>
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {pending ? "Saving…" : "Move appointment"}
          </Button>
          {showDragHint ? (
            <p className="text-xs text-[var(--ink-tertiary)]">
              Or drag this booking on the grid (15-minute snaps).
            </p>
          ) : (
            <p className="text-xs text-[var(--ink-tertiary)]">
              Times snap to 15 minutes, same as the desktop calendar.
            </p>
          )}
        </form>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        className="mt-2 min-h-11 w-full sm:h-8 sm:w-auto"
        onClick={onClose}
      >
        Close
      </Button>
    </Surface>
  );
}

function TimeGrid({
  days,
  hours,
  gridHeight,
  bookings,
  timezone,
  selectedId,
  onSelect,
  onDragStart,
  onDropToSlot,
  compact,
}: {
  days: Date[];
  hours: number[];
  gridHeight: number;
  bookings: CalendarBooking[];
  timezone: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string | null) => void;
  onDropToSlot: (dateStr: string, minuteOfDay: number) => void;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
      <div
        className="grid"
        style={{
          minWidth: days.length > 1 ? "640px" : undefined,
          gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(${compact ? "5.5rem" : "12rem"}, 1fr))`,
        }}
      >
        <div className="border-b border-[var(--border)]" />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className="border-b border-l border-[var(--border)] px-2 py-2 text-center"
          >
            <p className="text-[10px] font-medium text-[var(--ink-tertiary)] uppercase">
              {format(d, "EEE")}
            </p>
            <Link
              href={buildHref({
                day: format(d, "yyyy-MM-dd"),
                view: "day",
              })}
              className="text-sm font-semibold tabular-nums hover:text-[var(--accent)]"
            >
              {format(d, "d")}
            </Link>
          </div>
        ))}

        <div className="relative border-r border-[var(--border)]">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute right-1 text-[10px] text-[var(--ink-tertiary)] tabular-nums"
              style={{
                top: (h - HOUR_START) * 60 * PX_PER_MIN - 6,
              }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
          <div style={{ height: gridHeight }} />
        </div>

        {days.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const dayBookings = bookingsOnDay(bookings, dateStr, timezone);
          return (
            <div
              key={dateStr}
              className="relative border-l border-[var(--border)]"
              style={{ height: gridHeight }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const minuteOfDay = HOUR_START * 60 + y / PX_PER_MIN;
                onDropToSlot(dateStr, minuteOfDay);
              }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-0 left-0 border-t border-[var(--border)]/70"
                  style={{ top: (h - HOUR_START) * 60 * PX_PER_MIN }}
                />
              ))}
              {dayBookings.map((b) => {
                const startMin = minutesFromMidnight(b.startAt, b.timezone);
                const endMin = minutesFromMidnight(b.endAt, b.timezone);
                const top = (startMin - HOUR_START * 60) * PX_PER_MIN;
                const height = Math.max((endMin - startMin) * PX_PER_MIN, 22);
                const selected = selectedId === b.id;
                const draggable = canDrag(b.status);
                return (
                  <button
                    key={b.id}
                    type="button"
                    draggable={draggable}
                    onDragStart={() => onDragStart(b.id)}
                    onDragEnd={() => onDragStart(null)}
                    onClick={() => onSelect(b.id)}
                    className={`absolute right-1 left-1 overflow-hidden rounded-md border px-1.5 py-1 text-left shadow-[var(--shadow-sm)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--ink)]"
                    } ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    style={{ top, height }}
                    title={`${b.clientName} · ${b.serviceName}`}
                  >
                    <p className="truncate text-[11px] font-semibold">
                      {formatInTimeZone(
                        new Date(b.startAt),
                        b.timezone,
                        "HH:mm",
                      )}{" "}
                      {b.clientName}
                    </p>
                    {!compact ? (
                      <p
                        className={`truncate text-[10px] ${selected ? "text-white/80" : "text-[var(--ink-tertiary)]"}`}
                      >
                        {b.serviceName}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({
  days,
  anchor,
  day,
  resourceId,
  bookings,
  timezone,
  compact,
}: {
  days: Date[];
  anchor: Date;
  day: string;
  resourceId?: string;
  bookings: CalendarBooking[];
  timezone: string;
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--muted)]/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="px-1 py-2 text-center text-[10px] font-medium text-[var(--ink-tertiary)] uppercase sm:px-2"
          >
            {compact ? d.slice(0, 1) : d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const count = bookingsOnDay(bookings, dateStr, timezone).length;
          const inMonth = isSameMonth(d, anchor);
          const isSelected = dateStr === day;
          const isToday = isSameDay(d, new Date());
          return (
            <Link
              key={dateStr}
              href={buildHref({
                day: dateStr,
                view: compact ? "month" : "day",
                resourceId,
              })}
              className={`${compact ? "min-h-11" : "min-h-[4.5rem]"} border-r border-b border-[var(--border)] p-1.5 hover:bg-[var(--muted)]/60 sm:p-2 ${
                inMonth ? "" : "bg-[var(--muted)]/30 text-[var(--ink-tertiary)]"
              } ${isSelected ? "bg-[var(--accent-soft)]" : ""}`}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums sm:h-6 sm:w-6 ${
                  isToday ? "bg-[var(--accent)] text-white" : ""
                }`}
              >
                {format(d, "d")}
              </span>
              {count > 0 && !compact ? (
                <p className="mt-2 text-[11px] font-medium text-[var(--accent)]">
                  {count} booking{count === 1 ? "" : "s"}
                </p>
              ) : null}
              {count > 0 && compact ? (
                <span
                  className="mx-auto mt-1 block h-1 w-1 rounded-full bg-[var(--accent)]"
                  aria-label={`${count} appointments`}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
