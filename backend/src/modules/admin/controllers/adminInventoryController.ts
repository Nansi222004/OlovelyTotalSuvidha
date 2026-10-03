/**
 * adminInventoryController.ts
 *
 * Admin-facing inventory management controller.
 * Provides:
 *   - Manual stock adjustment (ADJUSTMENT type)
 *   - Damage write-off (DAMAGE type)
 *   - Stock-in for new stock arrivals (STOCK_IN type)
 *   - Transaction ledger query with Platform vs Vendor ownership filtering
 *   - POS barcode lookup
 *   - Variant-aware low stock alerts with dynamic threshold & owner filtering
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { mutateStock, recordStockIn } from '../../../services/inventoryService';
import InventoryTransaction from '../../../models/InventoryTransaction';
import { lookupByBarcode } from '../../../utils/barcodeHelper';
import Product from '../../../models/Product';
import AppSettings from '../../../models/AppSettings';
import Order from '../../../models/Order';
import OrderItem from '../../../models/OrderItem';
import Customer from '../../../models/Customer';
import Seller from '../../../models/Seller';
import Tax from '../../../models/Tax';
import mongoose from 'mongoose';
import {
  resolveInventoryOwner,
  getPlatformSellerIds,
  getCanonicalAdminSeller,
} from '../../../utils/inventoryHelper';
import { sendNotification } from '../../../services/notificationService';
import PosCheckoutAttempt from '../../../models/PosCheckoutAttempt';
import { createHash, randomUUID } from 'crypto';
import {
  getStateByName,
  normalizeStateCode,
  validateStateIdentity,
} from '../../../utils/indianStates';
import { splitPosGst, toPosInvoiceItem, validatePosBusinessSettings } from '../../../utils/posBilling';

// ---------------------------------------------------------------------------
// GET /admin/inventory/transactions?productId=...&page=1&limit=50
// ---------------------------------------------------------------------------
export const getInventoryTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      productId,
      page = '1',
      limit = '50',
      type,
      sellerId,
      ownerType,
    } = req.query as Record<string, string>;

    const query: Record<string, any> = {};
    if (productId) query.product = new mongoose.Types.ObjectId(productId);
    if (type && type !== 'ALL') query.type = type;
    if (sellerId && sellerId !== 'ALL') query.seller = new mongoose.Types.ObjectId(sellerId);

    if (ownerType === 'PLATFORM') {
      const platformSellerIds = await getPlatformSellerIds();
      query.$or = [
        { ownerType: 'PLATFORM' },
        { seller: { $in: platformSellerIds } },
      ];
    } else if (ownerType === 'VENDOR') {
      const platformSellerIds = await getPlatformSellerIds();
      query.ownerType = { $ne: 'PLATFORM' };
      query.seller = { $nin: platformSellerIds };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      InventoryTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('product', 'productName mainImage sku barcode')
        .populate('seller', 'storeName sellerName email isPlatform category')
        .lean(),
      InventoryTransaction.countDocuments(query),
    ]);

    const formattedTransactions = transactions.map((tx: any) => {
      const owner = resolveInventoryOwner(tx.seller, tx);
      return {
        ...tx,
        ownerType: tx.ownerType || owner.ownerType,
        ownerLabel: owner.ownerLabel,
        ownerInfo: owner,
      };
    });

    res.json({
      success: true,
      data: formattedTransactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /admin/inventory/adjust
// Body: { productId, variationId?, delta, note }
// ---------------------------------------------------------------------------
// Helper: Validate Admin stock mutation target & ownership safeguards
// ---------------------------------------------------------------------------
async function validateAdminStockMutationTarget(
  productId: string,
  variationId?: string | null
): Promise<{
  product?: any;
  resolvedVariationId: string | null;
  error?: string;
  statusCode?: number;
}> {
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return {
      resolvedVariationId: null,
      statusCode: 400,
      error: 'A valid productId (24-character hexadecimal ObjectId) is required',
    };
  }

  const product = await Product.findById(productId).populate('seller');
  if (!product) {
    return {
      resolvedVariationId: null,
      statusCode: 404,
      error: 'Product not found',
    };
  }

  // 1. Authoritative ownership resolution: reject if ownership cannot be determined safely
  const owner = resolveInventoryOwner(product.seller, product);
  if (!owner || !owner.ownerType) {
    return {
      product,
      resolvedVariationId: null,
      statusCode: 400,
      error: `Cannot safely determine inventory ownership for "${product.productName}". Stock mutation rejected for inventory integrity.`,
    };
  }

  // 2. Reject vendor-owned inventory: vendors manage their own stock in the Vendor Panel
  if (owner.ownerType === 'VENDOR' || !owner.isPlatform) {
    const vendorName = owner.sellerName || 'the assigned vendor';
    return {
      product,
      resolvedVariationId: null,
      statusCode: 400,
      error: `Cannot adjust stock for vendor-owned inventory. "${product.productName}" is managed by vendor "${vendorName}" directly through the Vendor Panel (/seller/product/stock). To notify this vendor regarding inventory, use the Send Alert action in the Low Stock Alert tab.`,
    };
  }

  // 3. Platform inventory: validate variation targeting
  const hasVariations = Array.isArray(product.variations) && product.variations.length > 0;

  if (hasVariations) {
    if (!variationId) {
      return {
        product,
        resolvedVariationId: null,
        statusCode: 400,
        error: `Product "${product.productName}" contains variations. Please select a specific variation to adjust stock.`,
      };
    }

    if (!mongoose.Types.ObjectId.isValid(variationId)) {
      return {
        product,
        resolvedVariationId: null,
        statusCode: 400,
        error: 'Invalid variationId format (must be 24-character hexadecimal ObjectId)',
      };
    }

    const matchedVariation = product.variations?.find(
      (v: any) => v._id?.toString() === variationId.toString()
    );

    if (!matchedVariation) {
      return {
        product,
        resolvedVariationId: null,
        statusCode: 404,
        error: `Variation ${variationId} not found on product "${product.productName}".`,
      };
    }

    return { product, resolvedVariationId: (matchedVariation._id || variationId).toString() };
  } else {
    // Simple product without variations
    if (variationId) {
      return {
        product,
        resolvedVariationId: null,
        statusCode: 400,
        error: `Product "${product.productName}" is a simple product with no variations. Do not supply variationId.`,
      };
    }

    return { product, resolvedVariationId: null };
  }
}

// ---------------------------------------------------------------------------
// POST /admin/inventory/adjust
// Body: { productId, variationId?, delta, note }
// ---------------------------------------------------------------------------
export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const { productId, variationId, delta, note } = req.body;
  const adminId = (req as any).user?.userId;

  if (delta === undefined || delta === null || delta === 0 || isNaN(Number(delta))) {
    res.status(400).json({ success: false, message: 'delta must be a non-zero number' });
    return;
  }

  const target = await validateAdminStockMutationTarget(productId, variationId);
  if (target.error) {
    res.status(target.statusCode || 400).json({
      success: false,
      message: target.error,
    });
    return;
  }

  const result = await mutateStock({
    productId,
    variationId: target.resolvedVariationId,
    quantity: Number(delta),
    type: 'ADJUSTMENT',
    referenceType: 'ADJUSTMENT',
    performedBy: adminId,
    performedByRole: 'ADMIN',
    note: note || 'Manual admin adjustment',
  });

  res.json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// POST /admin/inventory/damage
// Body: { productId, variationId?, quantity, note }
// ---------------------------------------------------------------------------
export const recordDamage = asyncHandler(async (req: Request, res: Response) => {
  const { productId, variationId, quantity, note } = req.body;
  const adminId = (req as any).user?.userId;

  if (!quantity || Number(quantity) <= 0 || isNaN(Number(quantity))) {
    res.status(400).json({ success: false, message: 'quantity must be a positive number' });
    return;
  }

  const target = await validateAdminStockMutationTarget(productId, variationId);
  if (target.error) {
    res.status(target.statusCode || 400).json({
      success: false,
      message: target.error,
    });
    return;
  }

  const result = await mutateStock({
    productId,
    variationId: target.resolvedVariationId,
    quantity: -Math.abs(Number(quantity)),
    type: 'DAMAGE',
    referenceType: 'DAMAGE',
    performedBy: adminId,
    performedByRole: 'ADMIN',
    note: note || 'Damage write-off',
  });

  res.json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// POST /admin/inventory/stock-in
// Body: { productId, variationId?, quantity, note }
// ---------------------------------------------------------------------------
export const addStock = asyncHandler(async (req: Request, res: Response) => {
  const { productId, variationId, quantity, note } = req.body;
  const adminId = (req as any).user?.userId;

  if (!quantity || Number(quantity) <= 0 || isNaN(Number(quantity))) {
    res.status(400).json({ success: false, message: 'quantity must be a positive number' });
    return;
  }

  const target = await validateAdminStockMutationTarget(productId, variationId);
  if (target.error) {
    res.status(target.statusCode || 400).json({
      success: false,
      message: target.error,
    });
    return;
  }

  const result = await recordStockIn(
    productId,
    target.resolvedVariationId,
    Number(quantity),
    adminId,
    'ADMIN',
    note || 'Manual stock in'
  );

  res.json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// GET /admin/inventory/barcode/:barcode
// POS barcode lookup — platform-owned, active, published products only
// ---------------------------------------------------------------------------
export const lookupProductByBarcode = asyncHandler(
  async (req: Request, res: Response) => {
    const { barcode } = req.params;
    if (!barcode) {
      res.status(400).json({ success: false, message: 'barcode is required' });
      return;
    }

    const result = await lookupByBarcode(barcode);
    if (!result.found) {
      res
        .status(404)
        .json({ success: false, message: `No product found for barcode "${barcode}"` });
      return;
    }

    // Attach resolved owner info if product found
    if (result.product) {
      const productDoc = await Product.findById(result.product._id).populate('seller').lean();
      if (productDoc) {
        const owner = resolveInventoryOwner((productDoc as any).seller, productDoc);
        if (!owner.isPlatform) {
          res.status(403).json({ success: false, message: 'This product is not available for POS billing.' });
          return;
        }
        if ((productDoc as any).status !== 'Active' || (productDoc as any).publish !== true) {
          res.status(409).json({ success: false, message: 'This product is inactive or unavailable for POS billing.' });
          return;
        }
        if (result.selectedVariation && result.selectedVariation.status === 'Sold out') {
          res.status(409).json({ success: false, message: 'This product variation is not available for POS billing.' });
          return;
        }
        (result.product as any).ownerType = owner.ownerType;
        (result.product as any).ownerLabel = owner.ownerLabel;
        (result.product as any).sellerName = owner.sellerName;
        (result.product as any).storeName = owner.storeName;
        (result.product as any).tax = (productDoc as any).tax;
        (result.product as any).productId = (productDoc as any)._id.toString();
        (result.product as any).sku = (productDoc as any).sku;
        (result.product as any).barcode = (productDoc as any).barcode;
        const variations = Array.isArray((productDoc as any).variations) ? (productDoc as any).variations : [];
        (result.product as any).hasVariations = variations.length > 0;
        (result.product as any).variations = variations.map((v: any) => ({
          ...v,
          _id: v._id?.toString(),
        }));

        if (result.selectedVariation) {
          result.selectedVariation.variationId = result.selectedVariation._id;
          result.selectedVariation.sku = result.selectedVariation.sku || (productDoc as any).sku;
          result.selectedVariation.barcode = result.selectedVariation.barcode || (productDoc as any).barcode;
        }

        // Authoritative product tax rate resolution
        const settings = await AppSettings.getSettings();
        let taxRate = 0;
        const rawTax = (productDoc as any).tax;
        if (rawTax && typeof rawTax === 'object' && Number.isFinite(Number(rawTax.percentage))) {
          taxRate = Number(rawTax.percentage);
        } else if (rawTax && mongoose.Types.ObjectId.isValid(String(rawTax))) {
          const taxDoc: any = await Tax.findById(rawTax).select('percentage status').lean();
          if (taxDoc?.status === 'Active') taxRate = Number(taxDoc.percentage) || 0;
        } else if (typeof rawTax === 'string') {
          const match = rawTax.match(/(?:^|\D)(\d+(?:\.\d+)?)\s*%?$/);
          if (match) taxRate = Number(match[1]) || 0;
        }
        if (taxRate <= 0 && settings?.gstEnabled) {
          taxRate = Number(settings.gstRate) || 0;
        }
        (result.product as any).taxRate = taxRate;
      }
    }

    res.json({ success: true, data: result });
  }
);

function escapeSearchRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveProductTaxRate(product: any, settings: any): Promise<number> {
  const rawTax = product.tax;
  if (rawTax && typeof rawTax === 'object' && Number.isFinite(Number(rawTax.percentage))) {
    return Number(rawTax.percentage);
  }
  if (rawTax && mongoose.Types.ObjectId.isValid(String(rawTax))) {
    const taxDoc: any = await Tax.findById(rawTax).select('percentage status').lean();
    if (taxDoc?.status === 'Active') return Number(taxDoc.percentage) || 0;
  }
  if (typeof rawTax === 'string') {
    const match = rawTax.match(/(?:^|\D)(\d+(?:\.\d+)?)\s*%?$/);
    if (match) return Number(match[1]) || 0;
  }
  return settings?.gstEnabled ? Number(settings.gstRate) || 0 : 0;
}

// ---------------------------------------------------------------------------
// GET /admin/inventory/pos-search?q=...&limit=12
// Read-only, server-side, platform-only sellable SKU search.
// ---------------------------------------------------------------------------
export const searchPosProducts = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 12));
  if (!q) {
    res.json({ success: true, data: [] });
    return;
  }

  const regex = new RegExp(escapeSearchRegex(q), 'i');
  const platformSellerIds = await getPlatformSellerIds();
  const products = await Product.find({
    status: 'Active',
    publish: true,
    $and: [
      { $or: [{ ownerType: 'PLATFORM' }, { seller: { $in: platformSellerIds } }] },
      {
        $or: [
          { productName: regex },
          { sku: regex },
          { barcode: regex },
          { 'variations.title': regex },
          { 'variations.name': regex },
          { 'variations.value': regex },
          { 'variations.sku': regex },
          { 'variations.barcode': regex },
        ],
      },
    ],
  })
    .select('productName mainImage price discPrice stock sku barcode variations tax hsnCode ownerType seller variationType')
    .limit(limit)
    .lean();

  const settings = await AppSettings.getSettings();
  const results: any[] = [];
  for (const product of products as any[]) {
    const taxRate = await resolveProductTaxRate(product, settings);
    const base = {
      _id: product._id.toString(),
      productId: product._id.toString(),
      productName: product.productName,
      mainImage: product.mainImage,
      hsnCode: product.hsnCode,
      ownerType: 'PLATFORM',
      isPlatform: true,
      taxRate,
    };
    const variations = Array.isArray(product.variations) ? product.variations : [];
    if (variations.length === 0) {
      results.push({
        ...base,
        price: product.discPrice > 0 ? product.discPrice : product.price,
        stock: product.stock || 0,
        sku: product.sku,
        barcode: product.barcode,
        hasVariations: false,
      });
    } else {
      const productMatches = regex.test(product.productName) || regex.test(product.sku || '') || regex.test(product.barcode || '');
      const matchingVariations = variations.filter((variation: any) =>
        productMatches || [variation.title, variation.name, variation.value, variation.sku, variation.barcode]
          .some((value) => regex.test(String(value || '')))
      );
      for (const variation of matchingVariations) {
        if (variation.status === 'Sold out') continue;
        const variationTitle = variation.title || [variation.name, variation.value].filter(Boolean).join(': ') || 'Variant';
        const variationSku = variation.sku || product.sku;
        const variationBarcode = variation.barcode || product.barcode;
        const variationPrice = variation.discPrice > 0 ? variation.discPrice : (variation.price ?? product.price ?? 0);
        const variationStock = variation.stock || 0;
        const variationId = variation._id?.toString();

        results.push({
          ...base,
          variationId,
          variationTitle,
          price: variationPrice,
          stock: variationStock,
          sku: variationSku,
          barcode: variationBarcode,
          hasVariations: true,
          variation: {
            _id: variationId,
            title: variationTitle,
            name: variation.name || product.variationType || 'Variant',
            value: variation.value || variationTitle,
            price: variationPrice,
            stock: variationStock,
            sku: variationSku,
            barcode: variationBarcode,
          },
        });
        if (results.length >= limit) break;
      }
    }
    if (results.length >= limit) break;
  }

  res.json({ success: true, data: results.slice(0, limit) });
});

// ---------------------------------------------------------------------------
// GET /admin/inventory/low-stock?page=1&limit=50
// Returns products and individual variations below the configured low-stock threshold
// ---------------------------------------------------------------------------
export const getLowStockProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const settings = await AppSettings.getSettings();
    const threshold = Number(settings.inventorySettings?.lowStockThreshold ?? 10);
    const {
      page = '1',
      limit = '50',
      search,
      ownerType,
      sellerId,
      status, // 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));

    // Base query: Active products where either any variation is <= threshold, OR simple product stock <= threshold
    const query: Record<string, any> = {
      status: 'Active',
      $or: [
        { variations: { $elemMatch: { stock: { $lte: threshold } } } },
        {
          $and: [
            { $or: [{ variations: { $exists: false } }, { variations: { $size: 0 } }] },
            { stock: { $lte: threshold } },
          ],
        },
      ],
    };

    if (sellerId && sellerId !== 'ALL') {
      query.seller = new mongoose.Types.ObjectId(sellerId);
    }

    if (ownerType === 'PLATFORM') {
      const platformSellerIds = await getPlatformSellerIds();
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ ownerType: 'PLATFORM' }, { seller: { $in: platformSellerIds } }],
      });
    } else if (ownerType === 'VENDOR') {
      const platformSellerIds = await getPlatformSellerIds();
      query.$and = query.$and || [];
      query.$and.push({
        ownerType: { $ne: 'PLATFORM' },
        seller: { $nin: platformSellerIds },
      });
    }

    const products = await Product.find(query)
      .populate('seller', 'storeName sellerName email isPlatform category')
      .populate('category', 'name')
      .select('productName mainImage stock sku barcode productType seller category variations ownerType')
      .lean();

    // Flatten into individual stock alert items (1:1 per stock item)
    const allAlerts: any[] = [];

    for (const product of products) {
      const owner = resolveInventoryOwner(product.seller, product);

      if (product.variations && product.variations.length > 0) {
        for (const variation of product.variations) {
          const varStock = Number(variation.stock ?? 0);
          if (varStock <= threshold) {
            const variationTitle =
              variation.title || variation.value || variation.name || 'Default';
            allAlerts.push({
              _id: `${product._id}_${variation._id}`,
              productId: product._id.toString(),
              variationId: variation._id?.toString(),
              productName: product.productName,
              variationTitle,
              displayName: `${product.productName} (${variationTitle})`,
              mainImage: product.mainImage,
              sku: variation.sku || product.sku,
              barcode: variation.barcode || product.barcode,
              productType: product.productType,
              category: product.category,
              stock: varStock,
              threshold,
              isOutOfStock: varStock === 0,
              isLowStock: varStock > 0 && varStock <= threshold,
              ownerType: owner.ownerType,
              ownerLabel: owner.ownerLabel,
              seller: product.seller
                ? {
                    _id: (product.seller as any)._id?.toString(),
                    sellerName: (product.seller as any).sellerName,
                    storeName: (product.seller as any).storeName,
                    email: (product.seller as any).email,
                  }
                : null,
            });
          }
        }
      } else {
        const rootStock = Number(product.stock ?? 0);
        if (rootStock <= threshold) {
          allAlerts.push({
            _id: product._id.toString(),
            productId: product._id.toString(),
            productName: product.productName,
            displayName: product.productName,
            mainImage: product.mainImage,
            sku: product.sku,
            barcode: product.barcode,
            productType: product.productType,
            category: product.category,
            stock: rootStock,
            threshold,
            isOutOfStock: rootStock === 0,
            isLowStock: rootStock > 0 && rootStock <= threshold,
            ownerType: owner.ownerType,
            ownerLabel: owner.ownerLabel,
            seller: product.seller
              ? {
                  _id: (product.seller as any)._id?.toString(),
                  sellerName: (product.seller as any).sellerName,
                  storeName: (product.seller as any).storeName,
                  email: (product.seller as any).email,
                }
              : null,
          });
        }
      }
    }

    // Apply post-flattening filters: status & search
    let filteredAlerts = allAlerts;

    if (status === 'OUT_OF_STOCK') {
      filteredAlerts = filteredAlerts.filter((a) => a.isOutOfStock);
    } else if (status === 'LOW_STOCK') {
      filteredAlerts = filteredAlerts.filter((a) => a.isLowStock);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredAlerts = filteredAlerts.filter(
        (a) =>
          a.displayName?.toLowerCase().includes(q) ||
          a.productName?.toLowerCase().includes(q) ||
          a.variationTitle?.toLowerCase().includes(q) ||
          a.sku?.toLowerCase().includes(q) ||
          a.barcode?.toLowerCase().includes(q) ||
          a.ownerLabel?.toLowerCase().includes(q) ||
          a.seller?.sellerName?.toLowerCase().includes(q) ||
          a.seller?.storeName?.toLowerCase().includes(q)
      );
    }

    // Sort by stock ascending (0 out of stock first, then lowest stock), then displayName
    filteredAlerts.sort((a, b) => {
      if (a.stock !== b.stock) return a.stock - b.stock;
      return a.displayName.localeCompare(b.displayName);
    });

    const total = filteredAlerts.length;
    const skip = (pageNum - 1) * limitNum;
    const pagedAlerts = filteredAlerts.slice(skip, skip + limitNum);

    res.json({
      success: true,
      threshold,
      data: pagedAlerts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /admin/inventory/notify-vendor
// Body: { productId: string, variationId?: string }
// Admin action: sends dynamic push & in-app notification to the verified vendor
// ---------------------------------------------------------------------------
export const notifyVendorLowStock = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId, variationId } = req.body;
    const adminId = (req as any).user?.userId;

    if (!productId) {
      res.status(400).json({ success: false, message: 'productId is required' });
      return;
    }

    const product = await Product.findById(productId).populate('seller');
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const owner = resolveInventoryOwner(product.seller, product);

    // Platform inventory must not trigger vendor notifications
    if (owner.ownerType === 'PLATFORM' || owner.isPlatform || !product.seller) {
      res.status(400).json({
        success: false,
        message: 'Cannot send vendor alert for platform-owned inventory. This product belongs to Platform / Admin inventory.',
      });
      return;
    }

    // Authoritative database seller reference only (never client-supplied)
    const sellerDoc: any = product.seller;
    const vendorId = sellerDoc._id?.toString();
    if (!vendorId) {
      res.status(400).json({
        success: false,
        message: 'Product does not have a valid assigned vendor',
      });
      return;
    }

    // Fetch live configured threshold
    const settings = await AppSettings.getSettings();
    const threshold = Number(settings.inventorySettings?.lowStockThreshold ?? 10);

    // Live stock verification at send time
    let currentStock = 0;
    let variationName: string | undefined;
    let itemDisplayName = product.productName;

    if (variationId) {
      const variation = (product.variations || []).find(
        (v: any) => v._id?.toString() === variationId.toString()
      );
      if (!variation) {
        res.status(404).json({
          success: false,
          message: `Variation not found on product "${product.productName}"`,
        });
        return;
      }
      currentStock = Number(variation.stock ?? 0);
      variationName = variation.title || variation.value || variation.name || 'Default';
      itemDisplayName = `${product.productName} (${variationName})`;
    } else {
      currentStock = Number(product.stock ?? 0);
    }

    if (currentStock > threshold) {
      res.status(400).json({
        success: false,
        message: `Product "${itemDisplayName}" is no longer low on stock (current stock: ${currentStock}, threshold: ${threshold}).`,
      });
      return;
    }

    // Dynamic notification content
    const title = 'Low Stock Alert';
    const message = `${itemDisplayName} is running low on stock. Current stock: ${currentStock} units. Threshold: ${threshold} units. Please replenish your inventory.`;

    const notification = await sendNotification(
      'Seller',
      vendorId,
      title,
      message,
      {
        type: 'Warning',
        link: '/seller/product/stock',
        actionLabel: 'Update Stock',
        priority: 'High',
        createdBy: adminId,
        data: {
          productId: product._id.toString(),
          variationId: variationId ? variationId.toString() : '',
          productName: product.productName,
          variationName: variationName || '',
          stock: currentStock.toString(),
          threshold: threshold.toString(),
          role: 'seller',
          panel: 'seller',
          type: 'Warning',
          link: '/seller/product/stock',
        },
      }
    );

    const isPushDelivered = Boolean(notification?.sentAt);

    res.status(200).json({
      success: true,
      message: `Low stock alert sent to ${owner.ownerLabel} for "${itemDisplayName}".`,
      data: {
        notificationId: notification._id,
        recipientId: vendorId,
        recipientName: owner.ownerLabel,
        item: itemDisplayName,
        currentStock,
        threshold,
        inAppCreated: true,
        pushDelivered: isPushDelivered,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /admin/inventory/pos-checkout
// Body: { items, customer, payment, discount, notes, idempotencyKey }
// Processes an Admin POS counter sale, atomic stock deductions, and bill generation
// ---------------------------------------------------------------------------
class PosCheckoutError extends Error {
  public statusCode: number;
  constructor(public status: number, message: string) {
    super(message);
    this.statusCode = status;
  }
}

const waitForCompletedPosAttempt = async (idempotencyKey: string, requestHash: string) => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const existing = await PosCheckoutAttempt.findOne({ idempotencyKey }).lean();
    if (existing && existing.requestHash !== requestHash) {
      throw new PosCheckoutError(409, 'This idempotency key was already used for a different POS checkout.');
    }
    if (existing?.status === 'COMPLETED' && existing.response) return existing.response;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new PosCheckoutError(409, 'This POS checkout is still processing. Retry with the same idempotency key.');
};

export const posCheckout = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).user?.userId;
  const { items, customer, payment, discount = 0, notes } = req.body;
  const idempotencyKey = String(req.body.idempotencyKey || '').trim();

  if (!Array.isArray(items) || items.length === 0) {
    throw new PosCheckoutError(400, 'POS cart is empty. Please scan or add at least one product.');
  }
  if (!idempotencyKey || idempotencyKey.length > 128) {
    throw new PosCheckoutError(400, 'A valid POS idempotency key is required.');
  }

  const settings = await AppSettings.getSettings();
  const businessConfiguration = validatePosBusinessSettings(settings);
  if (!businessConfiguration.valid) {
    throw new PosCheckoutError(400, businessConfiguration.error || 'Business GST settings incomplete.');
  }
  const {
    businessName,
    businessAddress,
    companyPincode,
    state: businessState,
    gstin,
    gstInvoiceReady,
  } = businessConfiguration;

  const requestHash = createHash('sha256')
    .update(JSON.stringify({ items, customer, payment, discount, notes }))
    .digest('hex');
  const ownerToken = randomUUID();
  let checkoutAttempt: any;

  try {
    checkoutAttempt = await PosCheckoutAttempt.findOneAndUpdate(
      { idempotencyKey },
      {
        $setOnInsert: {
          idempotencyKey,
          requestHash,
          ownerToken,
          status: 'PROCESSING',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    checkoutAttempt = await PosCheckoutAttempt.findOne({ idempotencyKey });
  }

  if (!checkoutAttempt || checkoutAttempt.ownerToken !== ownerToken) {
    const replay = await waitForCompletedPosAttempt(idempotencyKey, requestHash);
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(200).json(replay);
  }

  const adminSeller = await getCanonicalAdminSeller();
  const session = await mongoose.startSession();
  let checkoutResponse: any;

  try {
    await session.withTransaction(async () => {
      interface ValidatedPosItem {
        product: any;
        variation?: any;
        variationId?: string;
        variationTitle?: string;
        hsnCode?: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        taxRate: number;
        taxAmount: number;
        taxableAmount: number;
      }

      const validatedItems: ValidatedPosItem[] = [];
      for (let index = 0; index < items.length; index += 1) {
        const inputItem = items[index];
        const quantity = Math.floor(Number(inputItem.quantity));
        if (!inputItem.productId || !Number.isFinite(quantity) || quantity <= 0) {
          throw new PosCheckoutError(400, `Item #${index + 1} has an invalid product or quantity.`);
        }

        const product = await Product.findById(inputItem.productId).populate('seller').session(session);
        if (!product) throw new PosCheckoutError(404, `Product not found for item #${index + 1}.`);

        const owner = resolveInventoryOwner(product.seller, product);
        if (owner.ownerType === 'VENDOR' || !owner.isPlatform) {
          throw new PosCheckoutError(
            400,
            `Cannot sell vendor-owned item "${product.productName}" via Admin POS.`
          );
        }

        const variations = Array.isArray(product.variations) ? product.variations : [];
        const hasVariations = variations.length > 0;

        if (hasVariations && !inputItem.variationId) {
          throw new PosCheckoutError(
            400,
            `Product "${product.productName}" contains variations. A specific variationId must be targeted for inventory mutation.`
          );
        }

        if (!hasVariations && inputItem.variationId) {
          throw new PosCheckoutError(
            400,
            `Product "${product.productName}" does not have variations, but variationId was specified.`
          );
        }

        let variation: any = null;
        let variationTitle: string | undefined;
        let availableStock = Number(product.stock ?? 0);
        const productDisc = Number(product.discPrice);
        let unitPrice = productDisc > 0 ? productDisc : Number(product.price || 0);
        if (inputItem.variationId) {
          variation = variations.find(
            (value: any) => value._id?.toString() === String(inputItem.variationId)
          );
          if (!variation) {
            throw new PosCheckoutError(404, `Variation not found on product "${product.productName}".`);
          }
          variationTitle = variation.title || [variation.name, variation.value].filter(Boolean).join(': ');
          availableStock = Number(variation.stock ?? 0);
          const variationDisc = Number(variation.discPrice);
          unitPrice = variationDisc > 0 ? variationDisc : Number(variation.price ?? product.price ?? 0);
        }
        if (availableStock < quantity) {
          throw new PosCheckoutError(
            400,
            `Insufficient stock for "${product.productName}". Available: ${availableStock}, requested: ${quantity}.`
          );
        }

        let taxRate = 0;
        if (settings.gstEnabled) {
          const rawTax = (product as any).tax;
          if (rawTax && typeof rawTax === 'object' && Number.isFinite(Number(rawTax.percentage))) {
            taxRate = Number(rawTax.percentage);
          } else if (rawTax && mongoose.Types.ObjectId.isValid(String(rawTax))) {
            const taxDoc: any = await Tax.findById(rawTax)
              .select('percentage status')
              .session(session)
              .lean();
            if (taxDoc?.status === 'Active') taxRate = Number(taxDoc.percentage) || 0;
          } else if (typeof rawTax === 'string') {
            const match = rawTax.match(/(?:^|\D)(\d+(?:\.\d+)?)\s*%?$/);
            if (match) taxRate = Number(match[1]) || 0;
          }
          if (taxRate <= 0) taxRate = Number(settings.gstRate) || 0;
        }

        const lineTotal = Number((unitPrice * quantity).toFixed(2));
        const taxAmount = taxRate > 0
          ? Number(((lineTotal * taxRate) / (100 + taxRate)).toFixed(2))
          : 0;
        validatedItems.push({
          product,
          variation,
          variationId: inputItem.variationId || undefined,
          variationTitle,
          hsnCode: String((product as any).hsnCode || '').trim() || undefined,
          quantity,
          unitPrice,
          lineTotal,
          taxRate,
          taxAmount,
          taxableAmount: Number((lineTotal - taxAmount).toFixed(2)),
        });
      }

      let customerDoc: any = null;
      const isWalkIn =
        customer?.isWalkIn !== false &&
        !customer?.customerId &&
        (!customer?.phone || customer?.phone === '0000000000');

      if (customer?.customerId) {
        customerDoc = await Customer.findById(customer.customerId).session(session);
        if (!customerDoc) throw new PosCheckoutError(404, 'Selected POS customer was not found.');
      }
      if (!customerDoc && customer?.phone && customer.phone !== '0000000000') {
        customerDoc = await Customer.findOne({ phone: String(customer.phone).trim() }).session(session);
        if (!customerDoc) {
          [customerDoc] = await Customer.create([{
            name: String(customer.name || 'Customer').trim(),
            phone: String(customer.phone).trim(),
            email: String(customer.email || '').trim() || undefined,
            state: String(customer.state || '').trim() || undefined,
            status: 'Active',
            refCode: `POS${Date.now()}${Math.floor(Math.random() * 1000)}`,
            deliveryOtp: '0000',
            totalOrders: 0,
            totalSpent: 0,
            walletAmount: 0,
          }], { session });
        }
      }
      if (!customerDoc) {
        customerDoc = await Customer.findOne({ phone: '0000000000' }).session(session);
        if (!customerDoc) {
          [customerDoc] = await Customer.create([{
            name: 'Walk-in Customer',
            phone: '0000000000',
            status: 'Active',
            refCode: 'WALKIN',
            deliveryOtp: '0000',
            totalOrders: 0,
            totalSpent: 0,
            walletAmount: 0,
          }], { session });
        }
      }

      let customerStateName = String(customer?.state || customerDoc.state || '').trim();
      let customerStateCode = normalizeStateCode(customer?.stateCode);
      if (!customerStateName && isWalkIn) {
        // Explicit rule: an anonymous in-store walk-in has place of supply at the configured store.
        customerStateName = businessState.name;
        customerStateCode = businessState.code;
      }
      const customerState = validateStateIdentity(
        customerStateName,
        customerStateCode || getStateByName(customerStateName)?.[0]
      );
      if (!customerState.valid) {
        throw new PosCheckoutError(
          400,
          'Customer billing state is required and must be a valid Indian state for POS tax calculation.'
        );
      }

      const subtotal = Number(validatedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
      const totalTax = Number(validatedItems.reduce((sum, item) => sum + item.taxAmount, 0).toFixed(2));
      const totalTaxable = Number(validatedItems.reduce((sum, item) => sum + item.taxableAmount, 0).toFixed(2));
      const totalDiscount = Number(Math.min(subtotal, Math.max(0, Number(discount) || 0)).toFixed(2));
      const grandTotal = Number((subtotal - totalDiscount).toFixed(2));
      const taxSplit = splitPosGst(totalTax, Boolean(settings.gstEnabled), businessState, customerState);
      const { cgst, sgst, igst } = taxSplit;

      const uniqueSuffix = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const orderNumber = `POS-${uniqueSuffix}`;
      const invoiceNumber = `POS-INV-${uniqueSuffix}`;
      const newOrder = new Order({
        orderNumber,
        invoiceNumber,
        orderDate: new Date(),
        customer: customerDoc._id,
        customerName: String(customer?.name || customerDoc.name).trim(),
        customerEmail: String(customer?.email || customerDoc.email || '').trim() || undefined,
        customerPhone: String(customer?.phone || customerDoc.phone).trim(),
        deliveryAddress: {
          address: 'In-Store Counter Sale (POS)',
          city: String(customerDoc.city || settings.companyCity || 'In-Store').trim(),
          state: customerState.name,
          pincode: companyPincode,
        },
        items: [],
        subtotal,
        tax: totalTax,
        shipping: 0,
        platformFee: 0,
        discount: totalDiscount,
        total: grandTotal,
        grandTotal,
        paymentMethod: payment?.method || 'Cash',
        paymentStatus: 'Paid',
        status: 'Delivered',
        deliveredAt: new Date(),
        invoiceEnabled: gstInvoiceReady,
        isPosOrder: true,
        posBusinessSnapshot: {
          businessName,
          businessAddress: businessAddress || undefined,
          companyState: businessState.name,
          stateCode: businessState.code,
          gstin: gstin || undefined,
        },
        posTaxSummary: {
          taxModel: taxSplit.taxModel,
          businessState: businessState.name,
          businessStateCode: businessState.code,
          customerState: customerState.name,
          customerStateCode: customerState.code,
          taxableAmount: totalTaxable,
          cgst,
          sgst,
          igst,
          totalTax,
        },
        deliveryOption: 'Instant',
        adminNotes: notes ? `POS Counter Sale: ${notes}` : 'POS In-Store Counter Sale',
      });
      await newOrder.save({ session });

      const invoiceItems: any[] = [];
      for (let index = 0; index < validatedItems.length; index += 1) {
        const item = validatedItems[index];
        const orderItemId = new mongoose.Types.ObjectId();
        const orderItem = new OrderItem({
          _id: orderItemId,
          order: newOrder._id,
          product: item.product._id,
          seller: adminSeller._id,
          productName: item.product.productName,
          productImage: item.product.mainImage,
          sku: item.variation?.sku || item.product.sku,
          hsnCode: item.hsnCode,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          total: item.lineTotal,
          subtotal: item.lineTotal,
          productType: item.product.productType === 'ECOMMERCE' ? 'ECOMMERCE' : 'QUICK_COMMERCE',
          fulfillmentType: 'LOCAL_DELIVERY',
          ownerType: 'PLATFORM',
          billingEntityName: businessName,
          billingEntityGstin: gstin || undefined,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          commissionRate: 0,
          commissionAmount: 0,
          variation: item.variationTitle,
          variantTitle: item.variationTitle,
          variationId: item.variationId ? new mongoose.Types.ObjectId(item.variationId) : undefined,
          isWholesale: false,
          status: 'Delivered',
          sellerStatus: 'Accepted',
          isReturnable: false,
          returnWindowDays: 0,
        });
        await orderItem.save({ session });
        newOrder.items.push(orderItem._id);

        await mutateStock({
          productId: item.product._id.toString(),
          variationId: item.variationId || null,
          quantity: -item.quantity,
          type: 'SALE',
          referenceType: 'ORDER',
          referenceId: newOrder._id.toString(),
          orderItemId: orderItemId.toString(),
          idempotencyKey: `${idempotencyKey}:item:${index}`,
          performedBy: adminId,
          performedByRole: 'ADMIN',
          note: `POS Counter Sale (${orderNumber})`,
          session,
        });

        invoiceItems.push(toPosInvoiceItem(orderItem));
      }

      await newOrder.save({ session });
      await Customer.findByIdAndUpdate(
        customerDoc._id,
        { $inc: { totalOrders: 1, totalSpent: grandTotal } },
        { session }
      );

      checkoutResponse = {
        success: true,
        message: 'POS Counter Sale completed successfully',
        data: {
          order: newOrder.toObject(),
          items: invoiceItems,
          business: {
            businessName,
            businessAddress,
            companyCity: settings.companyCity || '',
            companyState: businessState.name,
            companyPincode: settings.companyPincode || '',
            gstin,
            stateCode: businessState.code,
            contactPhone: settings.contactPhone || '',
            contactEmail: settings.contactEmail || '',
            gstEnabled: Boolean(settings.gstEnabled),
            gstInvoiceReady,
          },
          taxSummary: {
            taxModel: taxSplit.taxModel,
            businessState: businessState.name,
            businessStateCode: businessState.code,
            customerState: customerState.name,
            customerStateCode: customerState.code,
            subtotal,
            taxableAmount: totalTaxable,
            cgst,
            sgst,
            igst,
            totalTax,
            discount: totalDiscount,
            grandTotal,
          },
          paymentSummary: {
            method: payment?.method || 'Cash',
            amountPaid: Number(payment?.amountPaid ?? grandTotal),
            changeReturned: Number(payment?.changeReturned || 0),
          },
          customer: {
            id: customerDoc._id.toString(),
            name: String(customer?.name || customerDoc.name).trim(),
            phone: String(customer?.phone || customerDoc.phone).trim(),
            state: customerState.name,
            stateCode: customerState.code,
            isWalkIn,
          },
        },
      };

      const completion = await PosCheckoutAttempt.updateOne(
        { _id: checkoutAttempt._id, ownerToken, status: 'PROCESSING' },
        { $set: { status: 'COMPLETED', order: newOrder._id, response: checkoutResponse } },
        { session }
      );
      if (completion.modifiedCount !== 1) {
        throw new Error('POS idempotency lock was lost before checkout completion.');
      }
    });

    return res.status(201).json(checkoutResponse);
  } catch (error: any) {
    await PosCheckoutAttempt.deleteOne({
      _id: checkoutAttempt._id,
      ownerToken,
      status: 'PROCESSING',
    }).catch(() => undefined);
    const status = error instanceof PosCheckoutError ? error.status : 500;
    return res.status(status).json({
      success: false,
      message: error instanceof PosCheckoutError ? error.message : `POS checkout failed: ${error.message}`,
    });
  } finally {
    await session.endSession();
  }
});
