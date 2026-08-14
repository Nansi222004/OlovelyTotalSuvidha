import mongoose, { Schema, model, Document } from "mongoose";

export interface IFAQ extends Document {
    question: string;
    answer: string;
    category?: string;
    order: number;
    status: "Active" | "Inactive";
    createdAt: Date;
    updatedAt: Date;
}

const faqSchema = new Schema<IFAQ>(
    {
        question: {
            type: String,
            required: [true, "Question is required"],
            trim: true,
        },
        answer: {
            type: String,
            required: [true, "Answer is required"],
            trim: true,
        },
        category: {
            type: String,
            trim: true,
            default: "General",
        },
        order: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active",
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
faqSchema.index({ status: 1, order: 1 });
faqSchema.index({ category: 1 });

const FAQ = mongoose.models.FAQ || model<IFAQ>("FAQ", faqSchema);

export default FAQ;
