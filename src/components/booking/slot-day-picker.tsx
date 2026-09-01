"use client";

import { useEffect, useMemo, useState } from "react";

import type { PublicSlotDay } from "@/lib/booking-types";
import {
  addUtcDaysToYmd,
  eachYmd,
  firstBookableDate,
} from "@/lib/booking-window";

function monthLabel(ymd: string) {
  const [year, month] = ymd.split("-").map(Number);
  if (!year || !month) return ymd;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekdayShort(label: string) {
  return label.split(" ")[0] ?? "";
}

export function SlotDayPicker({
  days,
  value,
  onChange,
  datesLabel = "Appointment date",
  timesLabel = "Appointment time",
  emptyMessage = "No open slots in the booking window.",
}: {
  days: PublicSlotDay[];
  value: string;
  onChange: (startIso: string) => void;
  datesLabel?: string;
  timesLabel?: string;
  emptyMessage?: string;
}) {
  const todayDate = days[0]?.date ?? "";
  const horizonEnd = days[days.length - 1]?.date ?? "";
  const initialSelected = firstBookableDate(days);
  const [weekStart, setWeekStart] = useState(todayDate);
  const [selectedDate, setSelectedDate] = useState(initialSelected);

  useEffect(() => {
    setWeekStart(days[0]?.date ?? "");
    setSelectedDate(firstBookableDate(days));
  }, [days]);

  const visibleDays = useMemo(() => {
    if (!weekStart) return [];
    const weekEnd = addUtcDaysToYmd(weekStart, 6);
    const byDate = new Map(days.map((d) => [d.date, d]));
    return eachYmd(weekStart, weekEnd).map((date) => {
      return (
        byDate.get(date) ?? {
          date,
          label: date,
          slots: [],
        }
      );
    });
  }, [days, weekStart]);

  const selectedDay =
    days.find((d) => d.date === selectedDate && d.slots.length > 0) ??
    days.find((d) => d.slots.length > 0) ??
    null;

  const canPrev = Boolean(todayDate && weekStart > todayDate);
  const nextWeek = weekStart ? addUtcDaysToYmd(weekStart, 7) : "";
  const canNext = Boolean(nextWeek && horizonEnd && nextWeek <= horizonEnd);

  if (days.every((d) => d.slots.length === 0)) {
    return (
      <p className="mt-3 text-sm text-[var(--ink-secondary)]">{emptyMessage}</p>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--ink)]">
          {monthLabel(selectedDay?.date ?? weekStart)}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous week"
            disabled={!canPrev}
            onClick={() => setWeekStart(addUtcDaysToYmd(weekStart, -7))}
            className="rounded-[var(--radius-control)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--ink-secondary)] hover:bg-[var(--muted)] disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next week"
            disabled={!canNext}
            onClick={() => setWeekStart(addUtcDaysToYmd(weekStart, 7))}
            className="rounded-[var(--radius-control)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--ink-secondary)] hover:bg-[var(--muted)] disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>

      <div
        className="mt-2 grid grid-cols-7 gap-1 sm:gap-2"
        role="radiogroup"
        aria-label={datesLabel}
      >
        {visibleDays.map((day) => {
          const hasSlots = day.slots.length > 0;
          const selected = hasSlots && day.date === selectedDay?.date;
          const isToday = day.date === todayDate;
          const dayNum = day.date.slice(8, 10);
          return (
            <button
              key={day.date}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={
                isToday
                  ? `${day.label}, today`
                  : hasSlots
                    ? day.label
                    : `${day.label}, unavailable`
              }
              disabled={!hasSlots}
              onClick={() => {
                if (!hasSlots) return;
                setSelectedDate(day.date);
                if (!day.slots.some((s) => s.startIso === value)) {
                  onChange("");
                }
              }}
              className={`min-w-0 rounded-[var(--radius-control)] px-1 py-2 text-center focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none sm:px-2 ${
                selected
                  ? "bg-[var(--accent)] text-white"
                  : isToday
                    ? "border-2 border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : hasSlots
                      ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
                      : "border border-transparent text-[var(--ink-tertiary)] opacity-40"
              }`}
            >
              <span className="block text-[10px] tracking-wide uppercase">
                {isToday ? "Today" : weekdayShort(day.label)}
              </span>
              <span className="block text-sm font-semibold tabular-nums">
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      {selectedDay && selectedDay.slots.length > 0 ? (
        <div
          className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
          role="radiogroup"
          aria-label={timesLabel}
        >
          {selectedDay.slots.map((slot) => (
            <button
              key={slot.startIso}
              type="button"
              role="radio"
              aria-checked={value === slot.startIso}
              onClick={() => onChange(slot.startIso)}
              className={`bf-row-hover rounded-[var(--radius-control)] px-2 py-2 text-left text-xs focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none sm:text-sm ${
                value === slot.startIso
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--muted)]"
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--ink-secondary)]">
          No open times this week. Try the next week.
        </p>
      )}
    </div>
  );
}
