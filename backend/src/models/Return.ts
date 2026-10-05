import mongoose, { Document, Schema } from "mongoose";

export interface IReturn extends Document {
  order: mongoose.Types.ObjectId;
  orderItem: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;

  // Request Type: Distinction between return for refund vs exchange for replacement
  requestType: "RETURN" | "EXCHANGE";

  // Return / Exchange Info
  reason: string;
  description?: string;

  /**
   * Full 9-stage return/exchange lifecycle:
   * Pending → Approved → Pickup Pending → Delivery Partner Assigned →
   * Picked Up → In Transit → Handed To Seller → Completed
   * (Rejected is a terminal failure state)
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
    | "QC Pending"
    | "QC Rejected"
    | "Reverse Shipment Created"
    | "Replacement Ready"
    | "Forward Shipment Created"
    | "Replacement Shipped"
    | "Completed";

  // Items
  quantity: number;
  images?: string[]; // Images of items

  // Processing
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  rejectionReason?: string;

  // ─────── Delivery Partner Assignment (for return/exchange pickup) ───────
  deliveryBoy?: mongoose.Types.ObjectId;
  assignedAt?: Date;

  // ─────── Return/Exchange Pickup OTP ───────
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

  // Ecommerce Reverse Logistics
  returnAwbNumber?: string;
  courierName?: string;
  reverseLogisticsStatus?: "NOT_REQUIRED" | "PENDING" | "CREATING" | "CREATED" | "FAILED" | "PICKED_UP" | "IN_TRANSIT" | "RECEIVED";
  reverseProvider?: string;
  reverseExternalOrderId?: string;
  reverseShipmentId?: string;
  reverseIdempotencyKey?: string;
  reverseLastError?: string;
  reverseTrackingUrl?: string;
  qcStatus?: "PENDING" | "APPROVED" | "REJECTED";
  qcReason?: string;
  qcProcessedAt?: Date;
  replacement?: {
    product: mongoose.Types.ObjectId;
    variationId?: mongoose.Types.ObjectId;
    seller: mongoose.Types.ObjectId;
    productName: string;
    variantTitle?: string;
    sku: string;
    hsnCode?: string;
    taxRate?: number;
    unitPrice: number;
    quantity: number;
    fulfillmentGroupId?: string;
    status: "PENDING_QC" | "READY" | "CREATING" | "CREATED" | "FAILED" | "SHIPPED" | "DELIVERED" | "MANUAL_INTERVENTION";
    idempotencyKey: string;
    inventoryIdempotencyKey: string;
    externalOrderId?: string;
    shipmentId?: string;
    awbNumber?: string;
    carrier?: string;
    trackingUrl?: string;
    lastError?: string;
  };
  pickupAddress?: {
    address: string;
    city: string;
    pincode: string;
  };

  // Refund (applicable only to RETURN, ₹0 for EXCHANGE)
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

    // Request Type
    requestType: {
      type: String,
      enum: ["RETURN", "EXCHANGE"],
      default: "RETURN",
      required: true,
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
        "QC Pending",
        "QC Rejected",
        "Reverse Shipment Created",
        "Replacement Ready",
        "Forward Shipment Created",
        "Replacement Shipped",
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

    // Ecommerce Reverse Logistics
    returnAwbNumber: {
      type: String,
      trim: true,
    },
    courierName: {
      type: String,
      trim: true,
    },
    reverseLogisticsStatus: {
      type: String,
      enum: ["NOT_REQUIRED", "PENDING", "CREATING", "CREATED", "FAILED", "PICKED_UP", "IN_TRANSIT", "RECEIVED"],
    },
    reverseProvider: { type: String, trim: true },
    reverseExternalOrderId: { type: String, trim: true },
    reverseShipmentId: { type: String, trim: true },
    reverseIdempotencyKey: { type: String, trim: true },
    reverseLastError: { type: String, trim: true },
    reverseTrackingUrl: { type: String, trim: true },
    qcStatus: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"] },
    qcReason: { type: String, trim: true },
    qcProcessedAt: { type: Date },
    replacement: {
      product: { type: Schema.Types.ObjectId, ref: "Product" },
      variationId: { type: Schema.Types.ObjectId },
      seller: { type: Schema.Types.ObjectId, ref: "Seller" },
      productName: { type: String, trim: true },
      variantTitle: { type: String, trim: true },
      sku: { type: String, trim: true },
      hsnCode: { type: String, trim: true },
      taxRate: { type: Number, min: 0, max: 100 },
      unitPrice: { type: Number, min: 0 },
      quantity: { type: Number, min: 1 },
      fulfillmentGroupId: { type: String, trim: true },
      status: {
        type: String,
        enum: ["PENDING_QC", "READY", "CREATING", "CREATED", "FAILED", "SHIPPED", "DELIVERED", "MANUAL_INTERVENTION"],
      },
      idempotencyKey: { type: String, trim: true },
      inventoryIdempotencyKey: { type: String, trim: true },
      externalOrderId: { type: String, trim: true },
      shipmentId: { type: String, trim: true },
      awbNumber: { type: String, trim: true },
      carrier: { type: String, trim: true },
      trackingUrl: { type: String, trim: true },
      lastError: { type: String, trim: true },
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
ReturnSchema.index({ requestType: 1 });
ReturnSchema.index({ deliveryBoy: 1 }); // For DP return pickup queries

const Return =
  (mongoose.models.Return as mongoose.Model<IReturn>) ||
  mongoose.model<IReturn>("Return", ReturnSchema);

export default Return;
