import mongoose, { Document, Schema } from "mongoose";

export interface IDeliveryArea extends Document {
  name: string;
  city: string;
  pincodes: string[];
  isActive: boolean;
  deliveryCharges: number;
  estimatedDeliveryDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryAreaSchema = new Schema<IDeliveryArea>(
  {
    name: {
      type: String,
      required: [true, "Area name is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    pincodes: {
      type: [String],
      required: [true, "At least one pincode is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deliveryCharges: {
      type: Number,
      default: 0,
      min: [0, "Delivery charges cannot be negative"],
    },
    estimatedDeliveryDays: {
      type: Number,
      default: 1,
      min: [1, "Estimated delivery days must be at least 1"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DeliveryAreaSchema.index({ city: 1 });
DeliveryAreaSchema.index({ pincodes: 1 });

const DeliveryArea = mongoose.models.DeliveryArea || mongoose.model<IDeliveryArea>(
  "DeliveryArea",
  DeliveryAreaSchema
);

export default DeliveryArea;
