/** Parse staff-editable AI draft text into subject + body. */

export function parseAiDraftMessage(raw: string): {
  subject: string;
  body: string;
} {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { subject: "", body: "" };
  }

  const subjectMatch = text.match(/^Subject:\s*(.+)$/im);
  let body = text;
  if (subjectMatch) {
    body = text
      .replace(/^Subject:\s*.+$/im, "")
      .replace(/^Body:\s*/im, "")
      .trim();
  } else {
    body = text.replace(/^Body:\s*/im, "").trim();
  }

  const subject =
    subjectMatch?.[1]?.trim() ||
    body.split("\n").find((line) => line.trim())?.slice(0, 90) ||
    "";

  return { subject, body };
}

export function draftBodyToHtml(body: string) {
  const escaped = body
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const blocks = escaped.split(/\n{2,}/).filter((p) => p.trim());
  if (blocks.length === 0) return "";
  return blocks
    .map((p) => `<p>${p.replaceAll("\n", "<br/>")}</p>`)
    .join("\n");
}
