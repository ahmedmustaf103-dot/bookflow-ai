/**
 * Normalize phone numbers to E.164 for SMS providers.
 * Supports UK mobiles (07… / +44…) and common US formats.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Keep leading +; strip spaces, dashes, brackets
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.includes("+")) {
    digits = `+${digits.replace(/\+/g, "").replace(/\D/g, "")}`;
  } else {
    digits = digits.replace(/\D/g, "");
  }

  if (!digits || digits === "+") return null;

  // Already E.164
  if (digits.startsWith("+")) {
    const rest = digits.slice(1);
    if (rest.length < 8 || rest.length > 15) return null;
    // +4407… → +447… (common paste mistake)
    if (rest.startsWith("440") && rest.length >= 12) {
      return `+44${rest.slice(3)}`;
    }
    return `+${rest}`;
  }

  // UK mobile: 07xxxxxxxxx (11 digits) → +447xxxxxxxxx
  if (digits.length === 11 && digits.startsWith("07")) {
    return `+44${digits.slice(1)}`;
  }

  // UK without leading 0: 7xxxxxxxxx (10 digits) → +447…
  if (digits.length === 10 && digits.startsWith("7")) {
    return `+44${digits}`;
  }

  // US/Canada 10-digit
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // US with leading 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Fallback: if long enough, assume already country-coded without +
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}
