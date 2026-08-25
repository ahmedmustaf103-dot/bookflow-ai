import "server-only";

import { after } from "next/server";
import {
  Prisma,
  type OrganizationPlan,
} from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  planAllowsReminders,
  planAllowsSms,
} from "@/server/billing/entitlements";
import {
  sendBookingCancellation,
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingReschedule,
  sendFollowUpEmail,
  sendOwnerNewBookingEmail,
  sendRebookingReminderEmail,
  sendReviewRequestEmail,
  type BookingEmailInput,
} from "@/server/notifications/email";
import {
  bookingDedupeKey,
  CANCEL_ON_BOOKING_CANCEL,
  IMMEDIATE_OUTBOX_KINDS,
  MARKETING_OUTBOX_KINDS,
  OUTBOX_KINDS,
  OWNER_NOTIFY_ROLES,
  allowsMarketingSend,
  isMarketingOutboxKind,
  ownerNotifyDedupeKey,
  reminderDedupeKey,
  rescheduleDedupeKey,
  uniqueOwnerNotifyEmails,
} from "@/server/notifications/kinds";
import {
  normalizePhone,
  sendBookingReminderSms,
  type BookingSmsInput,
} from "@/server/notifications/sms";
import {
  bookingManageUrl,
  bookingCalendarIcsUrl,
  dashboardAppointmentsUrl,
  publicBookingUrl,
} from "@/lib/booking-urls";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/observability";

export const STALE_PROCESSING_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
/** Retry after hard send failures for time-sensitive kinds. */
export const IMMEDIATE_RETRY_DELAY_MS = 2 * 60 * 1000;
/** Retry after hard send failures for scheduled kinds (reminders, follow-ups). */
export const STANDARD_RETRY_DELAY_MS = 15 * 60 * 1000;
const PROVIDER_MISSING_DELAY_MS = 6 * 60 * 60 * 1000;

export type BookingNotifyContext = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  plan: OrganizationPlan;
  bookingId: string;
  manageToken: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  marketingOptIn?: boolean;
  serviceName: string;
  resourceName: string;
  priceCents?: number | null;
  currency?: string | null;
  reviewUrl?: string | null;
  logoUrl?: string | null;
  brandPrimary?: string | null;
  customDomain?: string | null;
  customDomainStatus?: string | null;
};

export function isImmediateOutboxKind(kind: string): boolean {
  return (IMMEDIATE_OUTBOX_KINDS as string[]).includes(kind);
}

export function retryDelayMsForKind(kind: string): number {
  return isImmediateOutboxKind(kind)
    ? IMMEDIATE_RETRY_DELAY_MS
    : STANDARD_RETRY_DELAY_MS;
}

export function isStaleProcessing(
  updatedAt: Date,
  now = new Date(),
  staleMs = STALE_PROCESSING_MS,
): boolean {
  return updatedAt.getTime() < now.getTime() - staleMs;
}

export function nextRetryAt(
  kind: string,
  now = new Date(),
): Date {
  return new Date(now.getTime() + retryDelayMsForKind(kind));
}

/**
 * Flush due outbox rows after the current request finishes.
 * Keeps booking transactions free of provider I/O while still delivering
 * confirmations/cancellations/reschedules within seconds on Vercel.
 *
 * Safe if called outside a Next.js request (falls back to fire-and-forget).
 */
export function scheduleDueOutboxFlush(reason: string): void {
  const run = async () => {
    try {
      const result = await processDueOutbox(50);
      logger.info({ ...result, reason }, "Outbox flush after enqueue");
    } catch (e) {
      captureException(e, { action: "scheduleDueOutboxFlush", reason });
      logger.error({ err: e, reason }, "Outbox flush failed");
    }
  };

  try {
    after(run);
  } catch {
    void run();
  }
}

