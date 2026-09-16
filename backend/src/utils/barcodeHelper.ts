/**
 * barcodeHelper.ts
 *
 * Multi-scope barcode uniqueness validator and POS barcode lookup helper.
 *
 * SCOPE CHECKS (in order):
 *   1. Product-level collision: no other product may use this barcode as its top-level barcode.
 *   2. Variation-level collision across products: no other product may have a variation with this barcode.
 *   3. Sibling variation collision on same product: no other variation on the same product may share this barcode.
 *
 * IMPORTANT: MongoDB sparse indexes alone cannot catch cross-scope collisions
 * (e.g. a top-level barcode matching an embedded variation barcode).
 * This helper performs authoritative application-level checks.
 */

import mongoose from 'mongoose';
import Product from '../models/Product';

export interface BarcodeValidationResult {
  valid: boolean;
  error?: string;
}

export interface BarcodeValidationOptions {
  barcode: string;
  /** The product being updated/created. Used to exclude self from collision checks. */
  targetProductId?: string | null;
  /** For variation barcode updates: the specific variation being updated. */
  targetVariationId?: string | null;
}

/**
 * Validates barcode uniqueness across all scopes.
 *
 * Returns { valid: true } if the barcode is safe to assign.
 * Returns { valid: false, error: '...' } on any collision.
 *
 * Passing an empty / whitespace-only barcode returns valid: true
 * (removal / clearing a barcode is always allowed).
 */
export async function validateBarcodeUniqueness(
  options: BarcodeValidationOptions
): Promise<BarcodeValidationResult> {
  const { targetProductId, targetVariationId } = options;

  // Normalize: trim whitespace
  const barcode = (options.barcode || '').trim();

  // Empty barcode = clearing/removal — always valid
  if (!barcode) {
    return { valid: true };
  }

  const excludeProductId = targetProductId
    ? new mongoose.Types.ObjectId(targetProductId)
    : null;

  // --- Check 1: Product-level collision in OTHER products ---
  const productLevelQuery: Record<string, any> = { barcode };
  if (excludeProductId) {
    productLevelQuery['_id'] = { $ne: excludeProductId };
  }
  const productCollision = await Product.findOne(productLevelQuery, { productName: 1 }).lean();
  if (productCollision) {
    return {
      valid: false,
      error: `Barcode "${barcode}" is already assigned to product: "${productCollision.productName}"`,
    };
  }

  // --- Check 2: Variation-level collision in OTHER products ---
  const variationCrossQuery: Record<string, any> = { 'variations.barcode': barcode };
  if (excludeProductId) {
    variationCrossQuery['_id'] = { $ne: excludeProductId };
  }
  const variationCrossCollision = await Product.findOne(variationCrossQuery, {
    productName: 1,
  }).lean();
  if (variationCrossCollision) {
    return {
      valid: false,
      error: `Barcode "${barcode}" is already assigned to a variation in product: "${variationCrossCollision.productName}"`,
    };
  }

  // --- Check 3: Sibling variation collision on the SAME product ---
  if (excludeProductId) {
    const sameProduct = await Product.findById(excludeProductId, { variations: 1 }).lean();
    if (sameProduct && sameProduct.variations) {
      const siblingCollision = sameProduct.variations.find(
        (v: any) =>
          v.barcode === barcode &&
          (!targetVariationId || v._id?.toString() !== targetVariationId)
      );
      if (siblingCollision) {
        return {
          valid: false,
          error: `Barcode "${barcode}" is already used by another variation on this product`,
        };
      }
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// POS / Barcode Scanner Lookup
// ---------------------------------------------------------------------------

export interface BarcodeLookupResult {
  found: boolean;
  product?: {
    _id: string;
    productName: string;
    mainImage?: string;
    price: number;
    stock: number;
    seller: string;
    productType: string;
    wholesaleEnabled: boolean;
    wholesalePrice?: number;
    wholesaleMinimumQuantity?: number;
  };
  /** Null for top-level barcode match (simple product). Undefined when found=false. */
  selectedVariation?: {
    _id: string;
    name: string;
    value: string;
    price: number;
    stock: number;
    sku?: string;
  } | null;
  /** Stock at the matched level (product or variation). Undefined when found=false. */
  currentStock?: number;
}

/**
 * Two-pass barcode lookup for POS scanner integration.
 *
 * Pass 1: Check Product.barcode (top-level / simple products).
 * Pass 2: Check Product.variations[].barcode (variation-level).
 *
 * Returns structured result including product info and variation context.
 * Seller scope: if `sellerId` is provided, only matches products owned by that seller.
 */
export async function lookupByBarcode(
  rawBarcode: string,
  sellerId?: string
): Promise<BarcodeLookupResult> {
  const barcode = (rawBarcode || '').trim();
  if (!barcode) {
    return { found: false };
  }

  const sellerFilter = sellerId ? { seller: new mongoose.Types.ObjectId(sellerId) } : {};

  // --- Pass 1: Top-level product barcode ---
  const topLevel = await Product.findOne({ barcode, ...sellerFilter }).lean();
  if (topLevel) {
    return {
      found: true,
      product: {
        _id: topLevel._id.toString(),
        productName: topLevel.productName,
        mainImage: topLevel.mainImage,
        price: topLevel.price,
        stock: topLevel.stock,
        seller: topLevel.seller.toString(),
        productType: topLevel.productType,
        wholesaleEnabled: topLevel.wholesaleEnabled ?? false,
        wholesalePrice: topLevel.wholesalePrice,
        wholesaleMinimumQuantity: topLevel.wholesaleMinimumQuantity,
      },
      selectedVariation: null,
      currentStock: topLevel.stock,
    };
  }

  // --- Pass 2: Variation-level barcode ---
  const variationProduct = await Product.findOne({
    'variations.barcode': barcode,
    ...sellerFilter,
  }).lean();

  if (variationProduct) {
    const matchedVariation = variationProduct.variations?.find(
      (v: any) => v.barcode === barcode
    );
    if (!matchedVariation) {
      return { found: false };
    }
    return {
      found: true,
      product: {
        _id: variationProduct._id.toString(),
        productName: variationProduct.productName,
        mainImage: variationProduct.mainImage,
        price: matchedVariation.price ?? variationProduct.price,
        stock: variationProduct.stock,
        seller: variationProduct.seller.toString(),
        productType: variationProduct.productType,
        wholesaleEnabled: variationProduct.wholesaleEnabled ?? false,
        wholesalePrice: variationProduct.wholesalePrice,
        wholesaleMinimumQuantity: variationProduct.wholesaleMinimumQuantity,
      },
      selectedVariation: {
        _id: (matchedVariation as any)._id?.toString(),
        name: matchedVariation.name,
        value: matchedVariation.value,
        price: matchedVariation.price ?? 0,
        stock: matchedVariation.stock ?? 0,
        sku: matchedVariation.sku,
      },
      currentStock: matchedVariation.stock ?? 0,
    };
  }

  return { found: false };
}
