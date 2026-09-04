import "server-only";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { UserFacingError } from "@/lib/action-errors";
import { formatMoney } from "@/lib/client-tags";
import type { MessageIntent } from "@/server/ai/constants";
import { matchDemoAssistantIntent } from "@/server/ai/demo-intent";
import {
  getCustomerInsights,
  getOrgAnalytics,
  getStaffInsights,
  getTopServices,
} from "@/server/analytics/org";
import { isoDayInZone, shiftIsoDay } from "@/server/analytics/period";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import { db } from "@/server/db";

export type DemoAiResult = {
  text: string;
  usage: { tokensIn: number; tokensOut: number };
};

const EMPTY_USAGE = { tokensIn: 0, tokensOut: 0 };

export { matchDemoAssistantIntent };
export type { DemoAssistantIntent } from "@/server/ai/demo-intent";

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

async function loadClientBrief(organizationId: string, clientId: string) {
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      bookings: {
        orderBy: { startAt: "desc" },
        take: 20,
        include: {
          service: true,
          resource: true,
          location: true,
        },
      },
    },
  });
  if (!client) throw new UserFacingError("Customer not found");
  return client;
}

export async function demoClientSummary(input: {
  organizationId: string;
  clientId: string;
  now?: Date;
}): Promise<DemoAiResult> {
  const now = input.now ?? new Date();
  const client = await loadClientBrief(input.organizationId, input.clientId);
  const completed = client.bookings.filter((b) => b.status === "COMPLETED");
  const upcoming = client.bookings
    .filter(
      (b) =>
        b.startAt.getTime() >= now.getTime() &&
        (b.status === "PENDING" || b.status === "CONFIRMED"),
    )
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const lastCompleted = completed[0] ?? null;
  const serviceCounts = new Map<string, number>();
  const resourceCounts = new Map<string, number>();
  for (const booking of completed) {
    serviceCounts.set(
      booking.service.name,
      (serviceCounts.get(booking.service.name) ?? 0) + 1,
    );
    resourceCounts.set(
      booking.resource.name,
      (resourceCounts.get(booking.resource.name) ?? 0) + 1,
    );
  }
  const favoriteService =
    [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const favoriteStaff =
    [...resourceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const lastAgo = lastCompleted
    ? daysBetween(lastCompleted.startAt, now)
    : null;
  const tz = lastCompleted?.location.timezone ?? "Europe/London";

  const visitLine =
    completed.length === 0
      ? `${client.name} is on the books but has no completed visits yet.`
      : `${client.name} has visited ${completed.length} time${completed.length === 1 ? "" : "s"}.`;
  const usualLine =
    favoriteService && favoriteStaff
      ? `Usually books ${favoriteService} with ${favoriteStaff}.`
      : favoriteService
        ? `Usually books ${favoriteService}.`
        : "";
  const lastLine =
    lastCompleted && lastAgo != null
      ? `Last visit was ${lastAgo} day${lastAgo === 1 ? "" : "s"} ago (${formatInTimeZone(lastCompleted.startAt, tz, "d MMM")} · ${lastCompleted.service.name}).`
      : "";
  const nextLine = upcoming[0]
    ? `Next appointment: ${formatInTimeZone(upcoming[0].startAt, upcoming[0].location.timezone, "EEE d MMM · HH:mm")} · ${upcoming[0].service.name}.`
    : "No upcoming appointment on the calendar.";

  const text = [
    "Example AI insight",
    "",
    visitLine,
    usualLine,
    lastLine,
    nextLine,
    client.notes ? `Note on file: ${client.notes}` : "",
    upcoming[0]
      ? "Suggested next step: confirm they still want their usual service."
      : "Suggested next step: send a friendly rebooking message.",
  ]
    .filter(Boolean)
    .join("\n");

  return { text, usage: EMPTY_USAGE };
}

export async function demoMessageDraft(input: {
  organizationId: string;
  intent: MessageIntent;
  clientId?: string;
}): Promise<DemoAiResult> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { name: true },
  });
  let firstName = "there";
  let usual = "your usual appointment";
  if (input.clientId) {
    const client = await db.client.findFirst({
      where: { id: input.clientId, organizationId: input.organizationId },
      include: {
        bookings: {
          where: { status: "COMPLETED" },
          orderBy: { startAt: "desc" },
          take: 8,
          include: { service: true },
        },
      },
    });
    if (client) {
      firstName = client.name.split(" ")[0] ?? client.name;
      const counts = new Map<string, number>();
      for (const booking of client.bookings) {
        counts.set(
          booking.service.name,
          (counts.get(booking.service.name) ?? 0) + 1,
        );
      }
      usual =
        [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? usual;
    }
  }

  const bodies: Record<MessageIntent, string> = {
    reminder: `Hi ${firstName}, just a reminder of your upcoming appointment at ${org.name}. Reply if you need to change the time and we’ll find another slot.`,
    win_back: `Hi ${firstName}, it’s been a few weeks since your last visit. Would you like to book your usual ${usual}?`,
    thank_you: `Hi ${firstName}, thanks for coming in. We hope you liked your ${usual}. Book again whenever you’re ready.`,
    reschedule: `Hi ${firstName}, we can move your appointment. Reply with a day that suits you and we’ll check what’s free.`,
    review_request: `Hi ${firstName}, thanks for visiting ${org.name}. If you have a minute, a short review helps other people find us: [REVIEW_LINK]`,
    follow_up: `Hi ${firstName}, hope the ${usual} settled well. Want us to hold your usual time again in a few weeks?`,
  };

  const subjects: Record<MessageIntent, string> = {
    reminder: `Your appointment at ${org.name}`,
    win_back: `Time for your usual ${usual}?`,
    thank_you: `Thanks for visiting ${org.name}`,
    reschedule: `We can move your appointment`,
    review_request: `How was your visit?`,
    follow_up: `How did it go?`,
  };

  const text = `Subject: ${subjects[input.intent]}\nBody:\n${bodies[input.intent]}`;
  return { text, usage: EMPTY_USAGE };
}

