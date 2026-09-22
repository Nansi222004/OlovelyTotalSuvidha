import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'DAMAGE';

export type ReferenceType = 'ORDER' | 'MANUAL' | 'IMPORT' | 'RETURN' | 'DAMAGE' | 'ADJUSTMENT';

export interface IInventoryTransaction extends Document {
  /** The product whose stock changed. */
  product: mongoose.Types.ObjectId;
  /** The seller who owns this product (for authorization checks). */
  seller: mongoose.Types.ObjectId;
  /** Whether transaction belongs to platform inventory or a vendor */
  ownerType?: 'PLATFORM' | 'VENDOR';

  /**
   * For variation products: the _id of the specific variation whose stock changed.
   * Null for simple (non-variation) products.
   * INVARIANT: variation stock changes NEVER alter parent Product.stock.
   */
  variationId?: mongoose.Types.ObjectId;
  /** Human-readable variation label (e.g. "500ml / Red") — snapshot for display. */
  variationName?: string;

  /** Movement type. Determines sign convention of `quantity`. */
  type: TransactionType;

  /**
   * Signed stock delta (positive = stock increase, negative = stock decrease).
   * STOCK_IN / RETURN / ADJUSTMENT(+): positive
   * STOCK_OUT / SALE / DAMAGE / ADJUSTMENT(-): negative
   */
  quantity: number;

  /**
   * Stock level BEFORE this mutation (captured from the atomic findOneAndUpdate
   * returnDocument: 'before' result). This is guaranteed fresh — never a stale read.
   */
  previousStock: number;

  /**
   * Stock level AFTER this mutation (= previousStock + quantity).
   * Computed and stored at transaction creation time for audit convenience.
   */
  newStock: number;

  /** Reference type for cross-referencing (ORDER, MANUAL, etc.). */
  referenceType?: ReferenceType;
  /** Reference ID — e.g. order._id.toString() for ORDER transactions. */
  referenceId?: string;
  /** Specific order item ID within the parent order (prevents collision across items of the same product). */
  orderItemId?: string;
  /** Deterministic unique mutation idempotency key (e.g. orderId:orderItemId:variationId:type). */
  idempotencyKey?: string;

  /** Admin or seller who initiated the transaction (for manual adjustments). */
  performedBy?: mongoose.Types.ObjectId;
  performedByRole?: 'ADMIN' | 'SELLER' | 'SYSTEM';

  /** Optional human note for ADJUSTMENT or DAMAGE entries. */
  note?: string;

  createdAt: Date;
  updatedAt: Date;
}

const InventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
      index: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller is required'],
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['PLATFORM', 'VENDOR'],
      default: 'VENDOR',
      index: true,
    },
    variationId: {
      type: Schema.Types.ObjectId,
    },
    variationName: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['STOCK_IN', 'STOCK_OUT', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE'],
      required: [true, 'Transaction type is required'],
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity delta is required'],
    },
    previousStock: {
      type: Number,
      required: [true, 'Previous stock is required'],
      min: [0, 'Previous stock cannot be negative'],
    },
    newStock: {
      type: Number,
      required: [true, 'New stock is required'],
      min: [0, 'New stock cannot be negative'],
    },
    referenceType: {
      type: String,
      enum: ['ORDER', 'MANUAL', 'IMPORT', 'RETURN', 'DAMAGE', 'ADJUSTMENT'],
    },
    referenceId: {
      type: String,
      trim: true,
    },
    orderItemId: {
      type: String,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
    },
    performedByRole: {
      type: String,
      enum: ['ADMIN', 'SELLER', 'SYSTEM'],
    },
    note: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for ledger queries
InventoryTransactionSchema.index({ product: 1, createdAt: -1 });
InventoryTransactionSchema.index({ seller: 1, createdAt: -1 });
InventoryTransactionSchema.index({ referenceType: 1, referenceId: 1 });
InventoryTransactionSchema.index({ idempotencyKey: 1 }, { sparse: true });
InventoryTransactionSchema.index({ orderItemId: 1 }, { sparse: true });
// Idempotency check index: prevents double-processing the same order event
InventoryTransactionSchema.index(
  { product: 1, referenceType: 1, referenceId: 1, type: 1, variationId: 1 },
  { sparse: true }
);

const InventoryTransaction =
  (mongoose.models.InventoryTransaction as mongoose.Model<IInventoryTransaction>) ||
  mongoose.model<IInventoryTransaction>('InventoryTransaction', InventoryTransactionSchema);

export default InventoryTransaction;
