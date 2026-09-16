/**
 * inventoryService.ts
 *
 * Authoritative atomic inventory mutation service.
 *
 * INVARIANTS:
 * 1. Every stock mutation MUST pass through mutateStock — never bypass with direct $inc.
 * 2. Product.stock (or variations[].stock) is the SINGLE source of truth for current stock.
 * 3. InventoryTransaction is the IMMUTABLE ledger of every stock movement.
 * 4. Mutations are atomic: stock update + transaction creation succeed/fail together.
 * 5. previousStock is always captured from the atomic findOneAndUpdate result — never stale.
 * 6. Variation mutations NEVER alter parent Product.stock.
 * 7. Deduplication: for ORDER-type mutations, existing transactions for the same
 *    (product, variationId, referenceType, referenceId, type) are checked first.
 */

import mongoose from 'mongoose';
import Product from '../models/Product';
import InventoryTransaction, {
  TransactionType,
  ReferenceType,
} from '../models/InventoryTransaction';

export interface MutateStockOptions {
  productId: string;
  /** For variation products: the _id of the specific variation to mutate. Null for simple products. */
  variationId?: string | null;
  /** Signed delta: positive = add stock, negative = remove stock. */
  quantity: number;
  type: TransactionType;
  referenceType?: ReferenceType;
  /** e.g. order._id.toString() — used for idempotency deduplication. */
  referenceId?: string;
  /** Specific order item ID within the parent order (prevents collision across items of the same product). */
  orderItemId?: string;
  /** Explicit custom idempotency key if provided by caller. */
  idempotencyKey?: string;
  /** ObjectId of the Admin/Seller/System actor performing this mutation. */
  performedBy?: string;
  performedByRole?: 'ADMIN' | 'SELLER' | 'SYSTEM';
  note?: string;
}

export interface MutateStockResult {
  success: boolean;
  previousStock: number;
  newStock: number;
  transactionId: string;
}

/**
 * Atomically mutates product stock and records an InventoryTransaction.
 *
 * Returns MutateStockResult on success.
 * Throws an error with a descriptive message on failure (insufficient stock, not found, etc.).
 */
