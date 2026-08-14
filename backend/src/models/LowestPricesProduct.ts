import mongoose, { Schema, Document } from "mongoose";

export interface ILowestPricesProduct extends Document {
    product: mongoose.Types.ObjectId;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const LowestPricesProductSchema = new Schema<ILowestPricesProduct>(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: [true, "Product is required"],
        },
        order: {
            type: Number,
            required: [true, "Display order is required"],
            default: 0,
            min: [0, "Order cannot be negative"],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
LowestPricesProductSchema.index({ order: 1, isActive: 1 });
LowestPricesProductSchema.index({ isActive: 1 });
// Prevent duplicate products with unique index
LowestPricesProductSchema.index({ product: 1 }, { unique: true });

const LowestPricesProduct = (mongoose.models.LowestPricesProduct as mongoose.Model<ILowestPricesProduct>) || mongoose.model<ILowestPricesProduct>("LowestPricesProduct", LowestPricesProductSchema);

export default LowestPricesProduct;

