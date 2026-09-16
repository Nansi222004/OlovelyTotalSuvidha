import mongoose, { Document, Schema } from "mongoose";

export interface ICartItem extends Document {
  cart: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  quantity: number;
  variation?: string;
  variationId?: mongoose.Types.ObjectId;
  productType?: 'QUICK_COMMERCE' | 'ECOMMERCE';
  /** Whether this item is being purchased at wholesale terms. */
  isWholesale: boolean;
  /** Authoritative wholesale price snapshot at time of add-to-cart. Server-set. */
  wholesalePrice?: number;
  /** MOQ persisted per cart item — used for frontend display and checkout validation. */
  wholesaleMinimumQuantity?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    cart: {
      type: Schema.Types.ObjectId,
      ref: "Cart",
      required: [true, "Cart is required"],
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    variation: {
      type: String,
      trim: true,
    },
    variationId: {
      type: Schema.Types.ObjectId,
    },
    productType: {
      type: String,
      enum: ['QUICK_COMMERCE', 'ECOMMERCE'],
      default: 'QUICK_COMMERCE',
    },
    // Wholesale tracking
    isWholesale: {
      type: Boolean,
      default: false,
    },
    wholesalePrice: {
      type: Number,
      min: [0.01, 'Wholesale price must be positive'],
    },
    wholesaleMinimumQuantity: {
      type: Number,
      min: [1, 'Wholesale minimum quantity must be at least 1'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CartItemSchema.index({ cart: 1 });
CartItemSchema.index({ product: 1 });

const CartItem = (mongoose.models.CartItem as mongoose.Model<ICartItem>) || mongoose.model<ICartItem>("CartItem", CartItemSchema);

export default CartItem;
