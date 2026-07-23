/**
 * Pure availability / slot generation engine.
 * All instants in UTC. Local calendar math uses IANA timezones.
 */

export type WeeklyRule = {
  weekday: number; // 0 Sun … 6 Sat
  startMin: number;
  endMin: number;
};

export type DayOverride = {
  /** Local calendar date YYYY-MM-DD */
  date: string;
  isClosed: boolean;
  startMin?: number | null;
  endMin?: number | null;
};

export type BusyInterval = {
  start: Date;
  end: Date;
};

export type Slot = {
  start: Date;
  end: Date;
};

export type GenerateSlotsInput = {
  timezone: string;
  /** Inclusive local start date YYYY-MM-DD */
  fromDate: string;
  /** Inclusive local end date YYYY-MM-DD */
  toDate: string;
  durationMin: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  slotIntervalMin?: number;
  rules: WeeklyRule[];
  overrides?: DayOverride[];
  busy?: BusyInterval[];
  /** Do not return slots starting before this instant */
  now?: Date;
};

function assertValidMinutes(startMin: number, endMin: number) {
  if (
    startMin < 0 ||
    endMin > 1440 ||
    startMin >= endMin ||
    !Number.isInteger(startMin) ||
    !Number.isInteger(endMin)
  ) {
    throw new Error(`Invalid minutes range: ${startMin}-${endMin}`);
  }
}

/** Format a UTC Date as YYYY-MM-DD in the given IANA timezone. */
export function formatDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Convert a local calendar date + minutes-from-midnight to a UTC Date.
 */
export function zonedLocalToUtc(
  date: string,
  minutes: number,
  timeZone: string,
): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const wall = `${date}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;

  // Iterate to resolve DST: guess UTC, read back local, adjust.
  let guess = new Date(`${wall}Z`);
  for (let i = 0; i < 3; i++) {
    const asLocal = formatDateTimeParts(guess, timeZone);
    const desired = parseWallParts(wall);
    const deltaMin =
      (desired.y - asLocal.y) * 525600 +
      (desired.mo - asLocal.mo) * 43800 +
      (desired.d - asLocal.d) * 1440 +
      (desired.h - asLocal.h) * 60 +
      (desired.mi - asLocal.mi);

    if (deltaMin === 0) break;
    guess = new Date(guess.getTime() + deltaMin * 60_000);
  }

  return guess;
}

function formatDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return {
    y: get("year"),
    mo: get("month"),
    d: get("day"),
    h: get("hour"),
    mi: get("minute"),
  };
}

function parseWallParts(wall: string) {
  const [date, time] = wall.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return { y, mo, d, h, mi };
}

function weekdayInTimeZone(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

function eachLocalDate(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T12:00:00Z`);
  const end = new Date(`${toDate}T12:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function windowsForDay(
  date: string,
  weekday: number,
  rules: WeeklyRule[],
  override: DayOverride | undefined,
): Array<{ startMin: number; endMin: number }> {
  if (override?.isClosed) {
    return [];
  }

  if (
    override &&
    override.startMin != null &&
    override.endMin != null &&
    !override.isClosed
  ) {
    assertValidMinutes(override.startMin, override.endMin);
    return [{ startMin: override.startMin, endMin: override.endMin }];
  }

  return rules
    .filter((r) => r.weekday === weekday)
    .map((r) => {
      assertValidMinutes(r.startMin, r.endMin);
      return { startMin: r.startMin, endMin: r.endMin };
    });
}

/**
 * Generate bookable start times for a single resource + service.
 * Slot occupies [start, start+duration). Buffers expand the busy footprint
 * of existing bookings and the required free window around a candidate.
 */
export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const {
    timezone,
    fromDate,
    toDate,
    durationMin,
    bufferBeforeMin = 0,
    bufferAfterMin = 0,
    slotIntervalMin = durationMin,
    rules,
    overrides = [],
    busy = [],
    now = new Date(),
  } = input;

  if (durationMin <= 0 || slotIntervalMin <= 0) {
    throw new Error("durationMin and slotIntervalMin must be positive");
  }

  const overrideByDate = new Map(overrides.map((o) => [o.date, o]));
  const slots: Slot[] = [];

  for (const date of eachLocalDate(fromDate, toDate)) {
    const noonUtc = zonedLocalToUtc(date, 12 * 60, timezone);
    const weekday = weekdayInTimeZone(noonUtc, timezone);
    const windows = windowsForDay(
      date,
      weekday,
      rules,
      overrideByDate.get(date),
    );

    for (const window of windows) {
      for (
        let startMin = window.startMin;
        startMin + durationMin <= window.endMin;
        startMin += slotIntervalMin
      ) {
        const start = zonedLocalToUtc(date, startMin, timezone);
        const end = new Date(start.getTime() + durationMin * 60_000);

        if (start < now) continue;

        const blockStart = new Date(start.getTime() - bufferBeforeMin * 60_000);
        const blockEnd = new Date(end.getTime() + bufferAfterMin * 60_000);

        const conflict = busy.some((b) =>
          overlaps(blockStart, blockEnd, b.start, b.end),
        );

        if (!conflict) {
          slots.push({ start, end });
        }
      }
    }
  }

  return slots;
}
