import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../update_grocery_category_images.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/assets");

log("Starting Update Grocery Category Images Script");
log(`MONGO_URI: ${MONGO_URI}`);
log(`FRONTEND_ASSETS_PATH: ${FRONTEND_ASSETS_PATH}`);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Category name to image file mapping
const categoryImageMap: { [key: string]: string } = {
  "Vegetables & Fruits": "Fruits & Vegetables.png",
  "Dairy, Bread & Eggs": "Dairy, Bread & Eggs.png",
  "Munchies": "Snacks & Munchies.png",
  "Cold Drinks & Juices": "Cold Drinks & Juices.png",
  "Breakfast & Instant Food": "Breakfast & Instant Food.png",
  "Sweet Tooth": "Sweet Tooth.png",
  "Bakery & Biscuits": "Bakery & Biscuits.png",
  "Tea, Coffee & More": "Tea, Coffe & Health Drink.png",
  "Atta, Rice & Dal": "Atta, Rice & Dal.png",
  "Masala, Oil & More": "Masala, Oil & More.png",
  "Sauces & Spreads": "Sauces & Spreads.png",
  "Chicken, Meat & Fish": "Chicken, Meat & Fish.png",
  "Organic & Healthy Living": "Organic & Healthy Living.png",
  "Baby Care": "Baby Care.png",
  "Pharma & Wellness": "Pharma & Wellness.png",
  "Cleaning Essentials": "Cleaning Essentials.png",
  "Personal Care": "Personal Care.png",
  "Home & Office": "Home & Office.png",
  "Pet Care": "Pet Care.png",
};

// Helper to upload to Cloudinary
async function uploadToCloudinary(
  localPath: string,
  folder: string = "categories"
): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    log("Cloudinary not configured, using local path");
    return localPath.startsWith("http")
      ? localPath
      : `/assets/category/${path.basename(localPath)}`;
  }

  const fullPath = path.join(FRONTEND_ASSETS_PATH, "category", path.basename(localPath));

  if (!fs.existsSync(fullPath)) {
    log(`Warning: File not found: ${fullPath}, using path as-is`);
    return localPath.startsWith("http")
      ? localPath
      : `/assets/category/${path.basename(localPath)}`;
  }

  try {
    const result = await cloudinary.uploader.upload(fullPath, {
      folder: folder,
      resource_type: "image",
    });
    log(`Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error: any) {
    log(`Cloudinary upload failed: ${error.message}, using local path`);
    return localPath.startsWith("http")
      ? localPath
      : `/assets/category/${path.basename(localPath)}`;
  }
}

async function updateCategoryImages() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Find "Grocery" header category
    const headerCategory = await HeaderCategory.findOne({
      $or: [{ name: "Grocery" }, { slug: "grocery" }],
    });

    if (!headerCategory) {
      log('❌ Header category "Grocery" not found.');
      process.exit(1);
    }

    log(`Found header category: ${headerCategory.name} (${headerCategory._id})`);

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalNotFound = 0;

    // 2. Process each category
    for (const [categoryName, imageFileName] of Object.entries(categoryImageMap)) {
      log(`\n--- Processing Category: ${categoryName} ---`);

      // Find the category
      const category = await Category.findOne({
        name: categoryName,
        headerCategoryId: headerCategory._id,
        parentId: null, // Only root categories
      });

      if (!category) {
        log(`Category "${categoryName}" not found, skipping...`);
        totalNotFound++;
        continue;
      }

      log(`Found category: ${categoryName} (${category._id})`);

      // Check if image file exists
      const imagePath = path.join(FRONTEND_ASSETS_PATH, "category", imageFileName);

      if (!fs.existsSync(imagePath)) {
        log(`Image file not found: ${imageFileName}, skipping...`);
        totalSkipped++;
        continue;
      }

      // Upload to Cloudinary or use local path
      const imageUrl = await uploadToCloudinary(imageFileName, "categories");

      if (!imageUrl) {
        log(`Failed to process image: ${imageFileName}, skipping...`);
        totalSkipped++;
        continue;
      }

      // Update category image
      await Category.findByIdAndUpdate(category._id, {
        image: imageUrl,
        updatedAt: new Date(),
      });

      totalUpdated++;
      log(`✅ Updated image for "${categoryName}" -> ${imageUrl}`);
    }

    log("\n✅ Update completed successfully!");
    log(`\nSummary:`);
    log(`- Header category: ${headerCategory.name}`);
    log(`- Categories updated: ${totalUpdated}`);
    log(`- Categories skipped (image not found): ${totalSkipped}`);
    log(`- Categories not found in database: ${totalNotFound}`);
    log(`\nTotal categories processed: ${Object.keys(categoryImageMap).length}`);

    process.exit(0);
  } catch (error: any) {
    log(`❌ Update failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

updateCategoryImages();


