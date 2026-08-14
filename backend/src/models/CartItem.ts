import mongoose, { Document, Schema } from "mongoose";

export interface ICartItem extends Document {
  cart: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  quantity: number;
  variation?: string;
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
