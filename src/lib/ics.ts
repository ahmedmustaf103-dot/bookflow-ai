/** Minimal RFC 5545 (iCalendar) builder for a single booking event. */

export type IcsMethod = "PUBLISH" | "REQUEST" | "CANCEL";
export type IcsStatus = "CONFIRMED" | "CANCELLED" | "TENTATIVE";

export type BookingIcsInput = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  /** Monotonic update counter so calendar clients replace the prior event. */
  sequence?: number;
  method?: IcsMethod;
  status?: IcsStatus;
  organizerName?: string;
  organizerEmail?: string;
};

export function bookingIcsUid(bookingId: string): string {
  return `${bookingId}@bookflow.ai`;
}

function toIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** Escape text per RFC 5545 §3.3.11 (comma, semicolon, backslash, newline). */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long lines to <=75 octets per RFC 5545 §3.1, with a leading space continuation. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join("\r\n ");
}

export function buildConfirmationIcs(input: {
  bookingId: string;
  organizationName: string;
  serviceName: string;
  resourceName: string;
  startAt: Date;
  endAt: Date;
  manageUrl?: string | null;
  location?: string | null;
  sequence?: number;
  method?: IcsMethod;
  status?: IcsStatus;
}): string {
  const method = input.method ?? "REQUEST";
  const cancelled = method === "CANCEL" || input.status === "CANCELLED";
  return buildBookingIcs({
    uid: bookingIcsUid(input.bookingId),
    title: cancelled
      ? `Cancelled: ${input.serviceName} at ${input.organizationName}`
      : `${input.serviceName} at ${input.organizationName}`,
    description: [
      `With ${input.resourceName}`,
      input.manageUrl ? `Manage: ${input.manageUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    location: input.location ?? input.organizationName,
    startAt: input.startAt,
    endAt: input.endAt,
    sequence: input.sequence ?? 0,
    method,
    status: cancelled ? "CANCELLED" : (input.status ?? "CONFIRMED"),
    organizerName: input.organizationName,
  });
}

export function buildBookingIcs(input: BookingIcsInput): string {
  const now = toIcsUtc(new Date());
  const method = input.method ?? "REQUEST";
  const status =
    input.status ?? (method === "CANCEL" ? "CANCELLED" : "CONFIRMED");
  const sequence = Number.isFinite(input.sequence)
    ? Math.max(0, Math.floor(input.sequence!))
    : 0;
  const organizerEmail = input.organizerEmail ?? "calendar@bookflow.ai";
  const organizerCn = escapeIcsText(input.organizerName ?? "BookFlow AI");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BookFlow AI//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${status}`,
    `DTSTAMP:${now}`,
    `LAST-MODIFIED:${now}`,
    `DTSTART:${toIcsUtc(input.startAt)}`,
    `DTEND:${toIcsUtc(input.endAt)}`,
    `ORGANIZER;CN=${organizerCn}:mailto:${organizerEmail}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  }
  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Client-only: trigger a browser download of the generated ICS file. */
export function downloadIcsFile(filename: string, icsContent: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
