/**
 * Category Commerce Channel Helper
 * Validates, normalizes, and enforces category-level commerce channel rules.
 */

export type CommerceChannel = 'QUICK_COMMERCE' | 'ECOMMERCE';

export const VALID_CHANNELS: CommerceChannel[] = ['QUICK_COMMERCE', 'ECOMMERCE'];

export interface ValidationResult {
  valid: boolean;
  normalized?: CommerceChannel[];
  error?: string;
}

/**
 * Validates and normalizes category commerceChannels.
 * 
 * Rules:
 * - Must be an array with 1 or 2 items
 * - Items must only be 'QUICK_COMMERCE' or 'ECOMMERCE'
 * - Rejects empty arrays, duplicate values, unknown channels, or malformed inputs
 * - Normalizes BOTH to canonical order: ['QUICK_COMMERCE', 'ECOMMERCE']
 */
export function validateAndNormalizeCommerceChannels(channels: any): ValidationResult {
  if (!channels || !Array.isArray(channels)) {
    return {
      valid: false,
      error: "Commerce channels must be provided as an array of channels",
    };
  }

  if (channels.length === 0) {
    return {
      valid: false,
      error: "Category must specify at least one commerce channel",
    };
  }

  // Check for invalid or unknown channel strings
  for (const ch of channels) {
    if (ch !== 'QUICK_COMMERCE' && ch !== 'ECOMMERCE') {
      return {
        valid: false,
        error: `Invalid commerce channel: "${ch}". Only QUICK_COMMERCE and ECOMMERCE are permitted.`,
      };
    }
  }

  // Check for duplicates
  const unique = Array.from(new Set(channels as CommerceChannel[]));
  if (unique.length !== channels.length) {
    return {
      valid: false,
      error: "Duplicate commerce channels are not permitted in category configuration",
    };
  }

  // Canonical normalization order: QUICK_COMMERCE first, then ECOMMERCE
  const canonicalOrder: CommerceChannel[] = ['QUICK_COMMERCE', 'ECOMMERCE'];
  const normalized = canonicalOrder.filter((c) => unique.includes(c));

  return {
    valid: true,
    normalized,
  };
}

/**
 * Verifies if a given productType is permitted for a category's commerceChannels.
 */
export function isProductTypeAllowedForCategory(
  categoryChannels: CommerceChannel[] | undefined | null,
  productType: 'QUICK_COMMERCE' | 'ECOMMERCE'
): { allowed: boolean; error?: string } {
  // Category commerceChannels is authoritative: missing, empty, or invalid must be rejected
  if (!categoryChannels || !Array.isArray(categoryChannels) || categoryChannels.length === 0) {
    return {
      allowed: false,
      error: "Selected category has no commerce channels configured. Please contact administrator.",
    };
  }

  for (const ch of categoryChannels) {
    if (ch !== 'QUICK_COMMERCE' && ch !== 'ECOMMERCE') {
      return {
        allowed: false,
        error: `Selected category has invalid commerce channel configuration: "${ch}".`,
      };
    }
  }

  const isAllowed = categoryChannels.includes(productType);
  if (!isAllowed) {
    if (categoryChannels.length === 1 && categoryChannels[0] === 'QUICK_COMMERCE') {
      return {
        allowed: false,
        error: "This category is available only for Quick Commerce.",
      };
    }
    if (categoryChannels.length === 1 && categoryChannels[0] === 'ECOMMERCE') {
      return {
        allowed: false,
        error: "This category is available only for Ecommerce.",
      };
    }
    return {
      allowed: false,
      error: `Product type ${productType} is not permitted for this category.`,
    };
  }

  return { allowed: true };
}

export interface ProductChannelCompatibilityParams {
  sellerVendorType?: 'QUICK_COMMERCE' | 'ECOMMERCE' | 'BOTH' | string;
  productType: 'QUICK_COMMERCE' | 'ECOMMERCE' | string;
  categoryChannels?: CommerceChannel[] | null;
  categoryName?: string;
  channelAvailability?: { quickCommerceEnabled: boolean; ecommerceEnabled: boolean };
  isExistingProductMaintenance?: boolean;
}

/**
 * Authoritative common validator for Seller vendorType + Product productType + Category commerceChannels + Global Channel Availability.
 */
