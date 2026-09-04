/**
 * Deterministic presentation catalog for the isolated demo org.
 * Never used by E2E (`e2e-test-shop`) or live customer orgs (`bookflow`, `pgym`).
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { BookingSource, BookingStatus } from "../generated/prisma/client";
import { isoDayInZone, shiftIsoDay } from "../server/analytics/period";

import { TEST_ORG_SLUG } from "./constants";

export const DEMO_ORG_SLUG = "bookflow-demo";
export const DEMO_ORG_NAME = "Atelier Hale";
export const DEMO_LOCATION_NAME = "Shoreditch studio";
export const DEMO_TIMEZONE = "Europe/London";
export const DEMO_OWNER_EMAIL = "owner.atelier-hale@example.test";
export const DEMO_OWNER_CLERK_ID = "demo-seed-owner-atelier-hale";
export const DEMO_MANAGE_TOKEN_PREFIX = "demotoken";
export const DEMO_EMAIL_DOMAIN = "example.test";

export const DEMO_FORBIDDEN_SLUGS = [
  TEST_ORG_SLUG,
  "bookflow",
  "pgym",
] as const;

export type DemoServiceKey =
  | "fade"
  | "haircut"
  | "combo"
  | "beard"
  | "kids"
  | "restyle";

export type DemoStaffKey = "james" | "adam" | "omar" | "daniel";

export const DEMO_SERVICES: Array<{
  key: DemoServiceKey;
  name: string;
  durationMin: number;
  bufferAfter: number;
  priceCents: number;
  currency: "GBP";
}> = [
  {
    key: "fade",
    name: "Skin Fade",
    durationMin: 30,
    bufferAfter: 5,
    priceCents: 2500,
    currency: "GBP",
  },
  {
    key: "haircut",
    name: "Haircut",
    durationMin: 30,
    bufferAfter: 5,
    priceCents: 2200,
    currency: "GBP",
  },
  {
    key: "combo",
    name: "Haircut & Beard",
    durationMin: 45,
    bufferAfter: 5,
    priceCents: 3200,
    currency: "GBP",
  },
  {
    key: "beard",
    name: "Beard Trim",
    durationMin: 20,
    bufferAfter: 0,
    priceCents: 1500,
    currency: "GBP",
  },
  {
    key: "kids",
    name: "Kids Haircut",
    durationMin: 30,
    bufferAfter: 5,
    priceCents: 1800,
    currency: "GBP",
  },
  {
    key: "restyle",
    name: "Full Restyle",
    durationMin: 60,
    bufferAfter: 10,
    priceCents: 3500,
    currency: "GBP",
  },
];

/** weekday: 0 Sun … 6 Sat (matches availability engine). */
export const DEMO_STAFF: Array<{
  key: DemoStaffKey;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  clerkUserId: string;
  weekdays: number[];
  startMin: number;
  endMin: number;
  services: DemoServiceKey[];
}> = [
  {
    key: "james",
    name: "James Carter",
    firstName: "James",
    lastName: "Carter",
    email: "james.carter@example.test",
    clerkUserId: "demo-seed-staff-james-carter",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    startMin: 9 * 60,
    endMin: 18 * 60,
    services: ["fade", "haircut", "combo", "beard", "kids", "restyle"],
  },
  {
    key: "adam",
    name: "Adam Lewis",
    firstName: "Adam",
    lastName: "Lewis",
    email: "adam.lewis@example.test",
    clerkUserId: "demo-seed-staff-adam-lewis",
    weekdays: [0, 2, 3, 4, 5, 6],
    startMin: 9 * 60,
    endMin: 18 * 60,
    services: ["fade", "haircut", "combo", "beard", "kids"],
  },
  {
    key: "omar",
    name: "Omar Hassan",
    firstName: "Omar",
    lastName: "Hassan",
    email: "omar.hassan@example.test",
    clerkUserId: "demo-seed-staff-omar-hassan",
    weekdays: [1, 2, 3, 4, 5],
    startMin: 9 * 60,
    endMin: 17 * 60,
    services: ["fade", "haircut", "combo", "beard", "restyle"],
  },
  {
    key: "daniel",
    name: "Daniel Khan",
    firstName: "Daniel",
    lastName: "Khan",
    email: "daniel.khan@example.test",
    clerkUserId: "demo-seed-staff-daniel-khan",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    startMin: 10 * 60,
    endMin: 18 * 60,
    services: ["fade", "haircut", "combo", "beard", "kids"],
  },
];

