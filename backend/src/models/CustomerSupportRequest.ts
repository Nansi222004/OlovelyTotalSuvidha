import mongoose, { Schema, Document } from "mongoose";

export type SupportCategory =
  | "General"
  | "Order"
  | "Order Issue"
  | "Delivery"
  | "Payment"
  | "Product"
  | "Return"
  | "Exchange"
  | "Account"
  | "Other";

export type SupportStatus = "Pending" | "In Progress" | "Resolved" | "Closed";
export type SupportPriority = "Low" | "Normal" | "High" | "Urgent";
export type SupportChannel = "QUICK_COMMERCE" | "ECOMMERCE" | "MIXED";

export interface ISupportMessage {
  _id?: any;
  clientMessageId?: string;
  senderType: "CUSTOMER" | "ADMIN";
  senderId?: mongoose.Types.ObjectId;
  senderName: string;
  message: string;
  createdAt: Date;
  readAt?: Date;
}

export interface ISupportFulfillmentContext {
  orderStatus?: string;
  channel?: string;
  fulfillmentType?: string;
  ownerType?: string;
  itemsCount?: number;
  totalAmount?: number;
  paymentMethod?: string;
  deliveryPartner?: string;
  itemsSummary?: string;
  sellerName?: string;
  deliveryType?: string;
  orderDate?: Date;
}

export interface ICustomerSupportRequest extends Document {
  clientRequestId?: string;
  ticketNumber?: string;
  customer?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  category: SupportCategory;
  status: SupportStatus;
  priority: SupportPriority;
  order?: mongoose.Types.ObjectId;
  orderNumber?: string;
  fulfillmentGroupId?: string;
  channel?: SupportChannel;
  fulfillmentContext?: ISupportFulfillmentContext;
  messages: ISupportMessage[];
  customerUnread: boolean;
  adminUnread: boolean;
  emailSent: boolean;
  emailMessageId?: string;
  resolvedAt?: Date;
  closedAt?: Date;
  lastMessageAt: Date;
  isLegacyContact?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupportMessageSchema = new Schema(
  {
    clientMessageId: {
      type: String,
      required: false,
      trim: true,
      maxlength: 128,
    },
    senderType: {
      type: String,
      enum: ["CUSTOMER", "ADMIN"],
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    readAt: {
      type: Date,
      required: false,
    },
  },
  { _id: true }
);

const CustomerSupportRequestSchema: Schema = new Schema(
  {
    clientRequestId: {
      type: String,
      required: false,
      trim: true,
      maxlength: 128,
    },
    ticketNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      required: false,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [200, "Subject cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [10, "Message must be at least 10 characters"],
      maxlength: [5000, "Message cannot exceed 5000 characters"],
    },
    category: {
      type: String,
      enum: [
        "General",
        "Order",
        "Order Issue",
        "Delivery",
        "Payment",
        "Product",
        "Return",
        "Exchange",
        "Account",
        "Other",
      ],
      default: "General",
      index: true,
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved", "Closed"],
      default: "Pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High", "Urgent"],
      default: "Normal",
      index: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: false,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      required: false,
      index: true,
    },
    fulfillmentGroupId: {
      type: String,
      trim: true,
      required: false,
    },
    channel: {
      type: String,
      enum: ["QUICK_COMMERCE", "ECOMMERCE", "MIXED"],
      required: false,
    },
    fulfillmentContext: {
      orderStatus: { type: String, trim: true },
      channel: { type: String, trim: true },
      fulfillmentType: { type: String, trim: true },
      ownerType: { type: String, trim: true },
      itemsCount: { type: Number },
      totalAmount: { type: Number },
      paymentMethod: { type: String, trim: true },
      deliveryPartner: { type: String, trim: true },
      itemsSummary: { type: String, trim: true },
      sellerName: { type: String, trim: true },
      deliveryType: { type: String, trim: true },
      orderDate: { type: Date },
    },
    messages: [SupportMessageSchema],
    customerUnread: {
      type: Boolean,
      default: false,
    },
    adminUnread: {
      type: Boolean,
      default: true,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailMessageId: {
      type: String,
    },
    resolvedAt: {
      type: Date,
      required: false,
    },
    closedAt: {
      type: Date,
      required: false,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isLegacyContact: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

CustomerSupportRequestSchema.index({ customer: 1, createdAt: -1 });
CustomerSupportRequestSchema.index({ status: 1, createdAt: -1 });
// A request ID is scoped to the authenticated customer so retries are safe
// without preventing another customer from independently using the same ID.
CustomerSupportRequestSchema.index(
  { customer: 1, clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      customer: { $exists: true },
      clientRequestId: { $type: "string" },
    },
    name: "uniq_customer_support_request_id",
  }
);

export default mongoose.model<ICustomerSupportRequest>(
  "CustomerSupportRequest",
  CustomerSupportRequestSchema
);