export function validateProductChannelCompatibility(
  params: ProductChannelCompatibilityParams
): { valid: boolean; error?: string } {
  const {
    sellerVendorType,
    productType,
    categoryChannels,
    categoryName,
    channelAvailability,
    isExistingProductMaintenance,
  } = params;

  // 1. Validate productType format
  if (productType !== 'QUICK_COMMERCE' && productType !== 'ECOMMERCE') {
    return {
      valid: false,
      error: `Invalid productType: "${productType}". Must be QUICK_COMMERCE or ECOMMERCE.`,
    };
  }

  // 2. Validate against global commerce channel availability
  // Normal maintenance of existing products does not re-validate global availability unless the product is being newly assigned to a channel
  if (channelAvailability && !isExistingProductMaintenance) {
    if (productType === 'QUICK_COMMERCE' && channelAvailability.quickCommerceEnabled === false) {
      return {
        valid: false,
        error: "Quick Commerce is currently unavailable.",
      };
    }
    if (productType === 'ECOMMERCE' && channelAvailability.ecommerceEnabled === false) {
      return {
        valid: false,
        error: "E-Commerce is currently unavailable.",
      };
    }
  }

  // 3. Validate against seller vendorType
  if (sellerVendorType === 'ECOMMERCE' && productType === 'QUICK_COMMERCE') {
    return {
      valid: false,
      error: "ECOMMERCE-only seller cannot create or update QUICK_COMMERCE products",
    };
  }
  if (sellerVendorType === 'QUICK_COMMERCE' && productType === 'ECOMMERCE') {
    return {
      valid: false,
      error: "QUICK_COMMERCE-only seller cannot create or update ECOMMERCE products",
    };
  }

  // 3. Validate against category commerceChannels
  const catAllowed = isProductTypeAllowedForCategory(categoryChannels, productType as CommerceChannel);
  if (!catAllowed.allowed) {
    return {
      valid: false,
      error:
        catAllowed.error ||
        `Product type "${productType}" is not permitted for category "${categoryName || 'selected category'}".`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Wholesale Eligibility
// ---------------------------------------------------------------------------

export interface WholesaleEligibilityParams {
  /** AppSettings.wholesaleSettings.wholesaleEnabled */
  globalWholesaleEnabled: boolean;
  /** Seller.wholesaleEnabled */
  sellerWholesaleEnabled: boolean;
  /** Category.wholesaleEnabled */
  categoryWholesaleEnabled: boolean;
  /** Product.wholesaleEnabled */
  productWholesaleEnabled: boolean;
}

/**
 * Checks full 4-layer wholesale eligibility hierarchy.
 * All four gates must be true for wholesale to be enabled for this product.
 *
 * Layer order:
 *   1. Global (AppSettings.wholesaleSettings.wholesaleEnabled)
 *   2. Seller (Seller.wholesaleEnabled)
 *   3. Category (Category.wholesaleEnabled)
 *   4. Product (Product.wholesaleEnabled)
 */
export function checkWholesaleEligibility(
  params: WholesaleEligibilityParams
): { eligible: boolean; reason?: string } {
  if (!params.globalWholesaleEnabled) {
    return { eligible: false, reason: 'Wholesale is disabled globally by Admin' };
  }
  if (!params.sellerWholesaleEnabled) {
    return { eligible: false, reason: 'Wholesale is not enabled for this seller' };
  }
  if (!params.categoryWholesaleEnabled) {
    return { eligible: false, reason: 'Wholesale is not enabled for this product category' };
  }
  if (!params.productWholesaleEnabled) {
    return { eligible: false, reason: 'Wholesale is not enabled for this product' };
  }
  return { eligible: true };
}

/**
 * Validates wholesale pricing invariant:
 * wholesalePrice must be > 0 and strictly less than retailPrice.
 */
export function validateWholesalePrice(
  wholesalePrice: number,
  retailPrice: number
): { valid: boolean; error?: string } {
  if (!wholesalePrice || wholesalePrice <= 0) {
    return { valid: false, error: 'Wholesale price must be greater than 0' };
  }
  if (wholesalePrice >= retailPrice) {
    return {
      valid: false,
      error: 'Wholesale price (Rs. ' + wholesalePrice + ') must be less than retail price (Rs. ' + retailPrice + ')',
    };
  }
  return { valid: true };
}