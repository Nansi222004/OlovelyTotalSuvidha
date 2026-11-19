import mongoose, { Schema, model, Document } from "mongoose";

export interface IFAQ extends Document {
    question: string;
    answer: string;
    category?: string;
    /** Which app shows this FAQ. Missing on old documents = customer. */
    audience: "customer" | "seller" | "delivery";
    order: number;
    status: "Active" | "Inactive";
    translations?: Record<string, Record<string, string>>;
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
        audience: {
            type: String,
            enum: ["customer", "seller", "delivery"],
            default: "customer",
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
        translations: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
faqSchema.index({ status: 1, order: 1 });
faqSchema.index({ category: 1 });
faqSchema.index({ audience: 1, status: 1, order: 1 });

export const FAQ_AUDIENCES = ["customer", "seller", "delivery"] as const;
export type FAQAudience = (typeof FAQ_AUDIENCES)[number];

/** Query for the active FAQs of one app. Old FAQs without an audience belong to customers. */
export const activeFaqQuery = (audience: FAQAudience) =>
    audience === "customer"
        ? { status: "Active", audience: { $in: ["customer", null] } }
        : { status: "Active", audience };

const FAQ = mongoose.models.FAQ || model<IFAQ>("FAQ", faqSchema);

export default FAQ;
