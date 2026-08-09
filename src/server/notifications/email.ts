import "server-only";

import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type BookingEmailInput = {
  to: string;
  organizationName: string;
  clientName: string;
  serviceName: string;
  resourceName: string;
  /** ISO string or Date — normalized before send */
  startAt: Date | string;
  timezone: string;
  bookingId: string;
  manageUrl?: string | null;
  bookUrl?: string | null;
  reviewUrl?: string | null;
};

export type SendEmailResult = { skipped: boolean };

function getResend() {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function whenLabel(startAt: Date | string, timezone: string) {
  return formatInTimeZone(asDate(startAt), timezone, "EEEE, MMM d · HH:mm zzz");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shell(title: string, body: string) {
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111; max-width: 560px;">
      <h1 style="font-size: 20px; margin: 0 0 12px;">${escapeHtml(title)}</h1>
      ${body}
    </div>
  `;
}

function appointmentList(input: BookingEmailInput) {
  const when = whenLabel(input.startAt, input.timezone);
  return `
    <ul style="padding-left: 18px;">
      <li><strong>Service:</strong> ${escapeHtml(input.serviceName)}</li>
      <li><strong>With:</strong> ${escapeHtml(input.resourceName)}</li>
      <li><strong>When:</strong> ${escapeHtml(when)}</li>
      <li><strong>Business:</strong> ${escapeHtml(input.organizationName)}</li>
    </ul>
  `;
}

function manageLink(input: BookingEmailInput) {
  if (!input.manageUrl) return "";
  return `<p><a href="${escapeHtml(input.manageUrl)}">Manage or reschedule this appointment</a></p>`;
}

function bookLink(input: BookingEmailInput, label: string) {
  if (!input.bookUrl) return "";
  return `<p><a href="${escapeHtml(input.bookUrl)}">${escapeHtml(label)}</a></p>`;
}

async function deliver(input: {
  to: string;
  subject: string;
  html: string;
  bookingId: string;
  kind: string;
}): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    logger.info(
      { to: input.to, subject: input.subject, bookingId: input.bookingId, kind: input.kind },
      "RESEND_API_KEY missing — skipping email",
    );
    return { skipped: true };
  }

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: input.html,
    headers: {
      "X-Entity-Ref-ID": `${input.kind}:${input.bookingId}`,
    },
  });

  return { skipped: false };
}

export async function sendBookingConfirmation(
  input: BookingEmailInput,
): Promise<SendEmailResult> {
  const subject = `Confirmed: ${input.serviceName} at ${input.organizationName}`;
  const html = shell(
    "You're booked",
    `
      <p>Hi ${escapeHtml(input.clientName)},</p>
      <p>Your appointment is confirmed.</p>
      ${appointmentList(input)}
      ${manageLink(input)}
      <p style="color:#666;font-size:12px;">Booking ID: ${escapeHtml(input.bookingId)}</p>
    `,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "BOOKING_CONFIRMATION",
  });
}

export async function sendBookingReminder(
  input: BookingEmailInput,
): Promise<SendEmailResult> {
  const subject = `Reminder: ${input.serviceName} at ${input.organizationName}`;
  const html = shell(
    "Appointment reminder",
    `
      <p>Hi ${escapeHtml(input.clientName)},</p>
      <p>This is a friendly reminder about your upcoming appointment.</p>
      ${appointmentList(input)}
      ${manageLink(input)}
      <p style="color:#666;font-size:12px;">Booking ID: ${escapeHtml(input.bookingId)}</p>
    `,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "BOOKING_REMINDER",
  });
}

export async function sendBookingCancellation(
  input: BookingEmailInput,
): Promise<SendEmailResult> {
  const subject = `Cancelled: ${input.serviceName} at ${input.organizationName}`;
  const html = shell(
    "Appointment cancelled",
    `
      <p>Hi ${escapeHtml(input.clientName)},</p>
      <p>Your appointment has been cancelled.</p>
      ${appointmentList(input)}
      ${bookLink(input, "Book a new appointment")}
    `,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "BOOKING_CANCELLATION",
  });
}

export async function sendFollowUpEmail(
  input: BookingEmailInput,
): Promise<SendEmailResult> {
  const subject = `Thanks for visiting ${input.organizationName}`;
  const html = shell(
    "Thanks for coming in",
    `
      <p>Hi ${escapeHtml(input.clientName)},</p>
      <p>Thank you for your recent ${escapeHtml(input.serviceName)} appointment. We hope everything went well.</p>
      <p>If you have any questions, just reply to this email — we're happy to help.</p>
      ${bookLink(input, "Book your next visit")}
    `,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "FOLLOW_UP",
  });
}

export async function sendReviewRequestEmail(
  input: BookingEmailInput,
): Promise<SendEmailResult> {
  const subject = `How was your visit to ${input.organizationName}?`;
  const reviewCta = input.reviewUrl
    ? `<p>If you have a moment, we'd love a quick review:</p><p><a href="${escapeHtml(input.reviewUrl)}">Leave a review</a></p>`
    : `<p>If you have a moment, we'd love a quick review — reply to this email with your feedback.</p>`;
  const html = shell(
    "How did we do?",
    `
      <p>Hi ${escapeHtml(input.clientName)},</p>
      <p>Thanks again for choosing us for your ${escapeHtml(input.serviceName)}.</p>
      ${reviewCta}
      <p style="color:#666;font-size:12px;">No pressure — only if you want to share.</p>
    `,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "REVIEW_REQUEST",
  });
}

export async function sendRebookingReminderEmail(
  input: BookingEmailInput,
): Promise<SendEmailResult> {
  const subject = `Time to book your next ${input.serviceName}?`;
  const html = shell(
    "Ready for your next visit?",
    `
      <p>Hi ${escapeHtml(input.clientName)},</p>
      <p>It's been a little while since your last ${escapeHtml(input.serviceName)} at ${escapeHtml(input.organizationName)}.</p>
      <p>We'd love to see you again — pick a time that works for you.</p>
      ${bookLink(input, "Book now")}
    `,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "REBOOKING_REMINDER",
  });
}
