import mongoose, { Document, Schema } from "mongoose";

export interface IOrder extends Document {
  // Order Info
  orderNumber: string;
  invoiceNumber?: string;
  orderDate: Date;
  timeSlot?: string;

  // Customer Info
  customer: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  // Delivery Info
  deliveryAddress: {
    address: string;
    city: string;
    state?: string;
    pincode: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  };

  // Order Items
  items: mongoose.Types.ObjectId[]; // References to OrderItem

  // Pricing
  subtotal: number;
  tax: number;
  shipping: number;
  platformFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  grandTotal?: number; // Alias or computed total used in some controllers

  // Payment
  paymentMethod: string;
  paymentStatus: "Pending" | "Paid" | "Failed" | "Refunded";
  paymentId?: string;
  /** When admin received COD for this order (settled); null = pending pay to admin */
  codPaidToAdminAt?: Date;

  // Order Status
  status:
  | "Received"
  | "Accepted"
  | "Pending"
  | "Processed"
  | "Shipped"
  | "Picked up"
  | "On the way"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled"
  | "Rejected"
  | "Returned";

  // Delivery Assignment
  deliveryBoy?: mongoose.Types.ObjectId;
  deliveryBoyStatus?:
  | "Assigned"
  | "Picked Up"
  | "In Transit"
  | "Delivered"
  | "Failed";
  assignedAt?: Date;

  // Tracking
  trackingNumber?: string;
  estimatedDeliveryDate?: Date;
  deliveredAt?: Date;

  // Delivery OTP
  deliveryOtp?: string;
  deliveryOtpExpiresAt?: Date;
  deliveryOtpVerified?: boolean;
  invoiceEnabled?: boolean;
  deliveryDistanceKm?: number;

  // Seller Pickups (for multi-seller orders)
  sellerPickups?: Array<{
    seller: mongoose.Types.ObjectId;
    pickedUpAt?: Date;
    pickedUpBy?: mongoose.Types.ObjectId;
    latitude?: number;
    longitude?: number;
  }>;

  // Per-seller acceptance tracking for multi-seller orders
  sellerResponses?: Array<{
    seller: mongoose.Types.ObjectId;
    status: "Pending" | "Accepted" | "Rejected";
    respondedAt?: Date;
  }>;
  sellerConfirmationStatus?:
    | "Pending"
    | "Partial"
    | "Resolved"
    | "Rejected";
  deliveryAssignmentStatus?:
    | "NotStarted"
    | "Queued"
    | "Searching"
    | "Assigned"
    | "Failed"
    | "Cancelled";
  deliveryAssignmentTriggeredAt?: Date;
  deliveryAssignmentResolvedAt?: Date;
  acceptedSellerIds?: mongoose.Types.ObjectId[];
  rejectedSellerIds?: mongoose.Types.ObjectId[];
  fulfillableItems?: mongoose.Types.ObjectId[];

  // Notes
  adminNotes?: string;
  customerNotes?: string;
  deliveryInstructions?: string;
  specialRequests?: string;

  // Cancellation/Return
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;

