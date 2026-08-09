/** Outbox message kinds used by the automation layer. */
export const OUTBOX_KINDS = {
  BOOKING_CONFIRMATION: "BOOKING_CONFIRMATION",
  BOOKING_CANCELLATION: "BOOKING_CANCELLATION",
  BOOKING_REMINDER: "BOOKING_REMINDER",
  FOLLOW_UP: "FOLLOW_UP",
  REVIEW_REQUEST: "REVIEW_REQUEST",
  REBOOKING_REMINDER: "REBOOKING_REMINDER",
} as const;

export type OutboxKind = (typeof OUTBOX_KINDS)[keyof typeof OUTBOX_KINDS];

/** Cancel these when a booking is cancelled. */
export const CANCEL_ON_BOOKING_CANCEL: OutboxKind[] = [
  OUTBOX_KINDS.BOOKING_REMINDER,
  OUTBOX_KINDS.FOLLOW_UP,
  OUTBOX_KINDS.REVIEW_REQUEST,
  OUTBOX_KINDS.REBOOKING_REMINDER,
];

export function reminderDedupeKey(
  bookingId: string,
  channel: "EMAIL" | "SMS",
  startAt: Date,
) {
  return `${OUTBOX_KINDS.BOOKING_REMINDER}:${bookingId}:${channel}:${startAt.toISOString()}`;
}

export function bookingDedupeKey(
  kind: OutboxKind,
  bookingId: string,
  channel: "EMAIL" | "SMS" = "EMAIL",
) {
  return `${kind}:${bookingId}:${channel}`;
}
