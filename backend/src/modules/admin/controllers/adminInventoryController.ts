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
import mongoose from 'mongoose';
import {
  resolveInventoryOwner,
  getPlatformSellerIds,
} from '../../../utils/inventoryHelper';
import { sendNotification } from '../../../services/notificationService';

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
// POS barcode lookup — full catalog (admin sees all sellers)
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
        (result.product as any).ownerType = owner.ownerType;
        (result.product as any).ownerLabel = owner.ownerLabel;
        (result.product as any).sellerName = owner.sellerName;
        (result.product as any).storeName = owner.storeName;
      }
    }

    res.json({ success: true, data: result });
  }
);

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

