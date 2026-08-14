import mongoose, { Document, Schema } from "mongoose";

export interface IBrand extends Document {
  name: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      unique: true,
    },
    image: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
BrandSchema.index({ name: 1 });

const Brand = (mongoose.models.Brand as mongoose.Model<IBrand>) || mongoose.model<IBrand>("Brand", BrandSchema);

export default Brand;