function emailPayload(
  ctx: BookingNotifyContext,
  to: string,
  extras?: { icsSequence?: number },
): BookingEmailInput {
  const orgUrl = {
    slug: ctx.organizationSlug,
    customDomain: ctx.customDomain,
    customDomainStatus: ctx.customDomainStatus,
  };
  return {
    to,
    organizationName: ctx.organizationName,
    clientName: ctx.clientName,
    serviceName: ctx.serviceName,
    resourceName: ctx.resourceName,
    startAt: ctx.startAt.toISOString(),
    timezone: ctx.timezone,
    bookingId: ctx.bookingId,
    manageUrl: bookingManageUrl(ctx.manageToken, orgUrl),
    bookUrl: publicBookingUrl(orgUrl),
    calendarIcsUrl: bookingCalendarIcsUrl(ctx.manageToken, orgUrl),
    reviewUrl: ctx.reviewUrl ?? null,
    logoUrl: ctx.logoUrl ?? null,
    brandPrimary: ctx.brandPrimary ?? null,
    priceCents: ctx.priceCents ?? null,
    currency: ctx.currency ?? null,
    dashboardUrl: dashboardAppointmentsUrl(),
    endAt: ctx.endAt.toISOString(),
    icsSequence: extras?.icsSequence ?? 0,
  };
}

async function icsSequenceForBooking(bookingId: string, extra = 0) {
  const reschedules = await db.bookingEvent.count({
    where: { bookingId, type: "RESCHEDULED" },
  });
  return reschedules + extra;
}

async function enqueueRow(row: {
  organizationId: string;
  bookingId: string;
  channel: "EMAIL" | "SMS";
  kind: string;
  dedupeKey: string;
  toAddress: string;
  scheduledFor: Date;
  payload: BookingEmailInput | BookingSmsInput;
}) {
  try {
    await db.notificationOutbox.create({
      data: {
        organizationId: row.organizationId,
        bookingId: row.bookingId,
        channel: row.channel,
        kind: row.kind,
        dedupeKey: row.dedupeKey,
        toAddress: row.toAddress,
        scheduledFor: row.scheduledFor,
        payload: row.payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    // Idempotent: ignore duplicate dedupe keys
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return;
    }
    throw e;
  }
}

/** Confirmation email — due immediately; retries via outbox. */
export async function enqueueBookingConfirmation(ctx: BookingNotifyContext) {
  if (!ctx.clientEmail) return;
  const payload = emailPayload(ctx, ctx.clientEmail);
  await enqueueRow({
    organizationId: ctx.organizationId,
    bookingId: ctx.bookingId,
    channel: "EMAIL",
    kind: OUTBOX_KINDS.BOOKING_CONFIRMATION,
    dedupeKey: bookingDedupeKey(
      OUTBOX_KINDS.BOOKING_CONFIRMATION,
      ctx.bookingId,
    ),
    toAddress: ctx.clientEmail,
    scheduledFor: new Date(),
    payload,
  });
  scheduleDueOutboxFlush("booking_confirmation");
}

/** Shop owner/admin email — transactional, due immediately. */
export async function enqueueOwnerNewBooking(ctx: BookingNotifyContext) {
  const memberships = await db.membership.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      role: { in: [...OWNER_NOTIFY_ROLES] },
    },
    select: { user: { select: { email: true } } },
  });
  const recipients = uniqueOwnerNotifyEmails(
    memberships.map((m) => m.user.email),
  );
  if (recipients.length === 0) {
    logger.info(
      { bookingId: ctx.bookingId, organizationId: ctx.organizationId },
      "Skipped owner new-booking email — no OWNER/ADMIN email",
    );
    return;
  }

  for (const to of recipients) {
    const payload = emailPayload(ctx, to);
    await enqueueRow({
      organizationId: ctx.organizationId,
      bookingId: ctx.bookingId,
      channel: "EMAIL",
      kind: OUTBOX_KINDS.BOOKING_CREATED,
      dedupeKey: ownerNotifyDedupeKey(ctx.bookingId, to),
      toAddress: to,
      scheduledFor: new Date(),
      payload,
    });
  }
  scheduleDueOutboxFlush("booking_created_owner");
}

/** Cancellation email — due immediately. */
export async function enqueueBookingCancellation(ctx: BookingNotifyContext) {
  if (!ctx.clientEmail) return;
  const payload = emailPayload(ctx, ctx.clientEmail, {
    icsSequence: await icsSequenceForBooking(ctx.bookingId, 1),
  });
  await enqueueRow({
    organizationId: ctx.organizationId,
    bookingId: ctx.bookingId,
    channel: "EMAIL",
    kind: OUTBOX_KINDS.BOOKING_CANCELLATION,
    dedupeKey: bookingDedupeKey(
      OUTBOX_KINDS.BOOKING_CANCELLATION,
      ctx.bookingId,
    ),
    toAddress: ctx.clientEmail,
    scheduledFor: new Date(),
    payload,
  });
  scheduleDueOutboxFlush("booking_cancellation");
}

