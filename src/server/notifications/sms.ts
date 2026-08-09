import "server-only";

import twilio from "twilio";
import { formatInTimeZone } from "date-fns-tz";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/phone";

export type BookingSmsInput = {
  to: string;
  organizationName: string;
  clientName: string;
  serviceName: string;
  resourceName: string;
  startAt: Date | string;
  timezone: string;
  bookingId: string;
};

function getTwilio() {
  if (
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN ||
    !env.TWILIO_FROM_NUMBER
  ) {
    return null;
  }
  return {
    client: twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN),
    from: env.TWILIO_FROM_NUMBER,
  };
}

function whenLabel(startAt: Date | string, timezone: string) {
  const date = startAt instanceof Date ? startAt : new Date(startAt);
  return formatInTimeZone(date, timezone, "EEE MMM d · HH:mm zzz");
}

export { normalizePhone };

export async function sendBookingReminderSms(input: BookingSmsInput) {
  const tw = getTwilio();
  const when = whenLabel(input.startAt, input.timezone);
  const body = `Reminder: ${input.serviceName} with ${input.resourceName} at ${input.organizationName} on ${when}. Reply STOP to opt out.`;

  if (!tw) {
    logger.info(
      { to: input.to, bookingId: input.bookingId },
      "Twilio not configured — skipping reminder SMS",
    );
    return { skipped: true as const };
  }

  await tw.client.messages.create({
    to: input.to,
    from: tw.from,
    body,
  });

  return { skipped: false as const };
}
