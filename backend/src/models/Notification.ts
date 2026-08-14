import mongoose, { Document, Schema } from "mongoose";

export interface INotification extends Document {
  // Recipient Info
  recipientType: "Admin" | "Seller" | "Customer" | "Delivery" | "All";
  recipientId?: mongoose.Types.ObjectId; // Specific user ID if not 'All'
  broadcastBatchId?: string;
  broadcastRecipientType?: "Admin" | "Seller" | "Customer" | "Delivery" | "All";

  // Notification Content
  title: string;
  message: string;
  type:
  | "Info"
  | "Success"
  | "Warning"
  | "Error"
  | "Order"
  | "Payment"
  | "System";

  // Link/Action
  link?: string;
  actionLabel?: string;

  // Status
  isRead: boolean;
  readAt?: Date;

  // Priority
  priority: "Low" | "Medium" | "High" | "Urgent";

  // Expiry
  expiresAt?: Date;

  // Sent At (for push notifications)
  sentAt?: Date;

  // Created By
  createdBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    // Recipient Info
    recipientType: {
      type: String,
      enum: ["Admin", "Seller", "Customer", "Delivery", "All"],
      required: [true, "Recipient type is required"],
    },
    recipientId: {
      type: Schema.Types.ObjectId,
    },
    broadcastBatchId: {
      type: String,
      trim: true,
    },
    broadcastRecipientType: {
      type: String,
      enum: ["Admin", "Seller", "Customer", "Delivery", "All"],
    },

    // Notification Content
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "Info",
        "Success",
        "Warning",
        "Error",
        "Order",
        "Payment",
        "System",
      ],
      default: "Info",
    },

    // Link/Action
    link: {
      type: String,
      trim: true,
    },
    actionLabel: {
      type: String,
      trim: true,
    },

    // Status
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },

    // Priority
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },

    // Expiry
    expiresAt: {
      type: Date,
    },

    // Sent At (for push notifications)
    sentAt: {
      type: Date,
    },

    // Created By
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
NotificationSchema.index({ recipientType: 1, recipientId: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 });
NotificationSchema.index({ broadcastBatchId: 1, createdAt: -1 });

const Notification = (mongoose.models.Notification as mongoose.Model<INotification>) || mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);

export default Notification;
