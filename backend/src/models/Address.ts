import mongoose, { Document, Schema } from "mongoose";

export interface IAddress extends Document {
  customer: mongoose.Types.ObjectId;
  type: "Home" | "Work" | "Hotel" | "Other";
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state?: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },
    type: {
      type: String,
      enum: ["Home", "Work", "Hotel", "Other"],
      default: "Home",
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Address is required"],
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
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
AddressSchema.index({ customer: 1 });
AddressSchema.index({ isDefault: 1 });

const Address = (mongoose.models.Address as mongoose.Model<IAddress>) || mongoose.model<IAddress>("Address", AddressSchema);

export default Address;