/** Reschedule email — due immediately (new time in payload). */
export async function enqueueBookingReschedule(ctx: BookingNotifyContext) {
  if (!ctx.clientEmail) return;
  const payload = emailPayload(ctx, ctx.clientEmail, {
    icsSequence: await icsSequenceForBooking(ctx.bookingId),
  });
  await enqueueRow({
    organizationId: ctx.organizationId,
    bookingId: ctx.bookingId,
    channel: "EMAIL",
    kind: OUTBOX_KINDS.BOOKING_RESCHEDULED,
    dedupeKey: rescheduleDedupeKey(ctx.bookingId, ctx.startAt),
    toAddress: ctx.clientEmail,
    scheduledFor: new Date(),
    payload,
  });
  scheduleDueOutboxFlush("booking_reschedule");
}

export async function enqueueBookingReminder(input: {
  organizationId: string;
  bookingId: string;
  startAt: Date;
  reminderHoursBefore: number;
  plan: OrganizationPlan;
  organizationName: string;
  organizationSlug: string;
  manageToken: string;
  clientName: string;
  serviceName: string;
  resourceName: string;
  timezone: string;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  brandPrimary?: string | null;
  customDomain?: string | null;
  customDomainStatus?: string | null;
  reviewUrl?: string | null;
}) {
  const scheduledFor = new Date(
    input.startAt.getTime() - input.reminderHoursBefore * 60 * 60 * 1000,
  );
  if (scheduledFor.getTime() <= Date.now()) return;

  const ctx: BookingNotifyContext = {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    organizationSlug: input.organizationSlug,
    plan: input.plan,
    bookingId: input.bookingId,
    manageToken: input.manageToken,
    startAt: input.startAt,
    endAt: input.startAt,
    timezone: input.timezone,
    clientName: input.clientName,
    clientEmail: input.email,
    clientPhone: input.phone,
    serviceName: input.serviceName,
    resourceName: input.resourceName,
    logoUrl: input.logoUrl,
    brandPrimary: input.brandPrimary,
    customDomain: input.customDomain,
    customDomainStatus: input.customDomainStatus,
    reviewUrl: input.reviewUrl,
  };

  if (planAllowsReminders(input.plan) && input.email) {
    await enqueueRow({
      organizationId: input.organizationId,
      bookingId: input.bookingId,
      channel: "EMAIL",
      kind: OUTBOX_KINDS.BOOKING_REMINDER,
      dedupeKey: reminderDedupeKey(input.bookingId, "EMAIL", input.startAt),
      toAddress: input.email,
      scheduledFor,
      payload: emailPayload(ctx, input.email),
    });
  }

  const phone = normalizePhone(input.phone);
  if (planAllowsSms(input.plan) && phone) {
    const smsPayload: BookingSmsInput = {
      to: phone,
      organizationName: input.organizationName,
      clientName: input.clientName,
      serviceName: input.serviceName,
      resourceName: input.resourceName,
      startAt: input.startAt.toISOString(),
      timezone: input.timezone,
      bookingId: input.bookingId,
    };
    await enqueueRow({
      organizationId: input.organizationId,
      bookingId: input.bookingId,
      channel: "SMS",
      kind: OUTBOX_KINDS.BOOKING_REMINDER,
      dedupeKey: reminderDedupeKey(input.bookingId, "SMS", input.startAt),
      toAddress: phone,
      scheduledFor,
      payload: smsPayload,
    });
  }
}

