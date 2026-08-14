import mongoose, { Document, Schema } from 'mongoose';

export interface IShop extends Document {
  name: string;
  storeId: string; // slug/identifier for the store
  image: string;
  description?: string;
  headerCategoryId?: mongoose.Types.ObjectId; // Reference to HeaderCategory
  category?: mongoose.Types.ObjectId | mongoose.Types.ObjectId[]; // Reference to Category(s) - supports both single and array
  subCategory?: mongoose.Types.ObjectId | mongoose.Types.ObjectId[]; // Reference to SubCategory(s) - supports both single and array
  subSubCategory?: mongoose.Types.ObjectId | mongoose.Types.ObjectId[]; // Reference to Sub-SubCategory(s) - supports both single and array
  products: mongoose.Types.ObjectId[];
  order: number; // For sorting/ordering
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShopSchema = new Schema<IShop>(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
    },
    storeId: {
      type: String,
      required: [true, 'Store ID is required'],
      trim: true,
      unique: true,
      lowercase: true,
    },
    image: {
      type: String,
      required: [true, 'Shop image is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    headerCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'HeaderCategory',
    },
    category: {
      type: Schema.Types.Mixed, // Supports both single ObjectId and array of ObjectIds
      ref: 'Category',
    },
    subCategory: {
      type: Schema.Types.Mixed, // Supports both single ObjectId and array of ObjectIds
      ref: 'SubCategory',
    },
    subSubCategory: {
      type: Schema.Types.Mixed, // Supports both single ObjectId and array of ObjectIds
      ref: 'Category', // Sub-subcategories are also Category documents with parentId
    },
    products: [{
      type: Schema.Types.ObjectId,
      ref: 'Product',
    }],
    order: {
      type: Number,
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

// Generate storeId from name if not provided
ShopSchema.pre('save', function (next) {
  if (!this.storeId && this.name) {
    this.storeId = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

const Shop = (mongoose.models.Shop as mongoose.Model<IShop>) || mongoose.model<IShop>('Shop', ShopSchema);

export default Shop;