export const DEMO_CLIENTS: Array<{
  key: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  tags: string[];
  marketingOptIn: boolean;
  createdDaysAgo: number;
}> = [
  {
    key: "alex",
    name: "Alex Morgan",
    email: "alex.morgan@example.test",
    phone: "+447700900201",
    notes: "Usually books a skin fade with James. Prefers afternoons.",
    tags: ["regular", "fade"],
    marketingOptIn: true,
    createdDaysAgo: 180,
  },
  {
    key: "theo",
    name: "Theo Bennett",
    email: "theo.bennett@example.test",
    phone: "+447700900202",
    notes: "Usually books Haircut & Beard with Adam.",
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 120,
  },
  {
    key: "sofia",
    name: "Sofia Khan",
    email: "sofia.khan@example.test",
    phone: "+447700900102",
    notes: null,
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 150,
  },
  {
    key: "lewis",
    name: "Lewis Grant",
    email: "lewis.grant@example.test",
    phone: "+447700900103",
    notes: "New client — first visit last week.",
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 6,
  },
  {
    key: "amira",
    name: "Amira Hassan",
    email: "amira.hassan@example.test",
    phone: null,
    tags: ["colour"],
    notes: null,
    marketingOptIn: true,
    createdDaysAgo: 40,
  },
  {
    key: "callum",
    name: "Callum Wright",
    email: "callum.wright@example.test",
    phone: "+447700900104",
    notes: null,
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 18,
  },
  {
    key: "priya",
    name: "Priya Shah",
    email: "priya.shah@example.test",
    phone: "+447700900105",
    notes: "Usually books James.",
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 90,
  },
  {
    key: "noah",
    name: "Noah Patel",
    email: "noah.patel@example.test",
    phone: null,
    notes: null,
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 11,
  },
  {
    key: "elena",
    name: "Elena Rossi",
    email: "elena.rossi@example.test",
    phone: "+447700900106",
    notes: null,
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 120,
  },
  {
    key: "marcus",
    name: "Marcus Reid",
    email: "marcus.reid@example.test",
    phone: "+447700900203",
    notes: null,
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 75,
  },
  {
    key: "ivy",
    name: "Ivy Chen",
    email: "ivy.chen@example.test",
    phone: "+447700900204",
    notes: "Books kids cuts for her son.",
    tags: ["family"],
    marketingOptIn: true,
    createdDaysAgo: 60,
  },
  {
    key: "rafael",
    name: "Rafael Costa",
    email: "rafael.costa@example.test",
    phone: "+447700900205",
    notes: null,
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 28,
  },
  {
    key: "hana",
    name: "Hana Ali",
    email: "hana.ali@example.test",
    phone: null,
    notes: null,
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 95,
  },
  {
    key: "ben",
    name: "Ben Walsh",
    email: "ben.walsh@example.test",
    phone: "+447700900206",
    notes: null,
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 22,
  },
  {
    key: "lucia",
    name: "Lucia Moretti",
    email: "lucia.moretti@example.test",
    phone: "+447700900207",
    notes: null,
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 110,
  },
  {
    key: "kai",
    name: "Kai Thompson",
    email: "kai.thompson@example.test",
    phone: "+447700900208",
    notes: null,
    tags: [],
    marketingOptIn: true,
    createdDaysAgo: 16,
  },
  {
    key: "nia",
    name: "Nia Brooks",
    email: "nia.brooks@example.test",
    phone: null,
    notes: null,
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 88,
  },
  {
    key: "owen",
    name: "Owen Fraser",
    email: "owen.fraser@example.test",
    phone: "+447700900209",
    notes: null,
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 9,
  },
  {
    key: "zara",
    name: "Zara Malik",
    email: "zara.malik@example.test",
    phone: "+447700900210",
    notes: null,
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 140,
  },
  {
    key: "finn",
    name: "Finn O'Neill",
    email: "finn.oneill@example.test",
    phone: "+447700900211",
    notes: null,
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 5,
  },
];

export type DemoBookingPlan = {
  token: string;
  clientKey: string;
  staffKey: DemoStaffKey;
  serviceKey: DemoServiceKey;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
  source: BookingSource;
  cancelReason: string | null;
};

