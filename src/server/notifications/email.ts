import "server-only";

import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

type BookingEmailInput = {
  to: string;
  organizationName: string;
  clientName: string;
  serviceName: string;
  resourceName: string;
  startAt: Date;
  timezone: string;
  bookingId: string;
};

function getResend() {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

function whenLabel(startAt: Date, timezone: string) {
  return formatInTimeZone(startAt, timezone, "EEEE, MMM d · HH:mm zzz");
}

export async function sendBookingConfirmation(input: BookingEmailInput) {
  const resend = getResend();
  const when = whenLabel(input.startAt, input.timezone);
  const subject = `Confirmed: ${input.serviceName} at ${input.organizationName}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5;">
      <h1 style="font-size: 20px;">You're booked</h1>
      <p>Hi ${input.clientName},</p>
      <p>Your appointment is confirmed.</p>
      <ul>
        <li><strong>Service:</strong> ${input.serviceName}</li>
        <li><strong>With:</strong> ${input.resourceName}</li>
        <li><strong>When:</strong> ${when}</li>
        <li><strong>Business:</strong> ${input.organizationName}</li>
      </ul>
      <p style="color:#666;font-size:12px;">Booking ID: ${input.bookingId}</p>
    </div>
  `;

  if (!resend) {
    logger.info(
      { to: input.to, subject, bookingId: input.bookingId },
      "RESEND_API_KEY missing — skipping confirmation email",
    );
    return { skipped: true as const };
  }

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.to,
    subject,
    html,
  });

  return { skipped: false as const };
}

export async function sendBookingCancellation(input: BookingEmailInput) {
  const resend = getResend();
  const when = whenLabel(input.startAt, input.timezone);
  const subject = `Cancelled: ${input.serviceName} at ${input.organizationName}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5;">
      <h1 style="font-size: 20px;">Appointment cancelled</h1>
      <p>Hi ${input.clientName},</p>
      <p>Your appointment has been cancelled.</p>
      <ul>
        <li><strong>Service:</strong> ${input.serviceName}</li>
        <li><strong>With:</strong> ${input.resourceName}</li>
        <li><strong>When:</strong> ${when}</li>
      </ul>
    </div>
  `;

  if (!resend) {
    logger.info(
      { to: input.to, subject, bookingId: input.bookingId },
      "RESEND_API_KEY missing — skipping cancellation email",
    );
    return { skipped: true as const };
  }

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.to,
    subject,
    html,
  });

  return { skipped: false as const };
}
