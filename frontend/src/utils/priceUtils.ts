import { Product } from '../types/domain';

export interface CalculatedPrice {
  displayPrice: number;
  mrp: number;
  discount: number;
  hasDiscount: boolean;
}

export const calculateProductPrice = (
  product: any,
  variationSelector?: number | string,
  isWholesale?: boolean,
  wholesalePrice?: number
): CalculatedPrice => {
  if (!product) {
    return {
      displayPrice: 0,
      mrp: 0,
      discount: 0,
      hasDiscount: false
    };
  }

  let variation;
  if (typeof variationSelector === 'number') {
    variation = product.variations?.[variationSelector];
  } else if (typeof variationSelector === 'string') {
    variation = product.variations?.find((v: any) => (v._id === variationSelector || v.id === variationSelector));
  }

  // Fallback to first variation if no specific one selected/found but variations exist
  // Only if variationSelector was NOT provided (undefined).
  if (!variation && product.variations?.length > 0 && variationSelector === undefined) {
    variation = product.variations[0];
  }

  let displayPrice = (variation?.discPrice && variation.discPrice > 0)
    ? variation.discPrice
    : (product.discPrice && product.discPrice > 0)
    ? product.discPrice
    : (variation?.price || product.price || 0);

  // Authoritative wholesale pricing overrides retail pricing when item is wholesale
  if (isWholesale) {
    const wp = Number(wholesalePrice) || Number(product.wholesalePrice);
    if (wp > 0) {
      displayPrice = wp;
    }
  }

  const mrp = variation?.price || product.mrp || product.compareAtPrice || product.price || 0;

  const hasDiscount = mrp > displayPrice;
  const discount = hasDiscount ? Math.round(((mrp - displayPrice) / mrp) * 100) : 0;

  return {
    displayPrice,
    mrp,
    discount,
    hasDiscount
  };
};
