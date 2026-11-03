import mongoose, { Document, Schema } from 'mongoose';

export type EmailDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface IOrderEmailNotification extends Document {
  order: mongoose.Types.ObjectId;
  orderNumber: string;
  customer: mongoose.Types.ObjectId;
  recipientEmail: string;
  eventKey: string;
  subject: string;
  status: EmailDeliveryStatus;
  templateType: string;
  channel?: 'QUICK_COMMERCE' | 'ECOMMERCE' | 'MIXED';
  messageId?: string;
  errorMessage?: string;
  skippedReason?: string;
  attempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OrderEmailNotificationSchema = new Schema<IOrderEmailNotification>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    eventKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
      index: true,
    },
    templateType: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['QUICK_COMMERCE', 'ECOMMERCE', 'MIXED'],
    },
    messageId: {
      type: String,
      trim: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    skippedReason: {
      type: String,
      trim: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

OrderEmailNotificationSchema.index({ order: 1, createdAt: -1 });
OrderEmailNotificationSchema.index({ customer: 1, createdAt: -1 });
OrderEmailNotificationSchema.index({ status: 1, attempts: 1 });

const OrderEmailNotification =
  (mongoose.models.OrderEmailNotification as mongoose.Model<IOrderEmailNotification>) ||
  mongoose.model<IOrderEmailNotification>('OrderEmailNotification', OrderEmailNotificationSchema);

export default OrderEmailNotification;
