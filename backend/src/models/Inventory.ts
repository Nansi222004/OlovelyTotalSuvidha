import mongoose, { Document, Schema } from "mongoose";

export interface IInventory extends Document {
  product: mongoose.Types.ObjectId;
  seller: mongoose.Types.ObjectId;

  // Stock Levels
  currentStock: number;
  reservedStock: number; // Stock reserved for pending orders
  availableStock: number; // currentStock - reservedStock

  // Thresholds
  lowStockThreshold: number;
  reorderLevel: number;

  // Location
  warehouse?: string;
  location?: string;

  // Tracking
  lastRestockedAt?: Date;
  lastSoldAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
      unique: true, // One inventory record per product
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: [true, "Seller is required"],
    },

    // Stock Levels
    currentStock: {
      type: Number,
      required: [true, "Current stock is required"],
      default: 0,
      min: [0, "Current stock cannot be negative"],
    },
    reservedStock: {
      type: Number,
      default: 0,
      min: [0, "Reserved stock cannot be negative"],
    },
    availableStock: {
      type: Number,
      default: 0,
      min: [0, "Available stock cannot be negative"],
    },

    // Thresholds
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, "Low stock threshold cannot be negative"],
    },
    reorderLevel: {
      type: Number,
      default: 5,
      min: [0, "Reorder level cannot be negative"],
    },

    // Location
    warehouse: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },

    // Tracking
    lastRestockedAt: {
      type: Date,
    },
    lastSoldAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate available stock before saving
InventorySchema.pre("save", function (next) {
  this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
  next();
});

// Indexes for faster queries
InventorySchema.index({ product: 1 });
InventorySchema.index({ seller: 1 });
InventorySchema.index({ currentStock: 1 });

const Inventory = (mongoose.models.Inventory as mongoose.Model<IInventory>) || mongoose.model<IInventory>("Inventory", InventorySchema);

export default Inventory;
