import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(
  __dirname,
  "../../seed_categories_under_header_categories.log"
);
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/public");

log("Starting Categories Under Header Categories Seed Script");
log(`MONGO_URI: ${MONGO_URI}`);
log(`FRONTEND_ASSETS_PATH: ${FRONTEND_ASSETS_PATH}`);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper to upload to Cloudinary
async function uploadToCloudinary(
  localPath: string,
  folder: string = "categories"
): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    log("Cloudinary not configured, using local path");
    return localPath.startsWith("http")
      ? localPath
      : `/assets/${path.basename(localPath)}`;
  }

  const fullPath = path.join(
    FRONTEND_ASSETS_PATH,
    localPath.replace("/assets/", "")
  );

  if (!fs.existsSync(fullPath)) {
    log(`Warning: File not found: ${fullPath}, using placeholder`);
    return "https://placehold.co/300x300/f5f5f5/737373?text=Category";
  }

  try {
    const result = await cloudinary.uploader.upload(fullPath, {
      folder: folder,
      resource_type: "image",
    });
    log(`Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error: any) {
    log(`Cloudinary upload failed: ${error.message}, using placeholder`);
    return "https://placehold.co/300x300/f5f5f5/737373?text=Category";
  }
}

// Get placeholder image URL
async function getPlaceholderImage(): Promise<string> {
  // Try to use a default category image if available
  const defaultImagePath = "/assets/category-personal-care.png";
  const fullPath = path.join(
    FRONTEND_ASSETS_PATH,
    defaultImagePath.replace("/assets/", "")
  );

  if (fs.existsSync(fullPath)) {
    const uploadedUrl = await uploadToCloudinary(
      defaultImagePath,
      "categories"
    );
    if (uploadedUrl) return uploadedUrl;
  }

  // Fallback to placeholder service
  return "https://placehold.co/300x300/f5f5f5/737373?text=Category";
}

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Get all Published header categories
    const headerCategories = await HeaderCategory.find({
      status: "Published",
    }).sort({ order: 1 });

    if (headerCategories.length === 0) {
      log(
        "No Published header categories found. Please create header categories first."
      );
      process.exit(0);
    }

    log(`Found ${headerCategories.length} Published header categories`);

    const placeholderImage = await getPlaceholderImage();
    log(`Using placeholder image: ${placeholderImage}`);

    let totalCategoriesCreated = 0;
    let totalSubcategoriesCreated = 0;

    // 2. For each header category, create 4 categories
    for (const headerCategory of headerCategories) {
      log(`\n--- Processing Header Category: ${headerCategory.name} ---`);

      // Check if categories already exist for this header category
      const existingCategories = await Category.find({
        headerCategoryId: headerCategory._id,
        parentId: null, // Root categories only
      });

      if (existingCategories.length > 0) {
        log(
          `Skipping ${headerCategory.name}: ${existingCategories.length} categories already exist`
        );
        continue;
      }

      // Create 4 categories under this header category
      const createdCategories = [];

      for (let i = 1; i <= 4; i++) {
        const categoryName = `${headerCategory.name} Category ${i}`;
        const categorySlug =
          `${headerCategory.slug}-category-${i}`.toLowerCase();

        // Check if category with this name already exists
        const existingCategory = await Category.findOne({
          name: categoryName,
        });

        if (existingCategory) {
          log(`Category "${categoryName}" already exists, skipping...`);
          continue;
        }

        const category = await Category.create({
          name: categoryName,
          slug: categorySlug,
          image: placeholderImage,
          order: i - 1, // 0, 1, 2, 3
          status: "Active",
          isBestseller: false,
          hasWarning: false,
          parentId: null, // Root category
          headerCategoryId: headerCategory._id,
        });

        createdCategories.push(category);
        totalCategoriesCreated++;
        log(
          `Created category: ${categoryName} (order: ${category.order}, slug: ${categorySlug})`
        );
      }

      // 3. For each created category, create 4 subcategories
      for (const category of createdCategories) {
        log(`\n  Creating subcategories for: ${category.name}`);

        for (let j = 1; j <= 4; j++) {
          const subcategoryName = `${category.name} Subcategory ${j}`;
          const subcategorySlug =
            `${category.slug}-subcategory-${j}`.toLowerCase();

          // Check if subcategory with this name already exists
          const existingSubcategory = await Category.findOne({
            name: subcategoryName,
            parentId: category._id,
          });

          if (existingSubcategory) {
            log(
              `  Subcategory "${subcategoryName}" already exists, skipping...`
            );
            continue;
          }

          const subcategory = await Category.create({
            name: subcategoryName,
            slug: subcategorySlug,
            image: placeholderImage,
            order: j - 1, // 0, 1, 2, 3
            status: "Active",
            isBestseller: false,
            hasWarning: false,
            parentId: category._id, // Child of the category
            headerCategoryId: headerCategory._id, // Inherit from parent
          });

          totalSubcategoriesCreated++;
          log(
            `  Created subcategory: ${subcategoryName} (order: ${subcategory.order}, slug: ${subcategorySlug})`
          );
        }
      }
    }

    log("\n✅ Seeding completed successfully!");
    log(`\nSummary:`);
    log(`- Header categories processed: ${headerCategories.length}`);
    log(`- Categories created: ${totalCategoriesCreated}`);
    log(`- Subcategories created: ${totalSubcategoriesCreated}`);
    log(
      `\nTotal items created: ${totalCategoriesCreated + totalSubcategoriesCreated
      }`
    );

    process.exit(0);
  } catch (error: any) {
    log(`❌ Seeding failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

seed();