export function assertDemoSlugIsolated(slug: string) {
  if ((DEMO_FORBIDDEN_SLUGS as readonly string[]).includes(slug)) {
    throw new Error(`Refusing to seed protected slug ${slug}`);
  }
  if (slug !== DEMO_ORG_SLUG) {
    throw new Error(`Demo seed only targets ${DEMO_ORG_SLUG}, got ${slug}`);
  }
}

export function weekdaySun0(isoDay: string, timeZone: string): number {
  const noon = fromZonedTime(`${isoDay}T12:00:00`, timeZone);
  const isoDow = Number(formatInTimeZone(noon, timeZone, "i"));
  return isoDow % 7;
}

export function zonedAt(
  isoDay: string,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return fromZonedTime(`${isoDay}T${hh}:${mm}:00`, timeZone);
}

export function serviceByKey(key: DemoServiceKey) {
  const service = DEMO_SERVICES.find((s) => s.key === key);
  if (!service) throw new Error(`Unknown demo service ${key}`);
  return service;
}

export function staffByKey(key: DemoStaffKey) {
  const staff = DEMO_STAFF.find((s) => s.key === key);
  if (!staff) throw new Error(`Unknown demo staff ${key}`);
  return staff;
}

function staffWorks(staffKey: DemoStaffKey, weekday: number) {
  return staffByKey(staffKey).weekdays.includes(weekday);
}

