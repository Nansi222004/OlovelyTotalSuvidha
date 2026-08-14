import mongoose, { Document, Schema } from "mongoose";

export interface IDeliveryOrderOffer extends Document {
  order: mongoose.Types.ObjectId;
  deliveryBoy: mongoose.Types.ObjectId;
  status: "pending" | "rejected" | "accepted" | "expired";
  deliveryBoyEarning?: number;
  notifiedAt: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryOrderOfferSchema = new Schema<IDeliveryOrderOffer>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    deliveryBoy: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "rejected", "accepted", "expired"],
      default: "pending",
    },
    deliveryBoyEarning: {
      type: Number,
      min: 0,
    },
    notifiedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

DeliveryOrderOfferSchema.index({ order: 1, deliveryBoy: 1 }, { unique: true });
DeliveryOrderOfferSchema.index({ deliveryBoy: 1, status: 1 });
DeliveryOrderOfferSchema.index({ order: 1, status: 1 });

const DeliveryOrderOffer =
  (mongoose.models.DeliveryOrderOffer as mongoose.Model<IDeliveryOrderOffer>) ||
  mongoose.model<IDeliveryOrderOffer>("DeliveryOrderOffer", DeliveryOrderOfferSchema);

export default DeliveryOrderOffer;
