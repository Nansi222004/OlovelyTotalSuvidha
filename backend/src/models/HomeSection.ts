import mongoose, { Schema, Document } from "mongoose";

export interface IHomeSection extends Document {
    title: string;
    slug: string;
    categories?: mongoose.Types.ObjectId[]; // Changed to array
    subCategories?: mongoose.Types.ObjectId[]; // Changed to array
    products?: mongoose.Types.ObjectId[]; // Manual product selection
    displayType: "subcategories" | "products" | "categories";
    columns: number;
    limit: number;
    pageLocation: "Home Page" | "Header Category Page";
    targetHeaderCategory?: mongoose.Types.ObjectId;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const HomeSectionSchema = new Schema<IHomeSection>(
    {
        title: {
            type: String,
            required: [true, "Section title is required"],
            trim: true,
            maxlength: [100, "Title cannot exceed 100 characters"],
        },
        slug: {
            type: String,
            required: [true, "Slug is required"],
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"],
        },
        categories: {
            type: [{ type: Schema.Types.ObjectId, ref: "Category" }],
            default: [],
        },
        subCategories: {
            type: [{ type: Schema.Types.ObjectId, ref: "SubCategory" }],
            default: [],
        },
        products: {
            type: [{ type: Schema.Types.ObjectId, ref: "Product" }],
            default: [],
        },
        displayType: {
            type: String,
            enum: ["subcategories", "products", "categories"],
            required: [true, "Display type is required"],
            default: "subcategories",
        },
        columns: {
            type: Number,
            required: [true, "Number of columns is required"],
            min: [2, "Minimum 2 columns required"],
            max: [8, "Maximum 8 columns allowed"],
            default: 4,
        },
        limit: {
            type: Number,
            required: [true, "Item limit is required"],
            min: [1, "Minimum 1 item required"],
            max: [100, "Maximum 100 items allowed"],
            validate: {
                validator: function (this: IHomeSection, value: number) {
                    return value <= 100;
                },
                message: "Maximum 100 items allowed",
            },
            default: 8,
        },
        pageLocation: {
            type: String,
            enum: ["Home Page", "Header Category Page"],
            default: "Home Page",
            required: true,
        },
        targetHeaderCategory: {
            type: Schema.Types.ObjectId,
            ref: "HeaderCategory",
        },
        order: {
            type: Number,
            required: [true, "Display order is required"],
            default: 0,
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
HomeSectionSchema.index({ order: 1, isActive: 1 });
HomeSectionSchema.index({ slug: 1 });
HomeSectionSchema.index({ category: 1 });

const HomeSection = (mongoose.models.HomeSection as mongoose.Model<IHomeSection>) || mongoose.model<IHomeSection>("HomeSection", HomeSectionSchema);

export default HomeSection;