function endsAt(startAt: Date, serviceKey: DemoServiceKey) {
  return new Date(
    startAt.getTime() + serviceByKey(serviceKey).durationMin * 60_000,
  );
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** Occupied window includes service buffer so chairs are not back-to-back. */
export function occupiedUntil(startAt: Date, serviceKey: DemoServiceKey) {
  const service = serviceByKey(serviceKey);
  return new Date(
    startAt.getTime() + (service.durationMin + service.bufferAfter) * 60_000,
  );
}

function withinStaffHours(
  staffKey: DemoStaffKey,
  hour: number,
  minute: number,
  serviceKey: DemoServiceKey,
) {
  const staff = staffByKey(staffKey);
  const startMin = hour * 60 + minute;
  const endMin = startMin + serviceByKey(serviceKey).durationMin;
  return startMin >= staff.startMin && endMin <= staff.endMin;
}

export function assertNoDemoOverlaps(plan: DemoBookingPlan[]) {
  const blocking = plan.filter(
    (b) =>
      b.status === "PENDING" ||
      b.status === "CONFIRMED" ||
      b.status === "COMPLETED" ||
      b.status === "NO_SHOW",
  );
  for (let i = 0; i < blocking.length; i++) {
    for (let j = i + 1; j < blocking.length; j++) {
      const a = blocking[i]!;
      const b = blocking[j]!;
      if (a.staffKey !== b.staffKey) continue;
      if (
        rangesOverlap(
          a.startAt,
          occupiedUntil(a.startAt, a.serviceKey),
          b.startAt,
          occupiedUntil(b.startAt, b.serviceKey),
        )
      ) {
        throw new Error(
          `Demo overlap on ${a.staffKey}: ${a.token} vs ${b.token}`,
        );
      }
    }
  }
}

function cancelReasonFor(status: BookingStatus): string | null {
  if (status === "CANCELLED") return "Client asked to move the appointment";
  if (status === "NO_SHOW") return "Did not arrive";
  return null;
}

type Rel = {
  day: number;
  hour: number;
  minute: number;
  staff: DemoStaffKey;
  service: DemoServiceKey;
  client: string;
  status: BookingStatus;
  source: BookingSource;
};

function rel(
  day: number,
  hour: number,
  minute: number,
  staff: DemoStaffKey,
  service: DemoServiceKey,
  client: string,
  status: BookingStatus,
  source: BookingSource = "PUBLIC",
): Rel {
  return { day, hour, minute, staff, service, client, status, source };
}

/** Regulars with a clear visit pattern for CRM / AI summaries. */
function regularHistory(): Rel[] {
  return [
    rel(-90, 14, 0, "james", "fade", "alex", "COMPLETED"),
    rel(-72, 14, 30, "james", "fade", "alex", "COMPLETED"),
    rel(-54, 15, 0, "james", "fade", "alex", "COMPLETED"),
    rel(-36, 14, 0, "james", "fade", "alex", "COMPLETED"),
    rel(-18, 14, 30, "james", "fade", "alex", "COMPLETED"),
    rel(-42, 11, 0, "adam", "combo", "theo", "COMPLETED"),
    rel(-24, 11, 0, "adam", "combo", "theo", "COMPLETED"),
    rel(-8, 11, 0, "adam", "combo", "theo", "COMPLETED"),
  ];
}

/**
 * Relative schedule around "today" in the shop timezone.
 * day 0 = today, negative = past, positive = upcoming.
 */
const RELATIVE_BOOKINGS: Rel[] = [
  ...regularHistory(),
  rel(-40, 10, 0, "omar", "haircut", "sofia", "COMPLETED"),
  rel(-38, 13, 0, "daniel", "combo", "elena", "COMPLETED", "DASHBOARD"),
  rel(-35, 10, 30, "james", "kids", "ivy", "COMPLETED"),
  rel(-33, 15, 0, "adam", "beard", "amira", "NO_SHOW"),
  rel(-32, 12, 0, "james", "restyle", "priya", "CANCELLED"),
  rel(-28, 9, 30, "omar", "fade", "marcus", "COMPLETED"),
  rel(-26, 16, 0, "daniel", "haircut", "ben", "COMPLETED"),
  rel(-21, 10, 0, "james", "combo", "lucia", "COMPLETED"),
  rel(-20, 14, 0, "adam", "haircut", "hana", "COMPLETED"),
  rel(-16, 11, 30, "omar", "beard", "zara", "COMPLETED"),
  rel(-15, 15, 30, "daniel", "kids", "ivy", "COMPLETED"),
  rel(-13, 10, 0, "james", "haircut", "nia", "COMPLETED"),
  rel(-12, 11, 0, "adam", "fade", "sofia", "COMPLETED"),
  rel(-12, 14, 0, "omar", "combo", "elena", "COMPLETED", "DASHBOARD"),
  rel(-11, 10, 30, "james", "restyle", "priya", "NO_SHOW"),
  rel(-11, 15, 0, "daniel", "beard", "amira", "COMPLETED"),
  rel(-10, 9, 30, "omar", "haircut", "marcus", "COMPLETED"),
  rel(-9, 11, 30, "adam", "beard", "sofia", "COMPLETED"),
  rel(-8, 14, 0, "james", "fade", "elena", "NO_SHOW"),
  rel(-7, 10, 0, "daniel", "combo", "priya", "COMPLETED", "DASHBOARD"),
  rel(-7, 12, 0, "omar", "restyle", "amira", "COMPLETED"),
  rel(-6, 9, 30, "james", "haircut", "callum", "CANCELLED"),
  rel(-6, 11, 0, "adam", "fade", "noah", "COMPLETED"),
  rel(-5, 10, 0, "omar", "haircut", "kai", "COMPLETED"),
  rel(-5, 15, 0, "daniel", "haircut", "lewis", "COMPLETED"),
  rel(-4, 13, 0, "james", "beard", "sofia", "NO_SHOW"),
  rel(-4, 16, 0, "adam", "combo", "elena", "COMPLETED", "DASHBOARD"),
  rel(-3, 10, 30, "james", "fade", "priya", "COMPLETED"),
  rel(-3, 12, 0, "omar", "beard", "amira", "CANCELLED"),
  rel(-3, 14, 0, "daniel", "kids", "ivy", "COMPLETED"),
  rel(-2, 11, 0, "james", "haircut", "rafael", "COMPLETED"),
  rel(-2, 14, 30, "adam", "combo", "lucia", "COMPLETED"),
  rel(-1, 9, 30, "omar", "combo", "elena", "COMPLETED", "DASHBOARD"),
  rel(-1, 11, 30, "daniel", "fade", "noah", "COMPLETED"),
  rel(-1, 15, 0, "james", "beard", "callum", "CANCELLED"),
  rel(1, 10, 0, "james", "fade", "alex", "CONFIRMED"),
  rel(1, 11, 30, "adam", "haircut", "amira", "CONFIRMED"),
  rel(1, 14, 0, "omar", "combo", "marcus", "CONFIRMED"),
  rel(2, 13, 0, "james", "fade", "priya", "CONFIRMED"),
  rel(2, 15, 0, "adam", "beard", "sofia", "CONFIRMED", "DASHBOARD"),
  rel(2, 10, 30, "daniel", "kids", "ivy", "CONFIRMED"),
  rel(3, 10, 30, "james", "combo", "elena", "CONFIRMED"),
  rel(3, 15, 30, "omar", "beard", "callum", "PENDING"),
  rel(3, 12, 0, "daniel", "haircut", "ben", "CONFIRMED"),
  rel(4, 12, 0, "adam", "combo", "theo", "CONFIRMED"),
  rel(4, 16, 0, "james", "haircut", "noah", "CONFIRMED"),
  rel(5, 11, 0, "daniel", "fade", "hana", "CONFIRMED"),
  rel(5, 14, 30, "james", "restyle", "zara", "PENDING"),
];

const TODAY_SLOTS: Array<
  Omit<Rel, "day" | "status" | "source"> & { source?: BookingSource }
> = [
  { hour: 9, minute: 0, staff: "james", service: "fade", client: "alex" },
  { hour: 9, minute: 45, staff: "adam", service: "combo", client: "theo" },
  { hour: 10, minute: 30, staff: "omar", service: "haircut", client: "marcus" },
  { hour: 11, minute: 15, staff: "james", service: "beard", client: "callum" },
  { hour: 11, minute: 45, staff: "james", service: "haircut", client: "priya" },
  { hour: 13, minute: 0, staff: "daniel", service: "haircut", client: "ben" },
  { hour: 14, minute: 0, staff: "adam", service: "fade", client: "sofia" },
  { hour: 15, minute: 0, staff: "omar", service: "restyle", client: "amira" },
  { hour: 15, minute: 30, staff: "daniel", service: "combo", client: "rafael" },
  { hour: 16, minute: 30, staff: "james", service: "haircut", client: "lewis" },
];

function todayFloorRows(today: string, now: Date, timeZone: string): Rel[] {
  const weekday = weekdaySun0(today, timeZone);
  const nowMin =
    Number(formatInTimeZone(now, timeZone, "H")) * 60 +
    Number(formatInTimeZone(now, timeZone, "m"));

  return TODAY_SLOTS.flatMap((slot) => {
    if (!staffWorks(slot.staff, weekday)) return [];
    if (!withinStaffHours(slot.staff, slot.hour, slot.minute, slot.service)) {
      return [];
    }
    const endMin =
      slot.hour * 60 + slot.minute + serviceByKey(slot.service).durationMin;
    return [
      {
        day: 0,
        hour: slot.hour,
        minute: slot.minute,
        staff: slot.staff,
        service: slot.service,
        client: slot.client,
        status: nowMin >= endMin ? "COMPLETED" : "CONFIRMED",
        source: slot.source ?? "PUBLIC",
      } satisfies Rel,
    ];
  });
}

export function planDemoBookings(
  now = new Date(),
  timeZone = DEMO_TIMEZONE,
): DemoBookingPlan[] {
  const today = isoDayInZone(now, timeZone);
  const relRows = [
    ...RELATIVE_BOOKINGS,
    ...todayFloorRows(today, now, timeZone),
  ];
  const plan: DemoBookingPlan[] = [];
  let tokenIndex = 1;

  for (const row of relRows) {
    const isoDay = shiftIsoDay(today, row.day);
    const weekday = weekdaySun0(isoDay, timeZone);
    if (!staffWorks(row.staff, weekday)) continue;
    if (!staffByKey(row.staff).services.includes(row.service)) {
      throw new Error(
        `Demo plan assigned ${row.service} to ${row.staff}, who does not offer it`,
      );
    }
    if (!withinStaffHours(row.staff, row.hour, row.minute, row.service)) {
      continue;
    }
    const startAt = zonedAt(isoDay, row.hour, row.minute, timeZone);
    plan.push({
      token: `${DEMO_MANAGE_TOKEN_PREFIX}${String(tokenIndex).padStart(2, "0")}`,
      clientKey: row.client,
      staffKey: row.staff,
      serviceKey: row.service,
      startAt,
      endAt: endsAt(startAt, row.service),
      status: row.status,
      source: row.source,
      cancelReason: cancelReasonFor(row.status),
    });
    tokenIndex += 1;
  }

  assertNoDemoOverlaps(plan);
  return plan;
}

export function demoClientCreatedAt(
  clientKey: string,
  now: Date,
  timeZone = DEMO_TIMEZONE,
) {
  const client = DEMO_CLIENTS.find((c) => c.key === clientKey);
  if (!client) throw new Error(`Unknown demo client ${clientKey}`);
  const today = isoDayInZone(now, timeZone);
  return zonedAt(shiftIsoDay(today, -client.createdDaysAgo), 10, 0, timeZone);
}
