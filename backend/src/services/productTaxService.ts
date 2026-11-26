import mongoose from "mongoose";
import Tax from "../models/Tax";

/**
 * Single source of truth for a product's GST rate (prices are tax-inclusive).
 *
 * Order of precedence:
 *   1. The product's own tax (Product.tax holds a Tax _id, or a populated Tax) — if that Tax is
 *      Active, its percentage is used AS IS, including 0% (GST-exempt products).
 *   2. Legacy products whose `tax` is a plain text like "5%" / "GST 5%".
 *   3. Otherwise (no tax, or the selected Tax was deleted/deactivated): the default
 *      AppSettings.gstRate when GST is enabled, else 0.
 */
export async function resolveProductTaxRate(
  rawTax: unknown,
  settings: { gstEnabled?: boolean; gstRate?: number } | null | undefined,
  session?: mongoose.ClientSession | null,
): Promise<number> {
  const fallback = settings?.gstEnabled ? Number(settings.gstRate) || 0 : 0;
  if (!rawTax) return fallback;

  if (typeof rawTax === "object" && !(rawTax instanceof mongoose.Types.ObjectId)) {
    const populated = rawTax as { percentage?: unknown; status?: unknown };
    if (Number.isFinite(Number(populated.percentage)) && (populated.status === undefined || populated.status === "Active")) {
      return Number(populated.percentage);
    }
    return fallback;
  }

  const value = String(rawTax).trim();
  if (mongoose.Types.ObjectId.isValid(value) && /^[0-9a-fA-F]{24}$/.test(value)) {
    const query = Tax.findById(value).select("percentage status");
    if (session) query.session(session);
    const taxDoc: any = await query.lean();
    if (taxDoc?.status === "Active" && Number.isFinite(Number(taxDoc.percentage))) {
      return Number(taxDoc.percentage);
    }
    // Selected tax was deleted or deactivated: never parse the id itself as a percentage.
    return fallback;
  }

  // Legacy text value such as "5%", "GST 5%", "5".
  const match = value.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*%?$/);
  if (match) {
    const rate = Number(match[1]);
    if (Number.isFinite(rate) && rate >= 0 && rate <= 100) return rate;
  }
  return fallback;
}
