import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../update_grocery_subcategory_images.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/assets");
const SUB_CATEGORY_IMAGES_PATH = path.join(
  FRONTEND_ASSETS_PATH,
  "Image-20251130T081301Z-1-001",
  "Image",
  "sub category"
);

log("Starting Update Grocery Subcategory Images Script");
log(`MONGO_URI: ${MONGO_URI}`);
log(`SUB_CATEGORY_IMAGES_PATH: ${SUB_CATEGORY_IMAGES_PATH}`);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Category name to folder name mapping (some category names might differ from folder names)
const categoryFolderMap: { [key: string]: string } = {
  "Vegetables & Fruits": "Fruits & Vegetables",
  "Dairy, Bread & Eggs": "Dairy, Bread & Eggs",
  "Munchies": "Snacks & Munchies",
  "Cold Drinks & Juices": "Cold Drinks & Juices",
  "Breakfast & Instant Food": "Breakfast & Instant Food",
  "Sweet Tooth": "Sweet Tooth",
  "Bakery & Biscuits": "Bakery  Biscuits", // Note: folder has double space
  "Tea, Coffee & More": "Tea, Coffee & Health Drink",
  "Atta, Rice & Dal": "Atta, Rice & Dal",
  "Masala, Oil & More": "Masala, Oil & More",
  "Sauces & Spreads": "Sauces & Spreads",
  "Chicken, Meat & Fish": "Chicken, Meat & Fish",
  "Organic & Healthy Living": "Organic & Healthy Living",
  "Baby Care": "Baby Care",
  "Pharma & Wellness": "Pharma & Wellness",
  "Cleaning Essentials": "Cleaning Essentials",
  "Personal Care": "Personal Care",
  "Home & Office": "Home & Office",
  "Pet Care": "Pet Care",
};

// Subcategory name to image file name mapping (for cases where names don't match exactly)
const subcategoryImageMap: { [key: string]: string | null } = {
  // Vegetables & Fruits
  "Fresh Vegetables": "Fresh Vegetables.png",
  "Fresh Fruits": "Fresh Fruits.png",
  "Leafy & Herbs": "Leafies & Herbs.png", // Note: folder has "Leafies" not "Leafy"
  "Exotic": null, // No exact match found, will try fuzzy matching

  // Dairy, Bread & Eggs
  "Milk": "Milk.webp",
  "Curd & Paneer": "Curd & Yogurt.jpg", // Closest match
  "Bread & Buns": "Bread & Pav.webp", // Closest match
  "Eggs": "Eggs.webp",

  // Atta, Rice & Dal
  "Atta & Flour": "Atta.jpg",
  "Rice": "Rice.webp",
  "Dal & Pulses": "Toor, Urad & Chana.webp", // Closest match

  // Add more mappings as needed
};

// Grocery Categories Data Structure
const groceryCategoriesData = [
  {
    name: "Vegetables & Fruits",
    subcategories: ["Fresh Vegetables", "Fresh Fruits", "Leafy & Herbs", "Exotic"],
  },
  {
    name: "Dairy, Bread & Eggs",
    subcategories: ["Milk", "Curd & Paneer", "Bread & Buns", "Eggs"],
  },
  {
    name: "Munchies",
    subcategories: ["Chips & Namkeen", "Biscuits", "Chocolates", "Indian Snacks"],
  },
  {
    name: "Cold Drinks & Juices",
    subcategories: ["Soft Drinks", "Fruit Juices", "Energy Drinks", "Water"],
  },
  {
    name: "Breakfast & Instant Food",
    subcategories: ["Instant Meals", "Spreads"],
  },
  {
    name: "Sweet Tooth",
    subcategories: ["Indian Sweets", "Desserts", "Baking Needs"],
  },
  {
    name: "Bakery & Biscuits",
    subcategories: ["Cakes", "Cookies", "Rusks"],
  },
  {
    name: "Tea, Coffee & More",
    subcategories: ["Tea", "Coffee", "Health Drinks"],
  },
  {
    name: "Atta, Rice & Dal",
    subcategories: ["Atta & Flour", "Rice", "Dal & Pulses"],
  },
  {
    name: "Masala, Oil & More",
    subcategories: ["Whole Spices", "Powdered Spices", "Cooking Oil"],
  },
  {
    name: "Sauces & Spreads",
    subcategories: ["Sauces", "Pickles", "Chutney"],
  },
  {
    name: "Chicken, Meat & Fish",
    subcategories: ["Chicken", "Mutton", "Fish"],
  },
  {
    name: "Organic & Healthy Living",
    subcategories: ["Organic Staples", "Dry Fruits", "Seeds"],
  },
  {
    name: "Baby Care",
    subcategories: ["Diapers", "Baby Food", "Baby Hygiene"],
  },
  {
    name: "Pharma & Wellness",
    subcategories: ["OTC Medicines", "Vitamins", "First Aid"],
  },
  {
    name: "Cleaning Essentials",
    subcategories: ["Home Cleaning", "Laundry", "Dishwash"],
  },
  {
    name: "Personal Care",
    subcategories: ["Bath & Body", "Hair Care", "Oral Care"],
  },
  {
    name: "Home & Office",
    subcategories: ["Kitchenware", "Stationery", "Electrical"],
  },
  {
    name: "Pet Care",
    subcategories: ["Pet Food", "Pet Hygiene"],
  },
];

