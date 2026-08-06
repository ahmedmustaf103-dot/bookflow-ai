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
import { Button } from "@/components/ui/button";
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

function buildHref(opts: {
  day: string;
  view: View;
  resourceId?: string;
}) {
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

export function CalendarBoard({
  day,
  view,
  timezone,
  resourceId,
  resources,
  bookings,
}: {
  day: string;
  view: View;
  timezone: string;
  resourceId?: string;
  resources: Array<{ id: string; name: string }>;
  bookings: CalendarBooking[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const anchor = parseISO(`${day}T12:00:00`);
  const selected = bookings.find((b) => b.id === selectedId) ?? null;

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = HOUR_START; h <= HOUR_END; h++) list.push(h);
    return list;
  }, []);

  const gridHeight = (HOUR_END - HOUR_START) * 60 * PX_PER_MIN;

  function navigate(nextDay: string, nextView = view) {
    router.push(
      buildHref({ day: nextDay, view: nextView, resourceId }),
    );
  }

  function onDropToSlot(dateStr: string, minuteOfDay: number) {
    if (!draggingId) return;
    const booking = bookings.find((b) => b.id === draggingId);
    if (!booking || !canDrag(booking.status)) return;

    const snapped =
      Math.round(minuteOfDay / SNAP_MIN) * SNAP_MIN;
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
        ? `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`
        : format(anchor, "EEEE, MMM d");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-0.5">
            {(["day", "week", "month"] as View[]).map((v) => (
              <Link
                key={v}
                href={buildHref({ day, view: v, resourceId })}
                className={`rounded-[5px] px-3 py-1.5 text-xs font-medium capitalize ${
                  view === v
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
                }`}
              >
                {v}
              </Link>
            ))}
          </div>

          <div className="inline-flex items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <button
              type="button"
              onClick={() => navigate(prev)}
              className="rounded-[5px] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
              aria-label="Previous"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"))
              }
              className="rounded-[5px] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => navigate(next)}
              className="rounded-[5px] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
              aria-label="Next"
            >
              Next
            </button>
          </div>

          <p className="text-sm font-semibold tabular-nums">{title}</p>
          {pending ? (
            <span className="text-xs text-[var(--ink-tertiary)]">Saving…</span>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
          <span className="font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">
            Staff
          </span>
          <select
            className="h-8 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
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
      </div>

      <p className="text-xs text-[var(--ink-tertiary)] sm:hidden">
        Tip: use Day view on phones. Drag bookings on desktop to reschedule.
      </p>

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
        <Surface className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{selected.clientName}</p>
              <p className="text-sm text-[var(--ink-secondary)]">
                {selected.serviceName} · {selected.resourceName}
              </p>
              <p className="mt-1 text-xs tabular-nums text-[var(--ink-tertiary)]">
                {formatInTimeZone(
                  new Date(selected.startAt),
                  selected.timezone,
                  "EEE MMM d · HH:mm",
                )}{" "}
                –{" "}
                {formatInTimeZone(
                  new Date(selected.endAt),
                  selected.timezone,
                  "HH:mm",
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusPill status={selected.status} />
              <AppointmentActions
                bookingId={selected.id}
                status={selected.status as BookingStatus}
              />
            </div>
          </div>
          {canDrag(selected.status) ? (
            <p className="mt-3 text-xs text-[var(--ink-tertiary)]">
              Drag this booking on the grid to reschedule (15-minute snaps).
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setSelectedId(null)}
          >
            Close
          </Button>
        </Surface>
      ) : null}
    </div>
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
        className="grid min-w-[640px]"
        style={{
          gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(${compact ? "5.5rem" : "12rem"}, 1fr))`,
        }}
      >
        <div className="border-b border-[var(--border)]" />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className="border-b border-l border-[var(--border)] px-2 py-2 text-center"
          >
            <p className="text-[10px] font-medium uppercase text-[var(--ink-tertiary)]">
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
              className="absolute right-1 text-[10px] tabular-nums text-[var(--ink-tertiary)]"
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
          const dayBookings = bookings.filter(
            (b) =>
              formatInTimeZone(new Date(b.startAt), b.timezone, "yyyy-MM-dd") ===
              dateStr,
          );
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
                const height = Math.max(
                  (endMin - startMin) * PX_PER_MIN,
                  22,
                );
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
}: {
  days: Date[];
  anchor: Date;
  day: string;
  resourceId?: string;
  bookings: CalendarBooking[];
  timezone: string;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--muted)]/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[10px] font-medium uppercase text-[var(--ink-tertiary)]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const count = bookings.filter(
            (b) =>
              formatInTimeZone(
                new Date(b.startAt),
                b.timezone || timezone,
                "yyyy-MM-dd",
              ) === dateStr,
          ).length;
          const inMonth = isSameMonth(d, anchor);
          const isSelected = dateStr === day;
          const isToday = isSameDay(d, new Date());
          return (
            <Link
              key={dateStr}
              href={buildHref({ day: dateStr, view: "day", resourceId })}
              className={`min-h-[4.5rem] border-r border-b border-[var(--border)] p-2 hover:bg-[var(--muted)]/60 ${
                inMonth ? "" : "bg-[var(--muted)]/30 text-[var(--ink-tertiary)]"
              } ${isSelected ? "bg-[var(--accent-soft)]" : ""}`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                  isToday
                    ? "bg-[var(--accent)] text-white"
                    : ""
                }`}
              >
                {format(d, "d")}
              </span>
              {count > 0 ? (
                <p className="mt-2 text-[11px] font-medium text-[var(--accent)]">
                  {count} booking{count === 1 ? "" : "s"}
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
