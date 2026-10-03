import mongoose, { Document, Schema } from 'mongoose';

export interface IPosCheckoutAttempt extends Document {
  idempotencyKey: string;
  requestHash: string;
  ownerToken: string;
  status: 'PROCESSING' | 'COMPLETED';
  order?: mongoose.Types.ObjectId;
  response?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PosCheckoutAttemptSchema = new Schema<IPosCheckoutAttempt>(
  {
    idempotencyKey: { type: String, required: true, trim: true },
    requestHash: { type: String, required: true, trim: true },
    ownerToken: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PROCESSING', 'COMPLETED'],
      default: 'PROCESSING',
      required: true,
    },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    response: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// A database-enforced request-level lock. Sparse/partial behavior is unnecessary
// because every POS checkout attempt must have a key.
PosCheckoutAttemptSchema.index({ idempotencyKey: 1 }, { unique: true });

const PosCheckoutAttempt =
  (mongoose.models.PosCheckoutAttempt as mongoose.Model<IPosCheckoutAttempt>) ||
  mongoose.model<IPosCheckoutAttempt>('PosCheckoutAttempt', PosCheckoutAttemptSchema);

export default PosCheckoutAttempt;
