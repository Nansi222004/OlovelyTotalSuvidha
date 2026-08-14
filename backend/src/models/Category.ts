import mongoose, { Document, Schema, Model } from "mongoose";

export interface ICategory extends Document {
  name: string;
  slug: string;
  image?: string;
  order: number;
  isBestseller: boolean;
  hasWarning: boolean;
  groupCategory?: string;
  totalSubcategories?: number;
  commissionRate?: number;
  status: "Active" | "Inactive";
  parentId?: mongoose.Types.ObjectId;
  headerCategoryId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  getAllDescendants(): Promise<ICategory[]>;
}

export interface ICategoryModel extends Model<ICategory> {
  validateParentChange(
    categoryId: string,
    newParentId: string | null
  ): Promise<{ valid: boolean; error?: string }>;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
      min: [0, "Order cannot be negative"],
    },
    isBestseller: {
      type: Boolean,
      default: false,
    },
    hasWarning: {
      type: Boolean,
      default: false,
    },
    groupCategory: {
      type: String,
      trim: true,
    },
    totalSubcategories: {
      type: Number,
      default: 0,
      min: [0, "Total subcategories cannot be negative"],
    },
    commissionRate: {
      type: Number,
      default: 0,
      min: [0, "Commission rate cannot be negative"],
      max: [100, "Commission rate cannot exceed 100%"],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    headerCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "HeaderCategory",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
CategorySchema.index({ order: 1 });
CategorySchema.index({ name: 1 });
CategorySchema.index({ slug: 1 });
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ status: 1 });
CategorySchema.index({ headerCategoryId: 1 });
// Compound indexes for common queries
CategorySchema.index({ status: 1, order: 1 }); // For getCategories
CategorySchema.index({ parentId: 1, status: 1 }); // For getCategoryById subcategories

// Virtual for children count
CategorySchema.virtual("childrenCount", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentId",
  count: true,
});

// Virtual for children
CategorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentId",
});

// Ensure virtuals are included in JSON output
CategorySchema.set("toJSON", { virtuals: true });
CategorySchema.set("toObject", { virtuals: true });

// Pre-save middleware to auto-generate slug if not provided
CategorySchema.pre("save", async function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

// Instance method to get all descendants
CategorySchema.methods.getAllDescendants = async function () {
  const CategoryModel = mongoose.model<ICategory>("Category");
  const descendants: ICategory[] = [];
  const children = await CategoryModel.find({ parentId: this._id });

  for (const child of children) {
    descendants.push(child);
    const childDescendants = await (child as ICategory).getAllDescendants();
    descendants.push(...childDescendants);
  }

  return descendants;
};

const Category = (mongoose.models.Category as ICategoryModel) || mongoose.model<ICategory, ICategoryModel>(
  "Category",
  CategorySchema
);

// Static method to validate parent change (prevent circular references)
(Category as any).validateParentChange = async function (
  categoryId: string,
  newParentId: string | null
): Promise<{ valid: boolean; error?: string }> {
  if (!newParentId) {
    return { valid: true };
  }

  // Cannot set parent to self
  if (categoryId === newParentId) {
    return {
      valid: false,
      error: "Cannot set category as its own parent",
    };
  }

  // Check if new parent exists
  const newParent = await Category.findById(newParentId);
  if (!newParent) {
    return {
      valid: false,
      error: "Parent category not found",
    };
  }

  // Check if new parent is active
  if (newParent.status !== "Active") {
    return {
      valid: false,
      error: "Parent category must be active",
    };
  }

  // Check for circular reference: new parent cannot be a descendant
  const category = await Category.findById(categoryId);
  if (category) {
    const descendants = await category.getAllDescendants();
    const isDescendant = descendants.some(
      (desc: any) => desc._id.toString() === newParentId
    );
    if (isDescendant) {
      return {
        valid: false,
        error:
          "Cannot create circular reference: parent cannot be a descendant",
      };
    }
  }

  return { valid: true };
};

export default Category;
