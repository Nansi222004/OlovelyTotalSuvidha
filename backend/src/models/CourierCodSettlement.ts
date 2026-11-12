import mongoose, { Document, Schema } from "mongoose";

/**
 * B-4 / R-04: one record per COD order whose courier (Shiprocket) part collected cash.
 *
 * Lifecycle:
 *   PENDING_REMITTANCE  created when the courier part is delivered (cash is with Shiprocket)
 *   REMITTED            set ONLY by an admin-verified CourierCodRemittance batch
 *   CANCELLED           courier part never collected (RTO / cancelled before delivery)
 *
 * Shiprocket "Delivered" status alone never moves a record to REMITTED.
 */
export type CourierCodSettlementStatus = "PENDING_REMITTANCE" | "REMITTED" | "CANCELLED";

export interface ICourierCodHistory {
  action: string;
  at: Date;
  by?: mongoose.Types.ObjectId;
  note?: string;
}

export interface ICourierCodSettlement extends Document {
  order: mongoose.Types.ObjectId;
  orderNumber: string;
  provider: "SHIPROCKET" | "MOCK" | string;
  awbCodes: string[];
  /** Cash Shiprocket collected for this order (courier share of codAmountPending). */
  codAmount: number;
  /** Σ seller nets of the courier items (B-3), for reporting. */
  sellerPayable: number;
  /** Σ seller commissions of the courier items + courier share of platform fee/shipping. */
  platformEarning: number;
  sellerCommissions: mongoose.Types.ObjectId[];
  status: CourierCodSettlementStatus;
  deliveredAt?: Date;
  remittance?: mongoose.Types.ObjectId;
  remittedAmount?: number;
  remittedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  history: ICourierCodHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const HistorySchema = new Schema<ICourierCodHistory>(
  {
    action: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "Admin" },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const CourierCodSettlementSchema = new Schema<ICourierCodSettlement>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    orderNumber: { type: String, required: true },
    provider: { type: String, default: "SHIPROCKET" },
    awbCodes: { type: [String], default: [] },
    codAmount: { type: Number, required: true, min: 0 },
    sellerPayable: { type: Number, default: 0, min: 0 },
    platformEarning: { type: Number, default: 0 },
    sellerCommissions: [{ type: Schema.Types.ObjectId, ref: "Commission" }],
    status: {
      type: String,
      enum: ["PENDING_REMITTANCE", "REMITTED", "CANCELLED"],
      default: "PENDING_REMITTANCE",
    },
    deliveredAt: { type: Date },
    remittance: { type: Schema.Types.ObjectId, ref: "CourierCodRemittance" },
    remittedAmount: { type: Number, min: 0 },
    remittedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true },
);

CourierCodSettlementSchema.index({ status: 1, createdAt: 1 });
CourierCodSettlementSchema.index({ remittance: 1 });

const CourierCodSettlement =
  (mongoose.models.CourierCodSettlement as mongoose.Model<ICourierCodSettlement>) ||
  mongoose.model<ICourierCodSettlement>("CourierCodSettlement", CourierCodSettlementSchema);

export default CourierCodSettlement;
