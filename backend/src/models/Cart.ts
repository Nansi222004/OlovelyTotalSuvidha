import mongoose, { Document, Schema } from "mongoose";

export interface ICart extends Document {
  customer: mongoose.Types.ObjectId;
  items: mongoose.Types.ObjectId[]; // References to CartItem
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

const CartSchema = new Schema<ICart>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
      unique: true, // One cart per customer
    },
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: "CartItem",
      },
    ],
    total: {
      type: Number,
      default: 0,
      min: [0, "Total cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CartSchema.index({ customer: 1 });

const Cart = (mongoose.models.Cart as mongoose.Model<ICart>) || mongoose.model<ICart>("Cart", CartSchema);

export default Cart;
