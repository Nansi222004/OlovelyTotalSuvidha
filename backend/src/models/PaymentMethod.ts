import mongoose, { Document, Schema } from "mongoose";

export interface IPaymentMethod extends Document {
  name: string;
  type: "COD" | "Online" | "Wallet" | "UPI" | "Card" | "Net Banking";
  isActive: boolean;
  icon?: string;
  description?: string;
  apiKey?: string;
  secretKey?: string;
  provider?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>(
  {
    name: {
      type: String,
      required: [true, "Payment method name is required"],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["COD", "Online", "Wallet", "UPI", "Card", "Net Banking"],
      required: [true, "Payment method type is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Gateway specific fields
    apiKey: {
      type: String,
      trim: true,
      select: false, // Don't return by default for security
    },
    secretKey: {
      type: String,
      trim: true,
      select: false, // Don't return by default for security
    },
    provider: {
      type: String, // e.g., 'stripe', 'razorpay'
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
      min: [0, "Order cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentMethodSchema.index({ isActive: 1, order: 1 });

const PaymentMethod = (mongoose.models.PaymentMethod as mongoose.Model<IPaymentMethod>) || mongoose.model<IPaymentMethod>(
  "PaymentMethod",
  PaymentMethodSchema
);

export default PaymentMethod;
