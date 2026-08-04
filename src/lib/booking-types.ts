/** Shared shapes for booking creation, rescheduling, and public slot browsing. */

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
