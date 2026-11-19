/**
 * Support contact details shown to customers, sellers and delivery partners.
 * Read ONLY from Admin → Settings (support email/phone first, then the general contact ones).
 * Nothing is built in: when a value is not configured it is an empty string, and pages hide it.
 */
const FALLBACK_EMAIL = "";
const FALLBACK_PHONE = "";

type ContactSettings = {
  supportEmail?: string;
  contactEmail?: string;
  supportPhone?: string;
  contactPhone?: string;
  businessName?: string;
  appName?: string;
} | null | undefined;

/**
 * Formats a stored phone number for display and for tel: links. Handles numbers saved with or
 * without the country code ("98XXXXXXXX", "+91 98XXX XXXXX", "9198XXXXXXXX"), so the page never
 * shows "+91 +91 …".
 */
export function formatIndianPhone(raw?: string | null): { display: string; tel: string } {
  const value = String(raw || "").trim();
  let digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) {
    return { display: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`, tel: `+91${digits}` };
  }
  return { display: value, tel: value.replace(/[^\d+]/g, "") };
}

export function getSupportContact(settings: ContactSettings) {
  const email = String(settings?.supportEmail || settings?.contactEmail || FALLBACK_EMAIL).trim();
  const phone = formatIndianPhone(settings?.supportPhone || settings?.contactPhone || FALLBACK_PHONE);
  return {
    email,
    phoneDisplay: phone.display,
    phoneTel: phone.tel,
    businessName: String(settings?.businessName || settings?.appName || "Olovely Total Suvidha").trim(),
  };
}

/** Joins only the configured parts, e.g. joinContactParts("Email: a@b.c", "" ) → "Email: a@b.c". */
export function joinContactParts(parts: Array<string | false | null | undefined>, separator = " | "): string {
  return parts.filter((part): part is string => typeof part === "string" && part.trim() !== "").join(separator);
}