// Helper function to normalize strings for comparison
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Helper function to find best matching image file
function findBestMatchImage(
  subcategoryName: string,
  imageFiles: string[]
): string | null {
  // First, check if there's an exact mapping
  if (subcategoryImageMap[subcategoryName]) {
    const mappedFile = subcategoryImageMap[subcategoryName];
    if (mappedFile && imageFiles.includes(mappedFile)) {
      return mappedFile;
    }
  }

  // Try exact match (case-insensitive, ignoring extension)
  const normalizedSubcat = normalizeString(subcategoryName);
  for (const file of imageFiles) {
    const fileNameWithoutExt = path.parse(file).name;
    if (normalizeString(fileNameWithoutExt) === normalizedSubcat) {
      return file;
    }
  }

  // Try partial match - check if subcategory keywords are in filename
  const subcatWords = subcategoryName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const file of imageFiles) {
    const fileNameWithoutExt = path.parse(file).name.toLowerCase();
    let score = 0;

    for (const word of subcatWords) {
      if (fileNameWithoutExt.includes(word)) {
        score += word.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = file;
    }
  }

  // Only return if we have a reasonable match (at least one significant word matched)
  return bestScore > 3 ? bestMatch : null;
}

// Helper to upload to Cloudinary
async function uploadToCloudinary(
  localPath: string,
  folder: string = "subcategories"
): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    log("Cloudinary not configured, using local path");
    // Return relative path from frontend/assets
    const relativePath = path.relative(FRONTEND_ASSETS_PATH, localPath);
    return `/${relativePath.replace(/\\/g, "/")}`;
  }

  if (!fs.existsSync(localPath)) {
    log(`Warning: File not found: ${localPath}`);
    return null;
  }

  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder: folder,
      resource_type: "image",
    });
    log(`Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error: any) {
    log(`Cloudinary upload failed: ${error.message}, using local path`);
    const relativePath = path.relative(FRONTEND_ASSETS_PATH, localPath);
    return `/${relativePath.replace(/\\/g, "/")}`;
  }
}

async function updateSubcategoryImages() {
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

    // 2. Process each category and its subcategories
    for (const categoryData of groceryCategoriesData) {
      log(`\n--- Processing Category: ${categoryData.name} ---`);

      // Find the main category
      const mainCategory = await Category.findOne({
        name: categoryData.name,
        headerCategoryId: headerCategory._id,
        parentId: null,
      });

      if (!mainCategory) {
        log(`Category "${categoryData.name}" not found, skipping...`);
        totalNotFound++;
        continue;
      }

      // Get the folder name for this category
      const categoryFolderName = categoryFolderMap[categoryData.name] || categoryData.name;
      const categoryFolderPath = path.join(SUB_CATEGORY_IMAGES_PATH, categoryFolderName);

      // Check if folder exists
      if (!fs.existsSync(categoryFolderPath)) {
        log(`Folder not found: ${categoryFolderName}, skipping category...`);
        totalSkipped++;
        continue;
      }

      // Get all image files in the category folder
      const imageFiles = fs
        .readdirSync(categoryFolderPath)
        .filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
        });

      if (imageFiles.length === 0) {
        log(`No image files found in folder: ${categoryFolderName}, skipping...`);
        totalSkipped++;
        continue;
      }

      log(`Found ${imageFiles.length} image files in folder: ${categoryFolderName}`);

      // Process each subcategory
      for (const subcategoryName of categoryData.subcategories) {
        log(`  Processing subcategory: ${subcategoryName}`);

        // Find the subcategory
        const subcategory = await Category.findOne({
          name: subcategoryName,
          parentId: mainCategory._id,
        });

        if (!subcategory) {
          log(`  Subcategory "${subcategoryName}" not found, skipping...`);
          totalNotFound++;
          continue;
        }

        // Find best matching image file
        const matchedImageFile = findBestMatchImage(subcategoryName, imageFiles);

        if (!matchedImageFile) {
          log(`  No matching image found for "${subcategoryName}", skipping...`);
          totalSkipped++;
          continue;
        }

        log(`  Found matching image: ${matchedImageFile}`);

        // Get full path to image file
        const imageFilePath = path.join(categoryFolderPath, matchedImageFile);

        // Upload to Cloudinary or use local path
        const imageUrl = await uploadToCloudinary(imageFilePath, "subcategories");

        if (!imageUrl) {
          log(`  Failed to process image: ${matchedImageFile}, skipping...`);
          totalSkipped++;
          continue;
        }

        // Update subcategory image
        await Category.findByIdAndUpdate(subcategory._id, {
          image: imageUrl,
          updatedAt: new Date(),
        });

        totalUpdated++;
        log(`  ✅ Updated image for "${subcategoryName}" -> ${imageUrl}`);
      }
    }

    log("\n✅ Update completed successfully!");
    log(`\nSummary:`);
    log(`- Header category: ${headerCategory.name}`);
    log(`- Subcategories updated: ${totalUpdated}`);
    log(`- Subcategories skipped (image not found): ${totalSkipped}`);
    log(`- Subcategories not found in database: ${totalNotFound}`);

    process.exit(0);
  } catch (error: any) {
    log(`❌ Update failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

updateSubcategoryImages();


