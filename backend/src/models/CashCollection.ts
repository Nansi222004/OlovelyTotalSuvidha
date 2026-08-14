import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface ICashCollection extends Document {
    deliveryBoy: Types.ObjectId;
    order: Types.ObjectId;
    amount: number;
    remark?: string;
    status: "Pending" | "Collected";
    collectedBy?: Types.ObjectId;
    collectedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const cashCollectionSchema = new Schema<ICashCollection>(
    {
        deliveryBoy: {
            type: Schema.Types.ObjectId,
            ref: "Delivery",
            required: [true, "Delivery boy is required"],
        },
        order: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            required: [true, "Order is required"],
        },
        amount: {
            type: Number,
            required: [true, "Amount is required"],
            min: [0, "Amount cannot be negative"],
        },
        remark: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ["Pending", "Collected"],
            default: "Pending",
        },
        collectedBy: {
            type: Schema.Types.ObjectId,
            ref: "Admin",
            required: false, // Optional until status is Collected
        },
        collectedAt: {
            type: Date,
            required: false, // Optional until status is Collected
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
cashCollectionSchema.index({ deliveryBoy: 1, collectedAt: -1 });
cashCollectionSchema.index({ order: 1 });
cashCollectionSchema.index({ collectedAt: -1 });

const CashCollection = mongoose.models.CashCollection || model<ICashCollection>(
    "CashCollection",
    cashCollectionSchema
);

export default CashCollection;