/** Post-visit: follow-up, review request, rebooking nudge (marketing). */
export async function enqueuePostVisitAutomation(input: {
  ctx: BookingNotifyContext;
  followUpEnabled: boolean;
  followUpHoursAfter: number;
  reviewRequestEnabled: boolean;
  reviewRequestHoursAfter: number;
  rebookingEnabled: boolean;
  rebookingDaysAfter: number;
}) {
  const { ctx } = input;
  if (!ctx.clientEmail) return;

  // Central consent gate — do not enqueue marketing rows when opted out.
  if (!allowsMarketingSend(ctx.marketingOptIn)) {
    logger.info(
      { bookingId: ctx.bookingId, organizationId: ctx.organizationId },
      "Skipped post-visit marketing enqueue (marketingOptIn=false)",
    );
    return;
  }

  const payload = emailPayload(ctx, ctx.clientEmail);
  // Schedule from visit end (or now if marked complete early).
  const base = Math.max(ctx.endAt.getTime(), Date.now());

  if (input.followUpEnabled) {
    await enqueueRow({
      organizationId: ctx.organizationId,
      bookingId: ctx.bookingId,
      channel: "EMAIL",
      kind: OUTBOX_KINDS.FOLLOW_UP,
      dedupeKey: bookingDedupeKey(OUTBOX_KINDS.FOLLOW_UP, ctx.bookingId),
      toAddress: ctx.clientEmail,
      scheduledFor: new Date(base + input.followUpHoursAfter * 60 * 60 * 1000),
      payload,
    });
  }

  if (input.reviewRequestEnabled) {
    await enqueueRow({
      organizationId: ctx.organizationId,
      bookingId: ctx.bookingId,
      channel: "EMAIL",
      kind: OUTBOX_KINDS.REVIEW_REQUEST,
      dedupeKey: bookingDedupeKey(OUTBOX_KINDS.REVIEW_REQUEST, ctx.bookingId),
      toAddress: ctx.clientEmail,
      scheduledFor: new Date(
        base + input.reviewRequestHoursAfter * 60 * 60 * 1000,
      ),
      payload,
    });
  }

  // Rebooking nudge after a completed visit (staff can disable in settings).
  if (input.rebookingEnabled) {
    await enqueueRow({
      organizationId: ctx.organizationId,
      bookingId: ctx.bookingId,
      channel: "EMAIL",
      kind: OUTBOX_KINDS.REBOOKING_REMINDER,
      dedupeKey: bookingDedupeKey(
        OUTBOX_KINDS.REBOOKING_REMINDER,
        ctx.bookingId,
      ),
      toAddress: ctx.clientEmail,
      scheduledFor: new Date(
        base + input.rebookingDaysAfter * 24 * 60 * 60 * 1000,
      ),
      payload,
    });
  }
}

export async function cancelRemindersForBooking(bookingId: string) {
  await db.notificationOutbox.updateMany({
    where: {
      bookingId,
      kind: OUTBOX_KINDS.BOOKING_REMINDER,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    data: { status: "CANCELLED" },
  });
}

export async function cancelPendingAutomationForBooking(bookingId: string) {
  await db.notificationOutbox.updateMany({
    where: {
      bookingId,
      kind: { in: [...CANCEL_ON_BOOKING_CANCEL] },
      status: { in: ["PENDING", "PROCESSING"] },
    },
    data: { status: "CANCELLED" },
  });
}

/**
 * Cancel undelivered marketing/engagement outbox rows for a client
 * (e.g. after marketingOptIn is turned off).
 */
export async function cancelPendingMarketingForClient(input: {
  organizationId: string;
  clientId: string;
}): Promise<number> {
  const bookings = await db.booking.findMany({
    where: {
      organizationId: input.organizationId,
      clientId: input.clientId,
    },
    select: { id: true },
  });
  if (bookings.length === 0) return 0;

  const result = await db.notificationOutbox.updateMany({
    where: {
      organizationId: input.organizationId,
      bookingId: { in: bookings.map((b) => b.id) },
      kind: { in: [...MARKETING_OUTBOX_KINDS] },
      status: { in: ["PENDING", "PROCESSING"] },
    },
    data: {
      status: "CANCELLED",
      lastError: "Cancelled: marketing opt-out",
    },
  });
  return result.count;
}

/**
 * Live consent check at send time so opt-out after enqueue still blocks delivery.
 * Returns true if the item was cancelled and must not be sent/retried.
 */
export async function suppressMarketingIfOptedOut(item: {
  id: string;
  kind: string;
  organizationId: string;
  bookingId: string | null;
}): Promise<boolean> {
  if (!isMarketingOutboxKind(item.kind)) return false;

  let optedIn = false;
  if (item.bookingId) {
    const booking = await db.booking.findFirst({
      where: {
        id: item.bookingId,
        organizationId: item.organizationId,
      },
      select: { client: { select: { marketingOptIn: true } } },
    });
    optedIn = allowsMarketingSend(booking?.client.marketingOptIn);
  }

  if (optedIn) return false;

  await db.notificationOutbox.update({
    where: { id: item.id },
    data: {
      status: "CANCELLED",
      lastError: "Cancelled: marketing opt-out",
    },
  });
  return true;
}

async function reclaimStaleProcessing(now = new Date()) {
  const cutoff = new Date(now.getTime() - STALE_PROCESSING_MS);
  const result = await db.notificationOutbox.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: cutoff },
    },
    data: { status: "PENDING" },
  });
  return result.count;
}

