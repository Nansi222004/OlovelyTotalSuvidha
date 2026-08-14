import mongoose, { Schema, Document } from "mongoose";

export interface IPromoStrip extends Document {
  headerCategorySlug: string; // Links to HeaderCategory slug (e.g., "all", "grocery", "fashion")
  heading: string; // e.g., "HOUSEFULL SALE"
  saleText: string; // e.g., "SALE"
  startDate: Date; // Sale start date
  endDate: Date; // Sale end date
  categoryCards: Array<{
    categoryId: mongoose.Types.ObjectId; // Reference to Category
    title: string; // Custom title for the card
    badge: string; // e.g., "Up to 55% OFF"
    discountPercentage: number; // Discount percentage (0-100)
    order: number; // Display order
  }>;
  featuredProducts: mongoose.Types.ObjectId[]; // Array of Product IDs for "CRAZY DEALS"
  crazyDealsTitle?: string; // Custom title for the CRAZY DEALS section (e.g., "CRAZY DEALS", "SPECIAL OFFERS")
  isActive: boolean; // Enable/disable the PromoStrip
  order: number; // For sorting if multiple PromoStrips per category
  createdAt: Date;
  updatedAt: Date;
}

const PromoStripSchema = new Schema<IPromoStrip>(
  {
    headerCategorySlug: {
      type: String,
      required: [true, "Header category slug is required"],
      trim: true,
      lowercase: true,
    },
    heading: {
      type: String,
      required: [true, "Heading is required"],
      trim: true,
      maxlength: [50, "Heading cannot exceed 50 characters"],
    },
    saleText: {
      type: String,
      required: [true, "Sale text is required"],
      trim: true,
      maxlength: [20, "Sale text cannot exceed 20 characters"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function (this: IPromoStrip, value: Date) {
          return value > this.startDate;
        },
        message: "End date must be after start date",
      },
    },
    categoryCards: [
      {
        categoryId: {
          type: Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
        title: {
          type: String,
          required: true,
          trim: true,
        },
        badge: {
          type: String,
          required: true,
          trim: true,
        },
        discountPercentage: {
          type: Number,
          required: true,
          min: [0, "Discount percentage cannot be negative"],
          max: [100, "Discount percentage cannot exceed 100"],
        },
        order: {
          type: Number,
          default: 0,
        },
      },
    ],
    featuredProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    crazyDealsTitle: {
      type: String,
      trim: true,
      maxlength: [30, "Crazy Deals title cannot exceed 30 characters"],
      default: "CRAZY DEALS",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
// Compound index for the most common query: headerCategorySlug + isActive + date range
PromoStripSchema.index({ headerCategorySlug: 1, isActive: 1, startDate: 1, endDate: 1 });
PromoStripSchema.index({ order: 1 });

const PromoStrip = (mongoose.models.PromoStrip as mongoose.Model<IPromoStrip>) || mongoose.model<IPromoStrip>("PromoStrip", PromoStripSchema);

export default PromoStrip;

