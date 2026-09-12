import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedWebhookEvent extends Document {
  eventId: string;
  provider: string;
  awbNumber?: string;
  orderId?: string;
  statusUpdate?: string;
  rawPayload?: any;
  createdAt: Date;
}

const ProcessedWebhookEventSchema = new Schema<IProcessedWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    awbNumber: {
      type: String,
      trim: true,
      index: true,
    },
    orderId: {
      type: String,
      trim: true,
    },
    statusUpdate: {
      type: String,
      trim: true,
    },
    rawPayload: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically purge webhook events after 90 days
ProcessedWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const ProcessedWebhookEvent =
  (mongoose.models.ProcessedWebhookEvent as mongoose.Model<IProcessedWebhookEvent>) ||
  mongoose.model<IProcessedWebhookEvent>('ProcessedWebhookEvent', ProcessedWebhookEventSchema);

export default ProcessedWebhookEvent;
