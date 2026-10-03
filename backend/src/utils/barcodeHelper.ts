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
import { randomInt } from 'crypto';
import Product from '../models/Product';

export const BARCODE_PATTERN = /^[A-Za-z0-9._\/-]{4,64}$/;

export function normalizeBarcode(value: unknown): string {
  return String(value ?? '').trim();
}

export function validateBarcodeFormat(value: unknown): BarcodeValidationResult {
  const barcode = normalizeBarcode(value);
  if (!barcode) return { valid: true };
  if (!BARCODE_PATTERN.test(barcode)) {
    return {
      valid: false,
      error: 'Barcode must be 4-64 characters and may contain only letters, numbers, dots, underscores, hyphens, or slashes.',
    };
  }
  return { valid: true };
}

function ean13CheckDigit(firstTwelveDigits: string): number {
  const weightedTotal = firstTwelveDigits
    .split('')
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (weightedTotal % 10)) % 10;
}

/** Generates an internal-use EAN-13 value. Uniqueness is confirmed against MongoDB. */
export async function generateUniqueBarcode(maxAttempts = 20): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // GS1 prefix 20-29 is reserved for restricted/internal distribution.
    const body = `29${Date.now().toString().slice(-7)}${randomInt(0, 1000).toString().padStart(3, '0')}`;
    const candidate = `${body}${ean13CheckDigit(body)}`;
    const uniqueness = await validateBarcodeUniqueness({ barcode: candidate });
    if (uniqueness.valid) return candidate;
  }
  throw new Error('Unable to generate a unique barcode. Please try again.');
}

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
  const barcode = normalizeBarcode(options.barcode);

  // Empty barcode = clearing/removal — always valid
  if (!barcode) {
    return { valid: true };
  }

  const format = validateBarcodeFormat(barcode);
  if (!format.valid) return format;

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
    productId?: string;
    productName: string;
    mainImage?: string;
    price: number;
    stock: number;
    seller: string;
    productType: string;
    wholesaleEnabled: boolean;
    wholesalePrice?: number;
    wholesaleMinimumQuantity?: number;
    sku?: string;
    barcode?: string;
    status: string;
    publish: boolean;
    hsnCode?: string;
    hasVariations?: boolean;
    variations?: any[];
  };
  /** Null for top-level barcode match (simple product or unselected variant product). Undefined when found=false. */
  selectedVariation?: {
    _id: string;
    variationId?: string;
    name: string;
    value: string;
    price: number;
    stock: number;
    sku?: string;
    barcode?: string;
    title?: string;
    status?: string;
  } | null;
  /** Stock at the matched level (product or variation). Undefined when found=false. */
  currentStock?: number;
}

