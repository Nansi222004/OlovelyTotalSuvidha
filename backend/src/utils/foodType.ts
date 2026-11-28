/**
 * Veg / non-veg mark for food products (FSSAI). Egg counts as NON_VEG.
 * null = not a food item (no mark shown).
 */
export type FoodType = "VEG" | "NON_VEG";

/**
 * Normalise a client value. Returns:
 *   "VEG" / "NON_VEG" for those values (case/format tolerant: "veg", "non-veg", "nonveg", "egg"),
 *   null when explicitly cleared ("", "none", "na", null),
 *   undefined when the field was not sent (leave the stored value unchanged).
 */
export function normalizeFoodType(raw: unknown): FoodType | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const v = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (v === "VEG" || v === "VEGETARIAN") return "VEG";
  if (v === "NON_VEG" || v === "NONVEG" || v === "NON_VEGETARIAN" || v === "EGG") return "NON_VEG";
  return null;
}

/** Applies normalizeFoodType to `data.foodType` in place (removes the key when not sent). */
export function applyFoodType(data: any): void {
  if (!data || typeof data !== "object") return;
  const normalized = normalizeFoodType(data.foodType);
  if (normalized === undefined) delete data.foodType;
  else data.foodType = normalized;
}
