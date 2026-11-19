/**
 * Support contact details shown to customers, sellers and delivery partners.
 * Always read from Admin → Settings (support first, then general contact); the built-in values
 * are only a last resort when settings are not loaded.
 */
const FALLBACK_EMAIL = "olovelytotalsuvidha@gmail.com";
const FALLBACK_PHONE = "9601715367";

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
 * without the country code ("9601715367", "+91 96017 15367", "919601715367"), so the page never
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
