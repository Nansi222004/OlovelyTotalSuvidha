/**
 * adminInventoryController.ts
 *
 * Admin-facing inventory management controller.
 * Provides:
 *   - Manual stock adjustment (ADJUSTMENT type)
 *   - Damage write-off (DAMAGE type)
 *   - Stock-in for new stock arrivals (STOCK_IN type)
 *   - Transaction ledger query per product
 *   - POS barcode lookup
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { mutateStock, recordStockIn } from '../../../services/inventoryService';
import InventoryTransaction from '../../../models/InventoryTransaction';
import { lookupByBarcode } from '../../../utils/barcodeHelper';
import Product from '../../../models/Product';
import AppSettings from '../../../models/AppSettings';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// GET /admin/inventory/transactions?productId=...&page=1&limit=50
// ---------------------------------------------------------------------------
export const getInventoryTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId, page = '1', limit = '50', type } = req.query as Record<string, string>;

    const query: Record<string, any> = {};
    if (productId) query.product = new mongoose.Types.ObjectId(productId);
    if (type) query.type = type;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      InventoryTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('product', 'productName mainImage sku barcode')
        .populate('seller', 'storeName sellerName')
        .lean(),
      InventoryTransaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /admin/inventory/adjust
// Body: { productId, variationId?, delta, note }
// ---------------------------------------------------------------------------
export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const { productId, variationId, delta, note } = req.body;
  const adminId = (req as any).user?.userId;

  if (!productId) {
    res.status(400).json({ success: false, message: 'productId is required' });
  }
  if (delta === undefined || delta === null || delta === 0) {
    res.status(400).json({ success: false, message: 'delta must be a non-zero number' });
  }

  const result = await mutateStock({
    productId,
    variationId: variationId || null,
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

  if (!productId) {
    res.status(400).json({ success: false, message: 'productId is required' });
  }
  if (!quantity || Number(quantity) <= 0) {
    res.status(400).json({ success: false, message: 'quantity must be a positive number' });
  }

  const result = await mutateStock({
    productId,
    variationId: variationId || null,
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

  if (!productId) {
    res.status(400).json({ success: false, message: 'productId is required' });
  }
  if (!quantity || Number(quantity) <= 0) {
    res.status(400).json({ success: false, message: 'quantity must be a positive number' });
  }

  const result = await recordStockIn(
    productId,
    variationId || null,
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

    res.json({ success: true, data: result });
  }
);

// ---------------------------------------------------------------------------
// GET /admin/inventory/low-stock?page=1&limit=50
// Returns products below the configured low-stock threshold
// ---------------------------------------------------------------------------
export const getLowStockProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const settings = await AppSettings.getSettings();
    const threshold = settings.inventorySettings?.lowStockThreshold ?? 10;
    const { page = '1', limit = '50' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find({ stock: { $lte: threshold }, status: 'Active' })
        .sort({ stock: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('seller', 'storeName sellerName')
        .populate('category', 'name')
        .select('productName mainImage stock sku barcode productType seller category')
        .lean(),
      Product.countDocuments({ stock: { $lte: threshold }, status: 'Active' }),
    ]);

    res.json({
      success: true,
      threshold,
      data: products,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  }
);