export async function demoInsightDigest(input: {
  organizationId: string;
  now?: Date;
}): Promise<DemoAiResult> {
  const now = input.now ?? new Date();
  const [analytics, topServices, staff, customers, org] = await Promise.all([
    getOrgAnalytics(input.organizationId, 30, now),
    getTopServices(input.organizationId, 30, 5, now),
    getStaffInsights(input.organizationId, 7, 6, now),
    getCustomerInsights(input.organizationId, 30, now),
    db.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: { name: true, timezoneDefault: true },
    }),
  ]);

  const topService = topServices[0];
  const topStaff = staff[0];
  const tz = org.timezoneDefault;
  const today = isoDayInZone(now, tz);
  const todayCount = await countBookingsOnDay(input.organizationId, today, tz);

  const lines = [
    "Example AI insight",
    "",
    `${todayCount} appointment${todayCount === 1 ? "" : "s"} today.`,
    `${analytics.upcoming} upcoming on the books.`,
    `${customers.repeatBookers} returning customers in the last 30 days.`,
    topService
      ? `${topService.name} is your most booked service this month (${topService.count} bookings).`
      : "",
    topStaff
      ? `${topStaff.name} has the most bookings this week (${topStaff.bookings}).`
      : "",
    `Completed in the last 30 days: ${analytics.bookingsCompleted}. Estimated take: ${formatMoney(analytics.estimatedRevenueCents, analytics.currency)}.`,
    analytics.bookingsNoShow > 0
      ? `${analytics.bookingsNoShow} no-shows in that window — worth a reminder before busy days.`
      : "No-shows are low in this window.",
  ];

  return { text: lines.filter(Boolean).join("\n"), usage: EMPTY_USAGE };
}

async function countBookingsOnDay(
  organizationId: string,
  isoDay: string,
  timeZone: string,
) {
  const start = fromZonedMidnight(isoDay, timeZone);
  const end = fromZonedMidnight(shiftIsoDay(isoDay, 1), timeZone);
  return db.booking.count({
    where: {
      organizationId,
      startAt: { gte: start, lt: end },
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
    },
  });
}

