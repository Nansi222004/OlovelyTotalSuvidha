import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";
import SubCategory from "../models/SubCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../seed_grocery_kitchen.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/public");

log("Starting Grocery & Kitchen Seed Script");
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

// Grocery & Kitchen Subcategories Data
const subcategoriesData = [
  {
    name: "Atta, Rice & Dal",
    slug: "atta-rice-dal",
    image: "/assets/category-atta-rice.png",
    order: 1,
  },
  {
    name: "Masala & Spices",
    slug: "masala-spices",
    image: "/assets/category-masala.png",
    order: 2,
  },
  {
    name: "Cooking Oil & Ghee",
    slug: "cooking-oil-ghee",
    image: "/assets/category-masala.png", // Using masala image as placeholder
    order: 3,
  },
  {
    name: "Pulses & Lentils",
    slug: "pulses-lentils",
    image: "/assets/category-atta-rice.png", // Using atta-rice image as placeholder
    order: 4,
  },
  {
    name: "Sugar & Sweeteners",
    slug: "sugar-sweeteners",
    image: "/assets/category-sweet-tooth.png",
    order: 5,
  },
  {
    name: "Salt & Condiments",
    slug: "salt-condiments",
    image: "/assets/category-masala.png",
    order: 6,
  },
  {
    name: "Flour & Baking",
    slug: "flour-baking",
    image: "/assets/category-biscuits.png",
    order: 7,
  },
  {
    name: "Dry Fruits & Nuts",
    slug: "dry-fruits-nuts",
    image: "/assets/category-organic-&-healthy-living.png", // Note: File has & in name
    order: 8,
  },
  {
    name: "Kitchenware & Utensils",
    slug: "kitchenware-utensils",
    image: "/assets/category-cleaning.png", // Using cleaning image as placeholder
    order: 9,
  },
  {
    name: "Pickles & Preserves",
    slug: "pickles-preserves",
    image: "/assets/category-sauces-&-spreads.png",
    order: 10,
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Create or Find "Grocery & Kitchen" Category
    log('Creating/Updating "Grocery & Kitchen" category...');
    let categoryImage = "/assets/category-atta-rice.png"; // Default image
    if (
      fs.existsSync(path.join(FRONTEND_ASSETS_PATH, "category-atta-rice.png"))
    ) {
      const uploadedUrl = await uploadToCloudinary(categoryImage, "categories");
      if (uploadedUrl) categoryImage = uploadedUrl;
    }

    const groceryKitchenCategory = await Category.findOneAndUpdate(
      { slug: "grocery-kitchen" },
      {
        name: "Grocery & Kitchen",
        slug: "grocery-kitchen",
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
      `Category created/updated: ${groceryKitchenCategory.name} (${groceryKitchenCategory._id})`
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
          category: groceryKitchenCategory._id,
        },
        {
          name: subcatData.name,
          category: groceryKitchenCategory._id,
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
    await Category.findByIdAndUpdate(groceryKitchenCategory._id, {
      totalSubcategories: createdSubcategories.length,
    });

    log("\n✅ Seeding completed successfully!");
    log(`\nSummary:`);
    log(`- Category: ${groceryKitchenCategory.name}`);
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

