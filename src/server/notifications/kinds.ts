/** Outbox message kinds used by the automation layer. */
export const OUTBOX_KINDS = {
  BOOKING_CONFIRMATION: "BOOKING_CONFIRMATION",
  BOOKING_CANCELLATION: "BOOKING_CANCELLATION",
  BOOKING_RESCHEDULED: "BOOKING_RESCHEDULED",
  BOOKING_REMINDER: "BOOKING_REMINDER",
  FOLLOW_UP: "FOLLOW_UP",
  REVIEW_REQUEST: "REVIEW_REQUEST",
  REBOOKING_REMINDER: "REBOOKING_REMINDER",
} as const;

export type OutboxKind = (typeof OUTBOX_KINDS)[keyof typeof OUTBOX_KINDS];

/** Cancel these when a booking is cancelled. */
export const CANCEL_ON_BOOKING_CANCEL: OutboxKind[] = [
  OUTBOX_KINDS.BOOKING_REMINDER,
  OUTBOX_KINDS.BOOKING_RESCHEDULED,
  OUTBOX_KINDS.FOLLOW_UP,
  OUTBOX_KINDS.REVIEW_REQUEST,
  OUTBOX_KINDS.REBOOKING_REMINDER,
];

/** Kinds that should flush promptly after enqueue (scheduledFor ≈ now). */
export const IMMEDIATE_OUTBOX_KINDS: OutboxKind[] = [
  OUTBOX_KINDS.BOOKING_CONFIRMATION,
  OUTBOX_KINDS.BOOKING_CANCELLATION,
  OUTBOX_KINDS.BOOKING_RESCHEDULED,
];

export function reminderDedupeKey(
  bookingId: string,
  channel: "EMAIL" | "SMS",
  startAt: Date,
) {
  return `${OUTBOX_KINDS.BOOKING_REMINDER}:${bookingId}:${channel}:${startAt.toISOString()}`;
}

/** Include startAt so each reschedule can notify once for that time. */
export function rescheduleDedupeKey(bookingId: string, startAt: Date) {
  return `${OUTBOX_KINDS.BOOKING_RESCHEDULED}:${bookingId}:EMAIL:${startAt.toISOString()}`;
}

export function bookingDedupeKey(
  kind: OutboxKind,
  bookingId: string,
  channel: "EMAIL" | "SMS" = "EMAIL",
) {
  return `${kind}:${bookingId}:${channel}`;
}