function fromZonedMidnight(isoDay: string, timeZone: string) {
  return fromZonedTime(`${isoDay}T00:00:00`, timeZone);
}

export async function demoBookingAssistant(input: {
  organizationId: string;
  message: string;
  now?: Date;
}): Promise<DemoAiResult> {
  const now = input.now ?? new Date();
  const intent = matchDemoAssistantIntent(input.message);
  const org = await db.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { timezoneDefault: true },
  });
  const tz = org.timezoneDefault;
  const today = isoDayInZone(now, tz);

  if (intent.kind === "today_count") {
    const count = await countBookingsOnDay(input.organizationId, today, tz);
    return {
      text: `You have ${count} appointment${count === 1 ? "" : "s"} today.`,
      usage: EMPTY_USAGE,
    };
  }

  if (intent.kind === "popular_service") {
    const top = await getTopServices(input.organizationId, 7, 1, now);
    const name = top[0]?.name ?? "Haircut";
    return {
      text: `${name} is your most booked service this week.`,
      usage: EMPTY_USAGE,
    };
  }

  if (intent.kind === "staff_leader") {
    const staff = await getStaffInsights(input.organizationId, 7, 1, now);
    const lead = staff[0];
    return {
      text: lead
        ? `${lead.name} has the highest number of bookings this week.`
        : "Bookings are spread evenly across the team this week.",
      usage: EMPTY_USAGE,
    };
  }

  if (intent.kind === "due_return") {
    const customers = await getCustomerInsights(input.organizationId, 30, now);
    return {
      text: `${customers.repeatBookers} customers have visited more than once. A few regulars are due a return visit — open Customers and look for people without an upcoming booking.`,
      usage: EMPTY_USAGE,
    };
  }

  if (intent.kind === "quiet") {
    return {
      text: "Tuesday and Wednesday afternoons usually have the most free chairs. Mornings fill first.",
      usage: EMPTY_USAGE,
    };
  }

  if (intent.kind === "staff_week") {
    const resource = await db.resource.findFirst({
      where: {
        organizationId: input.organizationId,
        name: { contains: intent.staffHint, mode: "insensitive" },
        isActive: true,
      },
    });
    const service = await db.service.findFirst({
      where: {
        organizationId: input.organizationId,
        isActive: true,
        name: { equals: "Haircut" },
      },
    });
    if (!resource || !service) {
      return {
        text: `${capitalize(intent.staffHint)} is on the team, but I couldn’t check times in this sample.`,
        usage: EMPTY_USAGE,
      };
    }
    const slots = await getSlotsForServiceResource({
      organizationId: input.organizationId,
      serviceId: service.id,
      resourceId: resource.id,
      fromDate: today,
      toDate: shiftIsoDay(today, 6),
      requireLink: true,
    });
    const open = slots.filter((s) => s.start.getTime() > now.getTime()).slice(0, 2);
    if (open.length === 0) {
      return {
        text: `${resource.name} looks fully booked for a Haircut this week in the sample diary.`,
        usage: EMPTY_USAGE,
      };
    }
    const labels = open.map((s) =>
      formatInTimeZone(s.start, tz, "EEEE 'at' h:mm a"),
    );
    return {
      text:
        labels.length === 1
          ? `${resource.name} has availability on ${labels[0]}.`
          : `${resource.name} has availability on ${labels[0]} and ${labels[1]}.`,
      usage: EMPTY_USAGE,
    };
  }

  const count = await countBookingsOnDay(input.organizationId, today, tz);
  const top = await getTopServices(input.organizationId, 7, 1, now);
  return {
    text: `This is a sample answer from the diary. You have ${count} appointments today. ${top[0] ? `${top[0].name} is the most booked service this week.` : ""} Ask about today’s count, a popular service, or a time with James this week.`.trim(),
    usage: EMPTY_USAGE,
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
