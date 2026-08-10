import "server-only";

import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";

import { normalizeBrandPrimary } from "@/lib/branding";
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
  logoUrl?: string | null;
  brandPrimary?: string | null;
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

function shell(title: string, body: string, input: BookingEmailInput) {
  const brand = normalizeBrandPrimary(input.brandPrimary);
  const logo = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(input.organizationName)}" width="140" style="display:block;max-width:140px;height:auto;margin:0 0 16px;" />`
    : `<p style="margin:0 0 12px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${brand};font-weight:600;">${escapeHtml(input.organizationName)}</p>`;

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111; max-width: 560px;">
      <div style="border-top: 4px solid ${brand}; padding-top: 16px;">
        ${logo}
        <h1 style="font-size: 20px; margin: 0 0 12px;">${escapeHtml(title)}</h1>
        ${body}
        <p style="margin-top: 24px; color: #888; font-size: 11px;">
          Sent on behalf of ${escapeHtml(input.organizationName)}
        </p>
      </div>
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

function ctaLink(href: string, label: string, brand: string) {
  return `<p style="margin: 20px 0 8px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${brand};color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

function manageLink(input: BookingEmailInput) {
  if (!input.manageUrl) return "";
  const brand = normalizeBrandPrimary(input.brandPrimary);
  return ctaLink(input.manageUrl, "Manage appointment", brand);
}

function bookLink(input: BookingEmailInput, label: string) {
  if (!input.bookUrl) return "";
  const brand = normalizeBrandPrimary(input.brandPrimary);
  return ctaLink(input.bookUrl, label, brand);
}

async function deliver(input: {
  to: string;
  subject: string;
  html: string;
  bookingId: string;
  kind: string;
  organizationName: string;
}): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    logger.info(
      { to: input.to, subject: input.subject, bookingId: input.bookingId, kind: input.kind },
      "RESEND_API_KEY missing — skipping email",
    );
    return { skipped: true };
  }

  // Keep verified Resend from-address; show business name as display name when possible.
  const from = env.RESEND_FROM_EMAIL.includes("<")
    ? env.RESEND_FROM_EMAIL.replace(/^[^<]*/, `${input.organizationName} `)
    : `${input.organizationName} <${env.RESEND_FROM_EMAIL}>`;

  await resend.emails.send({
    from,
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
    input,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "BOOKING_CONFIRMATION",
    organizationName: input.organizationName,
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
    input,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "BOOKING_REMINDER",
    organizationName: input.organizationName,
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
    input,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "BOOKING_CANCELLATION",
    organizationName: input.organizationName,
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
    input,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "FOLLOW_UP",
    organizationName: input.organizationName,
  });
}

export async function sendReviewRequestEmail(
  input: BookingEmailInput,
): Promise<SendEmailResult> {
  const subject = `How was your visit to ${input.organizationName}?`;
  const brand = normalizeBrandPrimary(input.brandPrimary);
  const reviewCta = input.reviewUrl
    ? ctaLink(input.reviewUrl, "Leave a review", brand)
    : `<p>If you have a moment, we'd love a quick review — reply to this email with your feedback.</p>`;
  const html = shell(
    "How did we do?",
    `
      <p>Hi ${escapeHtml(input.clientName)},</p>
      <p>Thanks again for choosing us for your ${escapeHtml(input.serviceName)}.</p>
      ${reviewCta}
      <p style="color:#666;font-size:12px;">No pressure — only if you want to share.</p>
    `,
    input,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "REVIEW_REQUEST",
    organizationName: input.organizationName,
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
    input,
  );
  return deliver({
    to: input.to,
    subject,
    html,
    bookingId: input.bookingId,
    kind: "REBOOKING_REMINDER",
    organizationName: input.organizationName,
  });
}
