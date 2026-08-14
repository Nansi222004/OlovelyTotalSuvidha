import mongoose, { Document, Schema } from "mongoose";

export interface IRefund extends Document {
  order: mongoose.Types.ObjectId;
  payment: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;

  // Refund Info
  amount: number;
  reason: string;
  status: "Pending" | "Approved" | "Processed" | "Rejected" | "Completed";

  // Processing
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  rejectionReason?: string;

  // Gateway Info
  refundTransactionId?: string;
  gatewayResponse?: any;

  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema = new Schema<IRefund>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: [true, "Payment is required"],
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },

    // Refund Info
    amount: {
      type: Number,
      required: [true, "Refund amount is required"],
      min: [0, "Refund amount cannot be negative"],
    },
    reason: {
      type: String,
      required: [true, "Refund reason is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Processed", "Rejected", "Completed"],
      default: "Pending",
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

    // Gateway Info
    refundTransactionId: {
      type: String,
      trim: true,
    },
    gatewayResponse: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
RefundSchema.index({ order: 1 });
RefundSchema.index({ customer: 1 });
RefundSchema.index({ status: 1 });

const Refund = (mongoose.models.Refund as mongoose.Model<IRefund>) || mongoose.model<IRefund>("Refund", RefundSchema);

export default Refund;
