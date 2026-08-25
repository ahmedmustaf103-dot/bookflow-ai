"use client";

import { useEffect, useMemo, useState } from "react";

import type { PublicSlotDay } from "@/lib/booking-types";
import { addUtcDaysToYmd } from "@/lib/booking-window";

function monthLabel(ymd: string) {
  const [year, month] = ymd.split("-").map(Number);
  if (!year || !month) return ymd;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
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
  const firstDate = days[0]?.date ?? "";
  const [weekStart, setWeekStart] = useState(firstDate);
  const [selectedDate, setSelectedDate] = useState(firstDate);

  useEffect(() => {
    const nextFirst = days[0]?.date ?? "";
    setWeekStart(nextFirst);
    setSelectedDate(nextFirst);
  }, [days]);

  const visibleDays = useMemo(() => {
    if (!weekStart) return [];
    const weekEnd = addUtcDaysToYmd(weekStart, 6);
    return days.filter((d) => d.date >= weekStart && d.date <= weekEnd);
  }, [days, weekStart]);

  const selectedDay =
    days.find((d) => d.date === selectedDate) ?? visibleDays[0] ?? days[0];

  const canPrev = days.some((d) => d.date < weekStart);
  const nextWeek = weekStart ? addUtcDaysToYmd(weekStart, 7) : "";
  const canNext = Boolean(
    nextWeek && days.some((d) => d.date >= nextWeek),
  );

  if (days.length === 0) {
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
        className="mt-2 flex gap-2 overflow-x-auto pb-1"
        role="radiogroup"
        aria-label={datesLabel}
      >
        {visibleDays.map((day) => {
          const selected = day.date === selectedDay?.date;
          const weekday = day.label.split(" ")[0];
          const dayNum = day.date.slice(8, 10);
          return (
            <button
              key={day.date}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setSelectedDate(day.date);
                if (!day.slots.some((s) => s.startIso === value)) {
                  onChange("");
                }
              }}
              className={`min-w-[3.25rem] shrink-0 rounded-[var(--radius-control)] px-2 py-2 text-center focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                selected
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--muted)]"
              }`}
            >
              <span className="block text-[10px] uppercase tracking-wide">
                {weekday}
              </span>
              <span className="block text-sm font-semibold tabular-nums">
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      {visibleDays.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--ink-secondary)]">
          No open times this week. Try the next week.
        </p>
      ) : (
        <div
          className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
          role="radiogroup"
          aria-label={timesLabel}
        >
          {(selectedDay?.slots ?? []).map((slot) => (
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
      )}
    </div>
  );
}