/**
 * Two-pass barcode lookup for POS scanner integration.
 *
 * Pass 1: Check Product.variations[].barcode (variation-level: most specific sellable unit).
 * Pass 2: Check Product.barcode (top-level / simple products).
 *
 * If a product containing variations is scanned by top-level barcode, any variation matching
 * that barcode is selected. If no specific variation matches, selectedVariation is returned
 * as null so that the POS client explicitly prompts for variant selection.
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

  // --- Pass 1: Variation-level barcode (most specific sellable match) ---
  const variationProduct = await Product.findOne({
    'variations.barcode': barcode,
    ...sellerFilter,
  }).lean();

  if (variationProduct) {
    const matchedVariation = variationProduct.variations?.find(
      (v: any) => v.barcode === barcode
    );
    if (matchedVariation) {
      const varId = (matchedVariation as any)._id?.toString() || '';
      const varTitle = matchedVariation.title || [matchedVariation.name, matchedVariation.value].filter(Boolean).join(': ') || 'Variant';
      const disc = Number(matchedVariation.discPrice);
      const varPrice: number = disc > 0 ? disc : Number(matchedVariation.price ?? variationProduct.price ?? 0);
      const varStock = matchedVariation.stock ?? 0;
      const varSku = matchedVariation.sku || variationProduct.sku;
      const varBarcode = matchedVariation.barcode || variationProduct.barcode;

      return {
        found: true,
        product: {
          _id: variationProduct._id.toString(),
          productId: variationProduct._id.toString(),
          productName: variationProduct.productName,
          mainImage: variationProduct.mainImage,
          price: varPrice,
          stock: variationProduct.stock,
          seller: variationProduct.seller.toString(),
          productType: variationProduct.productType,
          wholesaleEnabled: variationProduct.wholesaleEnabled ?? false,
          wholesalePrice: variationProduct.wholesalePrice,
          wholesaleMinimumQuantity: variationProduct.wholesaleMinimumQuantity,
          sku: variationProduct.sku,
          barcode: variationProduct.barcode,
          status: variationProduct.status,
          publish: variationProduct.publish,
          hsnCode: variationProduct.hsnCode,
          hasVariations: true,
          variations: variationProduct.variations?.map((v: any) => ({
            ...v,
            _id: v._id?.toString(),
          })),
        },
        selectedVariation: {
          _id: varId,
          variationId: varId,
          name: matchedVariation.name || variationProduct.variationType || 'Variant',
          value: matchedVariation.value || matchedVariation.title || 'Default',
          price: varPrice,
          stock: varStock,
          sku: varSku,
          barcode: varBarcode,
          title: varTitle,
          status: matchedVariation.status,
        },
        currentStock: varStock,
      };
    }
  }

  // --- Pass 2: Top-level product barcode ---
  const topLevel = await Product.findOne({ barcode, ...sellerFilter }).lean();
  if (topLevel) {
    const hasVariations = Array.isArray(topLevel.variations) && topLevel.variations.length > 0;
    let matchedVariation: any = null;
    if (hasVariations) {
      matchedVariation = topLevel.variations?.find((v: any) => v.barcode === barcode);
    }

    if (matchedVariation) {
      const varId = (matchedVariation as any)._id?.toString() || '';
      const varTitle = matchedVariation.title || [matchedVariation.name, matchedVariation.value].filter(Boolean).join(': ') || 'Variant';
      const disc = Number(matchedVariation.discPrice);
      const varPrice: number = disc > 0 ? disc : Number(matchedVariation.price ?? topLevel.price ?? 0);
      const varStock = matchedVariation.stock ?? 0;
      const varSku = matchedVariation.sku || topLevel.sku;
      const varBarcode = matchedVariation.barcode || topLevel.barcode;

      return {
        found: true,
        product: {
          _id: topLevel._id.toString(),
          productId: topLevel._id.toString(),
          productName: topLevel.productName,
          mainImage: topLevel.mainImage,
          price: varPrice,
          stock: topLevel.stock,
          seller: topLevel.seller.toString(),
          productType: topLevel.productType,
          wholesaleEnabled: topLevel.wholesaleEnabled ?? false,
          wholesalePrice: topLevel.wholesalePrice,
          wholesaleMinimumQuantity: topLevel.wholesaleMinimumQuantity,
          sku: topLevel.sku,
          barcode: topLevel.barcode,
          status: topLevel.status,
          publish: topLevel.publish,
          hsnCode: topLevel.hsnCode,
          hasVariations: true,
          variations: topLevel.variations?.map((v: any) => ({
            ...v,
            _id: v._id?.toString(),
          })),
        },
        selectedVariation: {
          _id: varId,
          variationId: varId,
          name: matchedVariation.name || topLevel.variationType || 'Variant',
          value: matchedVariation.value || matchedVariation.title || 'Default',
          price: varPrice,
          stock: varStock,
          sku: varSku,
          barcode: varBarcode,
          title: varTitle,
          status: matchedVariation.status,
        },
        currentStock: varStock,
      };
    }

    // Top-level barcode matched.
    // If the product contains variations and no specific variation matched,
    // selectedVariation is explicitly null, requiring explicit variant selection in POS.
    return {
      found: true,
      product: {
        _id: topLevel._id.toString(),
        productId: topLevel._id.toString(),
        productName: topLevel.productName,
        mainImage: topLevel.mainImage,
        price: topLevel.price,
        stock: topLevel.stock,
        seller: topLevel.seller.toString(),
        productType: topLevel.productType,
        wholesaleEnabled: topLevel.wholesaleEnabled ?? false,
        wholesalePrice: topLevel.wholesalePrice,
        wholesaleMinimumQuantity: topLevel.wholesaleMinimumQuantity,
        sku: topLevel.sku,
        barcode: topLevel.barcode,
        status: topLevel.status,
        publish: topLevel.publish,
        hsnCode: topLevel.hsnCode,
        hasVariations,
        variations: topLevel.variations?.map((v: any) => ({
          ...v,
          _id: v._id?.toString(),
        })),
      },
      selectedVariation: null,
      currentStock: topLevel.stock,
    };
  }

  return { found: false };
}