export async function mutateStock(
  options: MutateStockOptions
): Promise<MutateStockResult> {
  const {
    productId,
    variationId,
    quantity,
    type,
    referenceType,
    referenceId,
    orderItemId,
    idempotencyKey,
    performedBy,
    performedByRole = 'SYSTEM',
    note,
  } = options;

  if (quantity === 0) {
    throw new Error('Stock mutation quantity cannot be zero');
  }

  // --- Deterministic Idempotency Key Computation ---
  let effectiveIdempotencyKey = idempotencyKey;
  if (!effectiveIdempotencyKey && (referenceType === 'ORDER' || referenceType === 'RETURN') && referenceId) {
    const varKey = variationId ? variationId.toString() : 'none';
    const itemKey = orderItemId ? orderItemId.toString() : productId.toString();
    effectiveIdempotencyKey = `${referenceId}:${itemKey}:${varKey}:${type}`;
  }

  // --- Idempotency Deduplication Check ---
  if (effectiveIdempotencyKey) {
    // 1. Direct query by deterministic key
    let existing = await InventoryTransaction.findOne({ idempotencyKey: effectiveIdempotencyKey });

    // 2. Backward-compatible fallback for transactions created before idempotencyKey was stored
    if (!existing && referenceId) {
      existing = await InventoryTransaction.findOne({
        product: new mongoose.Types.ObjectId(productId),
        referenceType,
        referenceId,
        type,
        variationId: variationId ? new mongoose.Types.ObjectId(variationId) : { $exists: false },
        ...(orderItemId ? { orderItemId } : {}),
      });
    }

    if (existing) {
      return {
        success: true,
        previousStock: existing.previousStock,
        newStock: existing.newStock,
        transactionId: existing._id.toString(),
      };
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let previousStock: number;
    let newStock: number;
    let variationName: string | undefined;
    let sellerObjId: mongoose.Types.ObjectId;

    if (variationId) {
      // --- Variation-level mutation ---
      // Atomic: only update the specific variation's stock, leave Product.stock untouched.
      const updateQuery: Record<string, any> = { _id: new mongoose.Types.ObjectId(productId) };

      if (quantity < 0) {
        // Decrement: only proceed if variation stock is sufficient
        updateQuery['variations'] = {
          $elemMatch: {
            _id: new mongoose.Types.ObjectId(variationId),
            stock: { $gte: Math.abs(quantity) },
          },
        };
      } else {
        updateQuery['variations._id'] = new mongoose.Types.ObjectId(variationId);
      }

      const beforeDoc = await Product.findOneAndUpdate(
        updateQuery,
        { $inc: { 'variations.$.stock': quantity } },
        { new: false, session }
      );

      if (!beforeDoc) {
        throw new Error(
          quantity < 0
            ? 'Insufficient stock for this variation, or variation not found'
            : 'Variation not found'
        );
      }

      const variation = beforeDoc.variations?.find(
        (v: any) => v._id.toString() === variationId
      );
      if (!variation) {
        throw new Error(`Variation ${variationId} not found on product ${productId}`);
      }

      previousStock = variation.stock ?? 0;
      newStock = previousStock + quantity;
      variationName = `${variation.name}: ${variation.value}`;
      sellerObjId = beforeDoc.seller as mongoose.Types.ObjectId;
    } else {
      // --- Simple product mutation ---
      const updateQuery: Record<string, any> = { _id: new mongoose.Types.ObjectId(productId) };

      if (quantity < 0) {
        // Decrement: enforce stock sufficiency atomically
        updateQuery['stock'] = { $gte: Math.abs(quantity) };
      }

      const beforeDoc = await Product.findOneAndUpdate(
        updateQuery,
        { $inc: { stock: quantity } },
        { new: false, session }
      );

      if (!beforeDoc) {
        throw new Error(
          quantity < 0
            ? 'Insufficient stock, or product not found'
            : 'Product not found'
        );
      }

      previousStock = beforeDoc.stock;
      newStock = previousStock + quantity;
      sellerObjId = beforeDoc.seller as mongoose.Types.ObjectId;
    }

    // --- Create the immutable ledger entry ---
    const [tx] = await InventoryTransaction.create(
      [
        {
          product: new mongoose.Types.ObjectId(productId),
          seller: sellerObjId,
          variationId: variationId ? new mongoose.Types.ObjectId(variationId) : undefined,
          variationName,
          type,
          quantity,
          previousStock,
          newStock,
          referenceType,
          referenceId,
          orderItemId,
          idempotencyKey: effectiveIdempotencyKey,
          performedBy: performedBy ? new mongoose.Types.ObjectId(performedBy) : undefined,
          performedByRole,
          note,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      previousStock,
      newStock,
      transactionId: tx._id.toString(),
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Convenience wrapper: decrement stock for a SALE (order placement).
 */
export async function recordSale(
  productId: string,
  variationId: string | null,
  quantity: number,
  orderId: string,
  orderItemId?: string,
  performedBy?: string
): Promise<MutateStockResult> {
  return mutateStock({
    productId,
    variationId,
    quantity: -Math.abs(quantity),
    type: 'SALE',
    referenceType: 'ORDER',
    referenceId: orderId,
    orderItemId,
    performedBy,
    performedByRole: 'SYSTEM',
  });
}

/**
 * Convenience wrapper: restore stock for a RETURN (cancellation / refund / failed payment).
 */
export async function recordReturn(
  productId: string,
  variationId: string | null,
  quantity: number,
  orderId: string,
  orderItemId?: string,
  performedBy?: string
): Promise<MutateStockResult> {
  return mutateStock({
    productId,
    variationId,
    quantity: Math.abs(quantity),
    type: 'RETURN',
    referenceType: 'RETURN',
    referenceId: orderId,
    orderItemId,
    performedBy,
    performedByRole: 'SYSTEM',
  });
}

/**
 * Convenience wrapper: manual stock adjustment by Admin or Seller.
 */
export async function recordAdjustment(
  productId: string,
  variationId: string | null,
  delta: number,
  performedBy: string,
  performedByRole: 'ADMIN' | 'SELLER',
  note?: string
): Promise<MutateStockResult> {
  return mutateStock({
    productId,
    variationId,
    quantity: delta,
    type: 'ADJUSTMENT',
    referenceType: 'ADJUSTMENT',
    performedBy,
    performedByRole,
    note,
  });
}

/**
 * Convenience wrapper: initial stock in for a new product or bulk import.
 */
export async function recordStockIn(
  productId: string,
  variationId: string | null,
  quantity: number,
  performedBy: string,
  performedByRole: 'ADMIN' | 'SELLER',
  note?: string
): Promise<MutateStockResult> {
  return mutateStock({
    productId,
    variationId,
    quantity: Math.abs(quantity),
    type: 'STOCK_IN',
    referenceType: 'MANUAL',
    performedBy,
    performedByRole,
    note,
  });
}
