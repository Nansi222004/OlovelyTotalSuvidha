import mongoose, { Schema, Document } from "mongoose";

export interface IBestsellerCard extends Document {
    name: string;
    category: mongoose.Types.ObjectId;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const BestsellerCardSchema = new Schema<IBestsellerCard>(
    {
        name: {
            type: String,
            required: [true, "Bestseller card name is required"],
            trim: true,
            maxlength: [100, "Name cannot exceed 100 characters"],
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: [true, "Category is required"],
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
BestsellerCardSchema.index({ order: 1, isActive: 1 });
BestsellerCardSchema.index({ category: 1 });
BestsellerCardSchema.index({ isActive: 1 });

const BestsellerCard = (mongoose.models.BestsellerCard as mongoose.Model<IBestsellerCard>) || mongoose.model<IBestsellerCard>("BestsellerCard", BestsellerCardSchema);

export default BestsellerCard;

