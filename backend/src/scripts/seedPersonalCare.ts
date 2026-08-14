import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";
import SubCategory from "../models/SubCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../seed_personal_care.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/public");

log("Starting Personal Care Seed Script");
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
    log(`Warning: File not found: ${fullPath}, using path as-is`);
    return localPath.startsWith("http")
      ? localPath
      : `/assets/${path.basename(localPath)}`;
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
      : `/assets/${path.basename(localPath)}`;
  }
}

// Personal Care Subcategories Data
const subcategoriesData = [
  {
    name: "Hair Care",
    slug: "hair-care",
    image: "/assets/category-personal-care.png",
    order: 1,
  },
  {
    name: "Skin Care",
    slug: "skin-care",
    image: "/assets/category-personal-care.png",
    order: 2,
  },
  {
    name: "Oral Care",
    slug: "oral-care",
    image: "/assets/category-personal-care.png",
    order: 3,
  },
  {
    name: "Body Care",
    slug: "body-care",
    image: "/assets/category-personal-care.png",
    order: 4,
  },
  {
    name: "Men's Grooming",
    slug: "mens-grooming",
    image: "/assets/category-personal-care.png",
    order: 5,
  },
  {
    name: "Women's Care",
    slug: "womens-care",
    image: "/assets/category-personal-care.png",
    order: 6,
  },
  {
    name: "Baby Care",
    slug: "baby-care",
    image: "/assets/category-baby-care.png",
    order: 7,
  },
  {
    name: "Deodorants & Fragrances",
    slug: "deodorants-fragrances",
    image: "/assets/category-personal-care.png",
    order: 8,
  },
  {
    name: "Health & Wellness",
    slug: "health-wellness",
    image: "/assets/category-pharma-&-wellness.png",
    order: 9,
  },
  {
    name: "Beauty Accessories",
    slug: "beauty-accessories",
    image: "/assets/category-personal-care.png",
    order: 10,
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Create or Find "Personal Care" Category
    log('Creating/Updating "Personal Care" category...');
    let categoryImage = "/assets/category-personal-care.png"; // Default image
    if (
      fs.existsSync(
        path.join(FRONTEND_ASSETS_PATH, "category-personal-care.png")
      )
    ) {
      const uploadedUrl = await uploadToCloudinary(categoryImage, "categories");
      if (uploadedUrl) categoryImage = uploadedUrl;
    }

    const personalCareCategory = await Category.findOneAndUpdate(
      { slug: "personal-care" },
      {
        name: "Personal Care",
        slug: "personal-care",
        image: categoryImage,
        order: 0,
        status: "Active",
        isBestseller: true,
        hasWarning: false,
        totalSubcategories: subcategoriesData.length,
      },
      { upsert: true, new: true }
    );

    log(
      `Category created/updated: ${personalCareCategory.name} (${personalCareCategory._id})`
    );

    // 2. Create Subcategories
    log("Creating subcategories...");
    const createdSubcategories = [];

    for (const subcatData of subcategoriesData) {
      let subcatImage = subcatData.image;

      // Upload image to Cloudinary if available
      if (subcatImage && !subcatImage.startsWith("http")) {
        const uploadedUrl = await uploadToCloudinary(
          subcatImage,
          "subcategories"
        );
        if (uploadedUrl) subcatImage = uploadedUrl;
      }

      const subcategory = await SubCategory.findOneAndUpdate(
        {
          name: subcatData.name,
          category: personalCareCategory._id,
        },
        {
          name: subcatData.name,
          category: personalCareCategory._id,
          image: subcatImage,
          order: subcatData.order,
        },
        { upsert: true, new: true }
      );

      createdSubcategories.push(subcategory);
      log(
        `Created/Updated subcategory: ${subcategory.name} (order: ${subcategory.order})`
      );
    }

    // 3. Update category's totalSubcategories count
    await Category.findByIdAndUpdate(personalCareCategory._id, {
      totalSubcategories: createdSubcategories.length,
    });

    log("\n✅ Seeding completed successfully!");
    log(`\nSummary:`);
    log(`- Category: ${personalCareCategory.name}`);
    log(`- Subcategories created: ${createdSubcategories.length}`);
    log(`\nSubcategories:`);
    createdSubcategories.forEach((sub, index) => {
      log(`  ${index + 1}. ${sub.name} (order: ${sub.order})`);
    });

    process.exit(0);
  } catch (error: any) {
    log(`❌ Seeding failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

seed();

