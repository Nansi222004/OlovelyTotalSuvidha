export type SellerVendorType = "QUICK_COMMERCE" | "ECOMMERCE" | "HYBRID";
export type CommerceChannel = "QUICK_COMMERCE" | "ECOMMERCE";

export interface HeaderCategoryChannelRecord {
  name: string;
  commerceChannels: CommerceChannel[];
}

export function allowedChannelsForVendorType(vendorType: SellerVendorType): CommerceChannel[] {
  if (vendorType === "QUICK_COMMERCE") return ["QUICK_COMMERCE"];
  if (vendorType === "ECOMMERCE") return ["ECOMMERCE"];
  return ["QUICK_COMMERCE", "ECOMMERCE"];
}

export function isCategoryCompatibleWithVendorType(
  vendorType: SellerVendorType,
  commerceChannels: readonly string[] | undefined
): boolean {
  const allowed = new Set(allowedChannelsForVendorType(vendorType));
  return Array.isArray(commerceChannels)
    && commerceChannels.some((channel) => allowed.has(channel as CommerceChannel));
}

export function normalizeSelectedCategoryNames(category: unknown, categories: unknown): string[] {
  const raw = Array.isArray(categories) && categories.length > 0 ? categories : [category];
  return Array.from(new Set(
    raw
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
  ));
}

export function validateSellerCategorySelection(
  vendorType: SellerVendorType,
  selectedCategoryNames: readonly string[],
  availableCategories: readonly HeaderCategoryChannelRecord[]
): { valid: true } | { valid: false; message: string } {
  if (selectedCategoryNames.length === 0) {
    return { valid: false, message: "Please select at least one category" };
  }

  const byName = new Map(availableCategories.map((entry) => [entry.name, entry]));
  for (const selectedName of selectedCategoryNames) {
    const category = byName.get(selectedName);
    if (!category) {
      return { valid: false, message: `Selected category "${selectedName}" is not available.` };
    }
    if (!isCategoryCompatibleWithVendorType(vendorType, category.commerceChannels)) {
      const label = vendorType === "HYBRID" ? "Quick Commerce or Ecommerce" : vendorType.replace("_", " ");
      return {
        valid: false,
        message: `Selected category "${selectedName}" is not compatible with ${label}.`,
      };
    }
  }

  return { valid: true };
}
