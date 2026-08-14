import mongoose, { Document, Schema } from "mongoose";

export interface ICommission extends Document {
  order: mongoose.Types.ObjectId;
  orderItem?: mongoose.Types.ObjectId; // Optional for delivery boy commissions
  seller?: mongoose.Types.ObjectId; // For seller commissions
  deliveryBoy?: mongoose.Types.ObjectId; // For delivery boy commissions

  // Commission Type
  type: "SELLER" | "DELIVERY_BOY";

  // Commission Info
  orderAmount: number;
  commissionRate: number; // Percentage
  commissionAmount: number;

  // Status
  status: "Pending" | "Paid" | "Cancelled";

  // Payment
  paidAt?: Date;
  paymentReference?: string;

  createdAt: Date;
  updatedAt: Date;
}

const CommissionSchema = new Schema<ICommission>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    orderItem: {
      type: Schema.Types.ObjectId,
      ref: "OrderItem",
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
    },
    deliveryBoy: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
    },

    // Commission Type
    type: {
      type: String,
      enum: ["SELLER", "DELIVERY_BOY"],
      required: [true, "Commission type is required"],
    },

    // Commission Info
    orderAmount: {
      type: Number,
      required: [true, "Order amount is required"],
      min: [0, "Order amount cannot be negative"],
    },
    commissionRate: {
      type: Number,
      required: [true, "Commission rate is required"],
      min: [0, "Commission rate cannot be negative"],
      max: [100, "Commission rate cannot exceed 100%"],
    },
    commissionAmount: {
      type: Number,
      required: [true, "Commission amount is required"],
      min: [0, "Commission amount cannot be negative"],
    },

    // Status
    status: {
      type: String,
      enum: ["Pending", "Paid", "Cancelled"],
      default: "Pending",
    },

    // Payment
    paidAt: {
      type: Date,
    },
    paymentReference: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CommissionSchema.index({ seller: 1, status: 1 });
CommissionSchema.index({ order: 1 });

const Commission = (mongoose.models.Commission as mongoose.Model<ICommission>) || mongoose.model<ICommission>("Commission", CommissionSchema);

export default Commission;
