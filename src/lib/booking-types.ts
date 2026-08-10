/** Shared shapes for booking creation, rescheduling, and public slot browsing. */

export type BookingStatusLabel =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

/** Safe public payload for /book/manage/[manageToken] (no internal IDs). */
export type PublicManagedBookingView = {
  organizationName: string;
  logoUrl: string | null;
  brandPrimary: string | null;
  serviceName: string;
  resourceName: string;
  locationName: string | null;
  startIso: string;
  endIso: string;
  timezone: string;
  status: BookingStatusLabel;
  canCancel: boolean;
  canReschedule: boolean;
  durationMin: number;
  whenLabel: string;
  bookAgainHref: string | null;
};

export type BookingSummary = {
  organizationName: string;
  serviceName: string;
  resourceName: string;
  locationName: string;
  clientName: string;
  clientEmail: string | null;
  startAtIso: string;
  endAtIso: string;
  timezone: string;
};

export type BookingCreateResult = {
  bookingId: string;
  manageToken: string;
  manageUrl: string;
  isFirstBooking?: boolean;
  summary: BookingSummary;
};

export type PublicSlot = {
  startIso: string;
  label: string;
};

export type PublicSlotDay = {
  /** Local calendar date YYYY-MM-DD in the resource's location timezone */
  date: string;
  /** e.g. "Thu Jul 23" */
  label: string;
  slots: PublicSlot[];
};

export type PublicSlotsPayload = {
  timezone: string;
  days: PublicSlotDay[];
};
