import mongoose, { Document, Schema } from "mongoose";

/**
 * B-4: one Shiprocket COD remittance (bank credit / UTR) verified by an admin.
 * A batch can cover many orders; orders not in this batch stay PENDING_REMITTANCE
 * and are settled by a later batch (partial remittance across batches).
 *
 * `reference` (UTR / Shiprocket remittance id) is unique per provider, so the same
 * remittance can never be recorded twice even if submitted concurrently.
 */
export interface ICourierCodRemittanceLine {
  order: mongoose.Types.ObjectId;
  orderNumber: string;
  codAmount: number;
}

export interface ICourierCodRemittance extends Document {
  provider: string;
  reference: string;
  remittanceDate: Date;
  /** Σ COD of the orders in this batch (what Shiprocket collected for them). */
  grossCodAmount: number;
  /** Freight / COD handling charges Shiprocket deducted. Borne by the platform (decision 2026-11-12). */
  courierCharges: number;
  /** Amount actually received in the bank = gross − courierCharges. */
  amountReceived: number;
  lines: ICourierCodRemittanceLine[];
  verifiedBy: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LineSchema = new Schema<ICourierCodRemittanceLine>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    codAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const CourierCodRemittanceSchema = new Schema<ICourierCodRemittance>(
  {
    provider: { type: String, default: "SHIPROCKET", required: true },
    reference: { type: String, required: true, trim: true },
    remittanceDate: { type: Date, required: true },
    grossCodAmount: { type: Number, required: true, min: 0 },
    courierCharges: { type: Number, default: 0, min: 0 },
    amountReceived: { type: Number, required: true, min: 0 },
    lines: { type: [LineSchema], default: [] },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

CourierCodRemittanceSchema.index({ provider: 1, reference: 1 }, { unique: true });
CourierCodRemittanceSchema.index({ remittanceDate: -1 });

const CourierCodRemittance =
  (mongoose.models.CourierCodRemittance as mongoose.Model<ICourierCodRemittance>) ||
  mongoose.model<ICourierCodRemittance>("CourierCodRemittance", CourierCodRemittanceSchema);

export default CourierCodRemittance;
