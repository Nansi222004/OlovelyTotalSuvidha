
import mongoose, { Document, Schema } from "mongoose";

export interface IReturn extends Document {
  order: mongoose.Types.ObjectId;
  orderItem: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;

  // Return Info
  reason: string;
  description?: string;

  /**
   * Full 9-stage return lifecycle:
   * Pending → Approved → Pickup Pending → Delivery Partner Assigned →
   * Picked Up → In Transit → Handed To Seller → Completed
   * (Rejected is a terminal failure state)
   * NOTE: "Processing" was removed — MongoDB confirmed 0 existing Processing records.
   */
  status:
    | "Pending"
    | "Approved"
    | "Rejected"
    | "Pickup Pending"
    | "Delivery Partner Assigned"
    | "Picked Up"
    | "In Transit"
    | "Handed To Seller"
    | "Completed";

  // Items
  quantity: number;
  images?: string[]; // Images of returned items

  // Processing
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  rejectionReason?: string;

  // ─────── Delivery Partner Assignment (for return pickup) ───────
  /** Delivery partner assigned specifically for this return pickup (NOT the forward-order DP) */
  deliveryBoy?: mongoose.Types.ObjectId;
  assignedAt?: Date;

  // ─────── Return Pickup OTP ───────
  pickupOtp?: string;
  pickupOtpExpiresAt?: Date;
  pickupOtpAttempts?: number;
  pickupOtpVerified?: boolean;

  // ─────── Lifecycle Timestamps ───────
  approvedAt?: Date;
  pickedUpAt?: Date;
  inTransitAt?: Date;
  handedToSellerAt?: Date;
  completedAt?: Date;

  // Legacy pickup fields (kept for backward compat)
  pickupScheduled?: Date;
  pickupCompleted?: Date;
  pickupAddress?: {
    address: string;
    city: string;
    pincode: string;
  };

  // Refund
  refundAmount?: number;
  refundId?: mongoose.Types.ObjectId;
  financialSettlementStatus?: "Pending" | "Completed" | "Failed";

  createdAt: Date;
  updatedAt: Date;
}

const ReturnSchema = new Schema<IReturn>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    orderItem: {
      type: Schema.Types.ObjectId,
      ref: "OrderItem",
      required: [true, "Order item is required"],
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },

    // Return Info
    reason: {
      type: String,
      required: [true, "Return reason is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Rejected",
        "Pickup Pending",
        "Delivery Partner Assigned",
        "Picked Up",
        "In Transit",
        "Handed To Seller",
        "Completed",
      ],
      default: "Pending",
    },

    // Items
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    images: {
      type: [String],
      default: [],
    },

    // Processing
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    processedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },

    // ─────── Delivery Partner Assignment ───────
    deliveryBoy: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
    },
    assignedAt: {
      type: Date,
    },

    // ─────── Return Pickup OTP ───────
    pickupOtp: {
      type: String,
      select: false, // Never expose OTP in regular queries
    },
    pickupOtpExpiresAt: {
      type: Date,
    },
    pickupOtpAttempts: {
      type: Number,
      default: 0,
    },
    pickupOtpVerified: {
      type: Boolean,
      default: false,
    },

    // ─────── Lifecycle Timestamps ───────
    approvedAt: { type: Date },
    pickedUpAt: { type: Date },
    inTransitAt: { type: Date },
    handedToSellerAt: { type: Date },
    completedAt: { type: Date },

    // Legacy pickup fields
    pickupScheduled: {
      type: Date,
    },
    pickupCompleted: {
      type: Date,
    },
    pickupAddress: {
      address: String,
      city: String,
      pincode: String,
    },

    // Refund
    refundAmount: {
      type: Number,
      min: [0, "Refund amount cannot be negative"],
    },
    refundId: {
      type: Schema.Types.ObjectId,
      ref: "Refund",
    },
    financialSettlementStatus: {
      type: String,
      enum: ["Pending", "Completed", "Failed"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReturnSchema.index({ order: 1 });
ReturnSchema.index({ customer: 1 });
ReturnSchema.index({ status: 1 });
ReturnSchema.index({ deliveryBoy: 1 }); // For DP return pickup queries

const Return =
  (mongoose.models.Return as mongoose.Model<IReturn>) ||
  mongoose.model<IReturn>("Return", ReturnSchema);

export default Return;
