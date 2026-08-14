import mongoose, { Document, Schema } from "mongoose";

export interface IOrderItem extends Document {
  order: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  seller: mongoose.Types.ObjectId;

  // Product Details (snapshot at time of order)
  productName: string;
  productImage?: string;
  sku?: string;

  // Pricing
  unitPrice: number;
  quantity: number;
  total: number;

  // Variation
  variation?: string;
  variantTitle?: string;

  // Status
  status: "Pending" | "Shipped" | "Delivered" | "Cancelled" | "Returned";
  // Per-seller acceptance tracking (independent of main order status)
  sellerStatus: "Pending" | "Accepted" | "Rejected";
  subtotal: number;
  orderId?: string;
  commissionRate: number;
  commissionAmount: number;

  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: [true, "Seller is required"],
    },

    // Product Details (snapshot)
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    productImage: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },

    // Pricing
    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      min: [0, "Unit price cannot be negative"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    total: {
      type: Number,
      required: [true, "Total is required"],
      min: [0, "Total cannot be negative"],
    },

    // Variation
    variation: {
      type: String,
      trim: true,
    },
    variantTitle: {
      type: String,
      trim: true,
    },

    // Status
    status: {
      type: String,
      enum: ["Pending", "Shipped", "Delivered", "Cancelled", "Returned"],
      default: "Pending",
    },
    // Per-seller acceptance tracking
    sellerStatus: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected"],
      default: "Pending",
    },
    commissionRate: {
      type: Number,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    orderId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
OrderItemSchema.index({ order: 1 });
OrderItemSchema.index({ product: 1 });
OrderItemSchema.index({ seller: 1 });

const OrderItem = (mongoose.models.OrderItem as mongoose.Model<IOrderItem>) || mongoose.model<IOrderItem>("OrderItem", OrderItemSchema);

export default OrderItem;
