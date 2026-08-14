import mongoose, { Document, Schema } from "mongoose";

export interface IPolicy extends Document {
    type: "customer" | "delivery";
    title: string;
    content: string;
    version: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const PolicySchema = new Schema<IPolicy>(
    {
        type: {
            type: String,
            enum: ["customer", "delivery"],
            required: [true, "Policy type is required"],
        },
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
        },
        content: {
            type: String,
            required: [true, "Content is required"],
        },
        version: {
            type: String,
            required: [true, "Version is required"],
            trim: true,
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

// Ensure only one active policy per type if needed, but for now allow multiple and filter by active
// Or maybe unique compound index if we want unique versions?
// Leaving standard for now.

const Policy = mongoose.models.Policy || mongoose.model<IPolicy>("Policy", PolicySchema);

export default Policy;