  deliveryOption: "Instant" | "Standard";
  deliveryPreference?: "Self" | "Admin";
  tipAmount: number;
  giftPackaging: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    // Order Info
    orderNumber: {
      type: String,
      required: [true, "Order number is required"],
      unique: true,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    timeSlot: {
      type: String,
      trim: true,
    },

    // Customer Info
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    customerEmail: {
      type: String,
      required: [true, "Customer email is required"],
      trim: true,
    },
    customerPhone: {
      type: String,
      required: [true, "Customer phone is required"],
      trim: true,
    },

    // Delivery Info
    deliveryAddress: {
      address: {
        type: String,
        required: [true, "Delivery address is required"],
        trim: true,
      },
      city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      pincode: {
        type: String,
        required: [true, "Pincode is required"],
        trim: true,
      },
      landmark: {
        type: String,
        trim: true,
      },
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
    },

    // Order Items
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: "OrderItem",
      },
    ],

    // Pricing
    subtotal: {
      type: Number,
      required: [true, "Subtotal is required"],
      min: [0, "Subtotal cannot be negative"],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"],
    },
    shipping: {
      type: Number,
      default: 0,
      min: [0, "Shipping cannot be negative"],
    },
    platformFee: {
      type: Number,
      default: 0,
      min: [0, "Platform fee cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    couponCode: {
      type: String,
      trim: true,
    },
    total: {
      type: Number,
      required: [true, "Total is required"],
      min: [0, "Total cannot be negative"],
    },
    grandTotal: {
      type: Number,
    },

    // Payment
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
    paymentId: {
      type: String,
      trim: true,
    },
    codPaidToAdminAt: {
      type: Date,
      default: null,
    },

    // Order Status
    status: {
      type: String,
      enum: [
        "Received",
        "Accepted",
        "Pending",
        "Processed",
        "Shipped",
        "Picked up",
        "On the way",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Rejected",
        "Returned",
      ],
      default: "Received",
    },

    // Delivery Assignment
    deliveryBoy: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
    },
    deliveryBoyStatus: {
      type: String,
      enum: ["Assigned", "Picked Up", "In Transit", "Delivered", "Failed"],
    },
    assignedAt: {
      type: Date,
    },

    // Tracking
    trackingNumber: {
      type: String,
      trim: true,
    },
    estimatedDeliveryDate: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },

    // Delivery OTP
    deliveryOtp: {
      type: String,
      trim: true,
    },
    deliveryOtpExpiresAt: {
      type: Date,
    },
    deliveryOtpVerified: {
      type: Boolean,
      default: false,
    },
    invoiceEnabled: {
      type: Boolean,
      default: false,
    },
    deliveryDistanceKm: {
      type: Number,
    },

    // Seller Pickups (for multi-seller orders)
    sellerPickups: [
      {
        seller: {
          type: Schema.Types.ObjectId,
          ref: "Seller",
          required: true,
        },
        pickedUpAt: {
          type: Date,
        },
        pickedUpBy: {
          type: Schema.Types.ObjectId,
          ref: "Delivery",
        },
        latitude: {
          type: Number,
        },
        longitude: {
          type: Number,
        },
      },
    ],

    // Per-seller acceptance tracking for multi-seller orders
    sellerResponses: [
      {
        seller: {
          type: Schema.Types.ObjectId,
          ref: "Seller",
          required: true,
        },
        status: {
          type: String,
          enum: ["Pending", "Accepted", "Rejected"],
          default: "Pending",
        },
        respondedAt: {
          type: Date,
        },
      },
    ],
    sellerConfirmationStatus: {
      type: String,
      enum: ["Pending", "Partial", "Resolved", "Rejected"],
      default: "Pending",
    },
    deliveryAssignmentStatus: {
      type: String,
      enum: ["NotStarted", "Queued", "Searching", "Assigned", "Failed", "Cancelled"],
      default: "NotStarted",
    },
    deliveryAssignmentTriggeredAt: {
      type: Date,
    },
    deliveryAssignmentResolvedAt: {
      type: Date,
    },
    acceptedSellerIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Seller",
      },
    ],
    rejectedSellerIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Seller",
      },
    ],
    fulfillableItems: [
      {
        type: Schema.Types.ObjectId,
        ref: "OrderItem",
      },
    ],

    // Notes
    adminNotes: {
      type: String,
      trim: true,
    },
    customerNotes: {
      type: String,
      trim: true,
    },
    deliveryInstructions: {
      type: String,
      trim: true,
    },
    specialRequests: {
      type: String,
      trim: true,
    },

    // Cancellation/Return
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    deliveryOption: {
      type: String,
      enum: ["Instant", "Standard"],
      default: "Standard",
    },
    deliveryPreference: {
      type: String,
      enum: ["Self", "Admin"],
    },
    tipAmount: {
      type: Number,
      default: 0,
    },
    giftPackaging: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Generate order number before validation
OrderSchema.pre("validate", async function (this: IOrder, next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    this.orderNumber = `ORD${timestamp}${random}`;
  }
  next();
});

// Indexes for faster queries
OrderSchema.index({ customer: 1, orderDate: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ orderDate: -1 });
OrderSchema.index({ sellerConfirmationStatus: 1, deliveryAssignmentStatus: 1 });
OrderSchema.index({ deliveryBoy: 1 });
OrderSchema.index({ orderNumber: 1 });

const Order =
  (mongoose.models.Order as mongoose.Model<IOrder>) ||
  mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
