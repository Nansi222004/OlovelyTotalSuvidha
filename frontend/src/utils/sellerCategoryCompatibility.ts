export type SellerVendorType = 'QUICK_COMMERCE' | 'ECOMMERCE' | 'HYBRID';
export type CommerceChannel = 'QUICK_COMMERCE' | 'ECOMMERCE';

export interface ChannelAwareCategory {
  commerceChannels?: CommerceChannel[];
}

export function isCategoryCompatibleWithVendorType(
  category: ChannelAwareCategory,
  vendorType: SellerVendorType
): boolean {
  const channels = category.commerceChannels || [];
  if (vendorType === 'HYBRID') {
    return channels.includes('QUICK_COMMERCE') || channels.includes('ECOMMERCE');
  }
  return channels.includes(vendorType);
}

export function filterCategoriesForVendorType<T extends ChannelAwareCategory>(
  categories: readonly T[],
  vendorType: SellerVendorType
): T[] {
  return categories.filter((category) => isCategoryCompatibleWithVendorType(category, vendorType));
}
