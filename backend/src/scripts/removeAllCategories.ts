import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import Category from "../models/Category";
import SubCategory from "../models/SubCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../remove_all_categories.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";

log("Starting Remove All Categories Script");
log(`MONGO_URI: ${MONGO_URI}`);

async function removeAllCategories() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Count existing categories and subcategories
    const categoryCount = await Category.countDocuments();
    const subcategoryCount = await SubCategory.countDocuments();

    log(`\nFound:`);
    log(`- Categories: ${categoryCount}`);
    log(`- SubCategories (old model): ${subcategoryCount}`);

    if (categoryCount === 0 && subcategoryCount === 0) {
      log("\nNo categories or subcategories found. Nothing to delete.");
      process.exit(0);
    }

    // 2. Delete all subcategories first (old model)
    if (subcategoryCount > 0) {
      log("\nDeleting all SubCategories (old model)...");
      const subcategoryResult = await SubCategory.deleteMany({});
      log(`Deleted ${subcategoryResult.deletedCount} SubCategories`);
    }

    // 3. Delete all categories (this will delete both root categories and subcategories)
    // Since subcategories are also stored as Category with parentId set
    if (categoryCount > 0) {
      log("\nDeleting all Categories...");
      const categoryResult = await Category.deleteMany({});
      log(`Deleted ${categoryResult.deletedCount} Categories`);
    }

    // 4. Verify deletion
    const remainingCategories = await Category.countDocuments();
    const remainingSubcategories = await SubCategory.countDocuments();

    log("\n✅ Deletion completed!");
    log(`\nSummary:`);
    log(`- Categories deleted: ${categoryCount}`);
    log(`- SubCategories (old model) deleted: ${subcategoryCount}`);
    log(`- Remaining Categories: ${remainingCategories}`);
    log(`- Remaining SubCategories: ${remainingSubcategories}`);

    if (remainingCategories === 0 && remainingSubcategories === 0) {
      log(
        "\n✅ All categories and subcategories have been successfully removed!"
      );
    } else {
      log("\n⚠️  Warning: Some categories or subcategories may still exist.");
    }

    process.exit(0);
  } catch (error: any) {
    log(`❌ Deletion failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

removeAllCategories();


