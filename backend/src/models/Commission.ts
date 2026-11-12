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
  status: "Pending" | "OnHold" | "Paid" | "Cancelled";
  onHoldUntil?: Date;

  /**
   * How the customer's money for this item reaches the platform (seller commissions only):
   * PREPAID (gateway/wallet), RIDER_COD (Olovely rider remits cash), COURIER_COD (Shiprocket
   * remittance, B-4), UNASSIGNED_COD (legacy self-delivered COD; admin confirms cash).
   * A Pending seller commission is settled ONLY by its own channel's settlement flow.
   */
  settlementChannel?: "PREPAID" | "RIDER_COD" | "COURIER_COD" | "UNASSIGNED_COD";

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
      enum: ["Pending", "OnHold", "Paid", "Cancelled"],
      default: "Pending",
    },
    onHoldUntil: {
      type: Date,
    },
    settlementChannel: {
      type: String,
      enum: ["PREPAID", "RIDER_COD", "COURIER_COD", "UNASSIGNED_COD"],
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
CommissionSchema.index({ status: 1, onHoldUntil: 1 });
// R-07 uniqueness (one SELLER record per order item, one DELIVERY_BOY record per order) is created by
// src/scripts/migrations/createCommissionUniqueIndexes.ts AFTER the duplicate check passes, and
// is NOT auto-built here so that a production duplicate cannot break application start-up.

const Commission = (mongoose.models.Commission as mongoose.Model<ICommission>) || mongoose.model<ICommission>("Commission", CommissionSchema);

export default Commission;
