import mongoose, { Document, Schema } from "mongoose";

/**
 * R-06: durable record of every gateway (Razorpay) refund attempt, written OUTSIDE any
 * business transaction so that it survives a transaction abort/retry.
 *
 *   INITIATED  written before the gateway call
 *   SUCCEEDED  gateway confirmed (gatewayRefundId set)
 *   FAILED     gateway rejected; a later attempt with the same key may retry
 *
 * The `key` is the business idempotency key (e.g. RETURN_<returnId>, CANCEL_<orderId>).
 * A SUCCEEDED intent is never sent to the gateway again. An INITIATED intent whose
 * process died is recovered by searching the payment's gateway refunds for the key
 * (stored in the refund's notes) before any new call is made.
 */
export interface IGatewayRefundIntent extends Document {
  key: string;
  payment: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  razorpayPaymentId: string;
  amount: number;
  /** Payment.refundAmount once this refund is applied (refund totals only grow). */
  cumulativeAfter?: number;
  status: "INITIATED" | "SUCCEEDED" | "FAILED";
  gatewayRefundId?: string;
  attempts: number;
  lastError?: string;
  reason?: string;
  /** Set once the Payment document reflects this refund (for reconciliation). */
  appliedToPaymentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GatewayRefundIntentSchema = new Schema<IGatewayRefundIntent>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    razorpayPaymentId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    cumulativeAfter: { type: Number },
    status: { type: String, enum: ["INITIATED", "SUCCEEDED", "FAILED"], default: "INITIATED" },
    gatewayRefundId: { type: String },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    reason: { type: String },
    appliedToPaymentAt: { type: Date },
  },
  { timestamps: true },
);

GatewayRefundIntentSchema.index({ payment: 1, status: 1 });

const GatewayRefundIntent =
  (mongoose.models.GatewayRefundIntent as mongoose.Model<IGatewayRefundIntent>) ||
  mongoose.model<IGatewayRefundIntent>("GatewayRefundIntent", GatewayRefundIntentSchema);

export default GatewayRefundIntent;
