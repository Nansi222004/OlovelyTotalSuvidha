import mongoose, { Document, Schema } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  description?: string;

  // Discount Type
  discountType: "Percentage" | "Fixed";
  discountValue: number;

  // Limits
  minimumPurchase?: number;
  maximumDiscount?: number;

  // Validity
  startDate: Date;
  endDate: Date;
  isActive: boolean;

  // Usage Limits
  usageLimit?: number; // Total usage limit
  usageCount: number; // Current usage count
  usageLimitPerUser?: number; // Per user limit

  // Applicability
  applicableTo: "All" | "Category" | "Product" | "Seller";
  applicableIds?: mongoose.Types.ObjectId[]; // Category/Product/Seller IDs

  // Created By
  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Discount Type
    discountType: {
      type: String,
      enum: ["Percentage", "Fixed"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },

    // Limits
    minimumPurchase: {
      type: Number,
      min: [0, "Minimum purchase cannot be negative"],
    },
    maximumDiscount: {
      type: Number,
      min: [0, "Maximum discount cannot be negative"],
    },

    // Validity
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Usage Limits
    usageLimit: {
      type: Number,
      min: [0, "Usage limit cannot be negative"],
    },
    usageCount: {
      type: Number,
      default: 0,
      min: [0, "Usage count cannot be negative"],
    },
    usageLimitPerUser: {
      type: Number,
      min: [0, "Usage limit per user cannot be negative"],
    },

    // Applicability
    applicableTo: {
      type: String,
      enum: ["All", "Category", "Product", "Seller"],
      default: "All",
    },
    applicableIds: [
      {
        type: Schema.Types.ObjectId,
      },
    ],

    // Created By
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: [true, "Created by is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
CouponSchema.index({ code: 1 });
CouponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

const Coupon = (mongoose.models.Coupon as mongoose.Model<ICoupon>) || mongoose.model<ICoupon>("Coupon", CouponSchema);

export default Coupon;