function normalizePayloadDate<T extends { startAt: Date | string; endAt?: Date | string | null }>(
  payload: T,
): T {
  return {
    ...payload,
    startAt:
      payload.startAt instanceof Date
        ? payload.startAt
        : new Date(payload.startAt),
    endAt: payload.endAt
      ? payload.endAt instanceof Date
        ? payload.endAt
        : new Date(payload.endAt)
      : payload.endAt,
  };
}

async function dispatchOutboxItem(item: {
  kind: string;
  channel: "EMAIL" | "SMS";
  payload: Prisma.JsonValue;
}): Promise<{ skipped: boolean }> {
  if (item.channel === "EMAIL") {
    const payload = normalizePayloadDate(
      item.payload as unknown as BookingEmailInput,
    );
    switch (item.kind) {
      case OUTBOX_KINDS.BOOKING_CONFIRMATION:
        return sendBookingConfirmation(payload);
      case OUTBOX_KINDS.BOOKING_CREATED:
        return sendOwnerNewBookingEmail(payload);
      case OUTBOX_KINDS.BOOKING_REMINDER:
        return sendBookingReminder(payload);
      case OUTBOX_KINDS.BOOKING_CANCELLATION:
        return sendBookingCancellation(payload);
      case OUTBOX_KINDS.BOOKING_RESCHEDULED:
        return sendBookingReschedule(payload);
      case OUTBOX_KINDS.FOLLOW_UP:
        return sendFollowUpEmail(payload);
      case OUTBOX_KINDS.REVIEW_REQUEST:
        return sendReviewRequestEmail(payload);
      case OUTBOX_KINDS.REBOOKING_REMINDER:
        return sendRebookingReminderEmail(payload);
      default:
        throw new Error(`Unsupported outbox kind: ${item.kind}/EMAIL`);
    }
  }

  if (
    item.kind === OUTBOX_KINDS.BOOKING_REMINDER &&
    item.channel === "SMS"
  ) {
    const payload = normalizePayloadDate(
      item.payload as unknown as BookingSmsInput,
    );
    return sendBookingReminderSms(payload);
  }

  throw new Error(`Unsupported outbox kind: ${item.kind}/${item.channel}`);
}

/**
 * Process outbox rows with scheduledFor <= now.
 * Claim is optimistic (PENDING → PROCESSING) so concurrent cron/flush is safe.
 */
export async function processDueOutbox(limit = 50, now = new Date()) {
  const reclaimed = await reclaimStaleProcessing(now);

  const due = await db.notificationOutbox.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  let deferred = 0;
  let skippedClaim = 0;
  let suppressedMarketing = 0;

  for (const item of due) {
    const claimed = await db.notificationOutbox.updateMany({
      where: { id: item.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      skippedClaim += 1;
      continue;
    }

    const attempts = item.attempts + 1;

    try {
      // Re-check consent on every attempt so retries cannot bypass opt-out.
      if (await suppressMarketingIfOptedOut(item)) {
        suppressedMarketing += 1;
        continue;
      }

      const result = await dispatchOutboxItem(item);

      if (result.skipped) {
        // Provider not configured — keep retrying later instead of hard-fail.
        await db.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
            lastError: "Provider not configured — will retry",
            scheduledFor:
              attempts >= MAX_ATTEMPTS
                ? item.scheduledFor
                : new Date(now.getTime() + PROVIDER_MISSING_DELAY_MS),
          },
        });
        if (attempts >= MAX_ATTEMPTS) failed += 1;
        else deferred += 1;
        continue;
      }

      await db.notificationOutbox.update({
        where: { id: item.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      captureException(error, { outboxId: item.id, kind: item.kind });
      logger.error({ err: error, outboxId: item.id }, "Outbox send failed");
      await db.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          lastError: message.slice(0, 500),
          scheduledFor:
            attempts >= MAX_ATTEMPTS
              ? item.scheduledFor
              : nextRetryAt(item.kind, now),
        },
      });
      failed += 1;
    }
  }

  return {
    processed: due.length,
    sent,
    failed,
    deferred,
    skippedClaim,
    reclaimed,
    suppressedMarketing,
  };
}
