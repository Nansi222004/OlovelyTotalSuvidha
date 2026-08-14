import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../seed_sub_subcategories.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/assets");
const PRODUCT_IMAGES_PATH = path.join(
  FRONTEND_ASSETS_PATH,
  "Image-20251130T081301Z-1-001",
  "Image",
  "product",
  "product"
);
const DEFAULT_IMAGE_PATH = path.join(FRONTEND_ASSETS_PATH, "dhakadsnazzy1.png");

log("Starting Sub-Subcategories Seed Script");
log(`MONGO_URI: ${MONGO_URI}`);
log(`FRONTEND_ASSETS_PATH: ${FRONTEND_ASSETS_PATH}`);
log(`PRODUCT_IMAGES_PATH: ${PRODUCT_IMAGES_PATH}`);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Sub-subcategories data structure
const subSubcategoriesData: {
  [categoryName: string]: {
    [subcategoryName: string]: string[];
  };
} = {
  "Vegetables & Fruits": {
    "Fresh Vegetables": ["Potato", "Onion", "Tomato", "Brinjal", "Cauliflower"],
    "Fresh Fruits": ["Apple", "Banana", "Orange", "Papaya", "Pomegranate"],
    "Leafy & Herbs": ["Spinach", "Coriander", "Mint", "Fenugreek"],
    Exotic: ["Broccoli", "Lettuce", "Zucchini"],
  },
  "Dairy, Bread & Eggs": {
    Milk: ["Toned Milk", "Full Cream Milk", "Cow Milk"],
    "Curd & Paneer": ["Curd", "Paneer", "Buttermilk"],
    "Bread & Buns": ["White Bread", "Brown Bread", "Burger Buns"],
    Eggs: ["White Eggs", "Brown Eggs"],
  },
  Munchies: {
    "Chips & Namkeen": ["Potato Chips", "Bhujia", "Mixture"],
    Biscuits: ["Cream Biscuits", "Marie Biscuits"],
    Chocolates: ["Milk Chocolate", "Dark Chocolate"],
    "Indian Snacks": ["Samosa Patti", "Khakhra"],
  },
  "Cold Drinks & Juices": {
    "Soft Drinks": ["Cola", "Orange Drink", "Lemon Drink"],
    "Fruit Juices": ["Mango Juice", "Mixed Fruit Juice"],
    "Energy Drinks": ["Energy Drink Cans"],
    Water: ["Mineral Water", "Sparkling Water"],
  },
  "Breakfast & Instant Food": {
    Cereals: ["Cornflakes", "Oats", "Muesli"],
    "Instant Meals": ["Instant Noodles", "Pasta"],
    Spreads: ["Peanut Butter", "Chocolate Spread"],
  },
  "Sweet Tooth": {
    "Indian Sweets": ["Gulab Jamun", "Rasgulla"],
    Desserts: ["Ice Cream", "Frozen Desserts"],
    "Baking Needs": ["Sugar", "Cocoa Powder"],
  },
  "Bakery & Biscuits": {
    Cakes: ["Tea Cake", "Plum Cake"],
    Cookies: ["Butter Cookies", "Oat Cookies"],
    Rusks: ["Wheat Rusk"],
  },
  "Tea, Coffee & More": {
    Tea: ["Black Tea", "Green Tea"],
    Coffee: ["Instant Coffee", "Filter Coffee"],
    "Health Drinks": ["Protein Drink", "Malt Drink"],
  },
  "Atta, Rice & Dal": {
    "Atta & Flour": ["Wheat Atta", "Multigrain Atta"],
    Rice: ["Basmati Rice", "Boiled Rice"],
    "Dal & Pulses": ["Toor Dal", "Moong Dal", "Chana Dal"],
  },
  "Masala, Oil & More": {
    "Whole Spices": ["Cumin", "Coriander Seeds"],
    "Powdered Spices": ["Turmeric", "Chilli Powder"],
    "Cooking Oil": ["Mustard Oil", "Refined Oil", "Groundnut Oil"],
  },
  "Sauces & Spreads": {
    Sauces: ["Tomato Ketchup", "Chilli Sauce"],
    Pickles: ["Mango Pickle", "Mixed Pickle"],
    Chutney: ["Coconut Chutney"],
  },
  "Chicken, Meat & Fish": {
    Chicken: ["Whole Chicken", "Chicken Curry Cut"],
    Mutton: ["Mutton Curry Cut"],
    Fish: [],
  },
  "Organic & Healthy Living": {
    "Organic Staples": [],
    "Dry Fruits": [],
    Seeds: [],
  },
  "Baby Care": {
    Diapers: [],
    "Baby Food": [],
    "Baby Hygiene": [],
  },
  "Pharma & Wellness": {
    "OTC Medicines": [],
    Vitamins: [],
    "First Aid": [],
  },
  "Cleaning Essentials": {
    "Home Cleaning": [],
    Laundry: [],
    Dishwash: [],
  },
  "Personal Care": {
    "Bath & Body": [],
    "Hair Care": [],
    "Oral Care": [],
  },
  "Home & Office": {
    Kitchenware: [],
    Stationery: [],
    Electrical: [],
  },
  "Pet Care": {
    "Pet Food": [],
    "Pet Hygiene": [],
  },
};

// Category name mapping for folder structure (some names might differ)
const categoryFolderMap: { [key: string]: string } = {
  "Vegetables & Fruits": "Fruits & Vegetables",
  "Dairy, Bread & Eggs": "Dairy, Bread & Eggs",
  Munchies: "Snacks & Munchies",
  "Cold Drinks & Juices": "Cold Drinks & Juices",
  "Breakfast & Instant Food": "Breakfast & Instant Food",
  "Sweet Tooth": "Sweet Tooth",
  "Bakery & Biscuits": "Bakery & Biscuits",
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

// Subcategory name mapping for folder structure
const subcategoryFolderMap: { [key: string]: string } = {
  "Leafy & Herbs": "Leafies & Herbs",
  "Curd & Paneer": "Curd & Yogurt",
  "Bread & Buns": "Bread & Pav",
  "Chips & Namkeen": "Chips & Namkeen", // May need adjustment
  "Fruit Juices": "Fruit Juices", // May need adjustment
  "Instant Meals": "Instant Meals", // May need adjustment
  "Baking Needs": "Baking Needs", // May need adjustment
};

// Helper function to normalize strings for comparison
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Helper function to find best matching product folder/image
function findBestMatchProduct(
  subSubcategoryName: string,
  productFolders: string[]
): string | null {
  // Normalize the sub-subcategory name
  const normalizedName = normalizeString(subSubcategoryName);

  // Try exact match first (case-insensitive)
  for (const folder of productFolders) {
    const normalizedFolder = normalizeString(folder);
    if (normalizedName === normalizedFolder) {
      return folder;
    }
  }

  // Extract significant words from sub-subcategory name (filter out common words)
  const commonWords = new Set([
    "hybrid",
    "fresh",
    "organic",
    "organically",
    "grown",
    "whole",
    "cut",
    "curry",
    "white",
    "brown",
    "red",
    "green",
    "black",
    "instant",
    "frozen",
    "mixed",
    "cream",
    "full",
    "toned",
    "cow",
  ]);

  const nameWords = subSubcategoryName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !commonWords.has(w));

  // If no significant words after filtering, use all words
  const searchWords =
    nameWords.length > 0
      ? nameWords
      : subSubcategoryName
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 2);

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const folder of productFolders) {
    const folderLower = folder.toLowerCase();
    let score = 0;
    let matchedWords = 0;

    // Check if any significant word from sub-subcategory is in folder name
    for (const word of searchWords) {
      if (folderLower.includes(word)) {
        score += word.length * 2; // Weight longer words more
        matchedWords++;
      }
    }

    // Also check if folder name is contained in sub-subcategory name
    const folderWords = folderLower
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2);
    for (const folderWord of folderWords) {
      if (normalizedName.includes(folderWord)) {
        score += folderWord.length;
        matchedWords++;
      }
    }

    // Prefer matches with more matched words
    if (matchedWords > 0 && score > bestScore) {
      bestScore = score;
      bestMatch = folder;
    }
  }

  // Return match if we have a reasonable score (at least one significant word matched)
  return bestScore > 3 ? bestMatch : null;
}

// Helper function to find product image
function findProductImage(
  categoryFolder: string,
  subcategoryFolder: string,
  productFolder: string
): string | null {
  const productPath = path.join(
    PRODUCT_IMAGES_PATH,
    categoryFolder,
    subcategoryFolder,
    productFolder
  );

  if (!fs.existsSync(productPath)) {
    return null;
  }

  // Look for [ProductName].jpg file
  const files = fs.readdirSync(productPath);
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  // First, try to find exact match: [ProductFolderName].jpg
  const exactMatch = `${productFolder}.jpg`;
  if (files.includes(exactMatch)) {
    return path.join(productPath, exactMatch);
  }

  // Try other extensions
  for (const ext of imageExtensions) {
    const fileName = `${productFolder}${ext}`;
    if (files.includes(fileName)) {
      return path.join(productPath, fileName);
    }
  }

  // Try to find any image file (prefer .jpg)
  for (const ext of imageExtensions) {
    const imageFiles = files.filter((f) =>
      f.toLowerCase().endsWith(ext)
    );
    if (imageFiles.length > 0) {
      // Prefer files that match the product name
      const matchingFile = imageFiles.find((f) =>
        normalizeString(f).includes(normalizeString(productFolder))
      );
      if (matchingFile) {
        return path.join(productPath, matchingFile);
      }
      // Otherwise, return the first image
      return path.join(productPath, imageFiles[0]);
    }
  }

  return null;
}

// Helper to upload to Cloudinary
async function uploadToCloudinary(
  localPath: string,
  folder: string = "sub-subcategories"
): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    log("Cloudinary not configured, using local path");
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

// Helper to get default image (dhakadsnazzy1.png)
async function getDefaultImage(): Promise<string> {
  if (!fs.existsSync(DEFAULT_IMAGE_PATH)) {
    log(`Warning: Default image not found at ${DEFAULT_IMAGE_PATH}`);
    return "";
  }

  const uploadedUrl = await uploadToCloudinary(DEFAULT_IMAGE_PATH, "default");
  return uploadedUrl || `/assets/dhakadsnazzy1.png`;
}

// Helper to generate slug from name
function generateSlug(name: string, parentSlug?: string): string {
  let slug = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (parentSlug) {
    slug = `${parentSlug}-${slug}`;
  }

  return slug;
}

// Helper to find or generate unique slug
async function findOrGenerateUniqueSlug(
  baseName: string,
  parentSlug?: string
): Promise<string> {
  let slug = generateSlug(baseName, parentSlug);
  let counter = 1;
  const originalSlug = slug;

  while (true) {
    const existing = await Category.findOne({ slug });

    if (!existing) {
      return slug;
    }

    slug = `${originalSlug}-${counter}`;
    counter++;

    if (counter > 100) {
      throw new Error(
        `Could not generate unique slug for ${baseName} after 100 attempts`
      );
    }
  }
}

async function seedSubSubcategories() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    const defaultImageUrl = await getDefaultImage();
    log(`Default image URL: ${defaultImageUrl}`);

    let totalCreated = 0;
    let totalSkipped = 0;
    let totalNotFound = 0;
    let totalErrors = 0;

    // Process each category
    for (const [categoryName, subcategories] of Object.entries(
      subSubcategoriesData
    )) {
      log(`\n=== Processing Category: ${categoryName} ===`);

      // Find the main category
      const mainCategory = await Category.findOne({
        name: categoryName,
        parentId: null,
        status: "Active",
      });

      if (!mainCategory) {
        log(`Main category "${categoryName}" not found, skipping...`);
        totalNotFound++;
        continue;
      }

      log(`Found main category: ${mainCategory.name} (${mainCategory._id})`);

      // Get category folder name
      const categoryFolder =
        categoryFolderMap[categoryName] || categoryName;

      // Process each subcategory
      for (const [subcategoryName, subSubcategoryNames] of Object.entries(
        subcategories
      )) {
        log(`\n  Processing subcategory: ${subcategoryName}`);

        // Find the subcategory (Category with parentId = mainCategory._id)
        const subcategory = await Category.findOne({
          name: subcategoryName,
          parentId: mainCategory._id,
          status: "Active",
        });

        if (!subcategory) {
          log(`  Subcategory "${subcategoryName}" not found, skipping...`);
          totalNotFound++;
          continue;
        }

        log(`  Found subcategory: ${subcategory.name} (${subcategory._id})`);

        // Get subcategory folder name
        const subcategoryFolder =
          subcategoryFolderMap[subcategoryName] || subcategoryName;

        // Get subcategory slug for child slugs
        const subcategorySlug = subcategory.slug;

        // Check if subcategory folder exists
        const subcategoryPath = path.join(
          PRODUCT_IMAGES_PATH,
          categoryFolder,
          subcategoryFolder
        );

        let productFolders: string[] = [];
        if (fs.existsSync(subcategoryPath)) {
          productFolders = fs
            .readdirSync(subcategoryPath, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);
          log(
            `  Found ${productFolders.length} product folders in ${subcategoryFolder}`
          );
        } else {
          log(
            `  Warning: Subcategory folder not found: ${subcategoryPath}`
          );
        }

        // Process each sub-subcategory
        let order = 1;
        for (const subSubcategoryName of subSubcategoryNames) {
          log(`    Processing sub-subcategory: ${subSubcategoryName}`);

          // Check if already exists
          const existing = await Category.findOne({
            name: subSubcategoryName,
            parentId: subcategory._id,
          });

          if (existing) {
            log(`    Sub-subcategory "${subSubcategoryName}" already exists, skipping...`);
            totalSkipped++;
            continue;
          }

          // Find matching product folder
          let imagePath: string | null = null;
          let productFolder: string | null = null;

          if (productFolders.length > 0) {
            productFolder = findBestMatchProduct(
              subSubcategoryName,
              productFolders
            );

            if (productFolder) {
              log(`    Found matching product folder: ${productFolder}`);
              imagePath = findProductImage(
                categoryFolder,
                subcategoryFolder,
                productFolder
              );
            }
          }

          // If no image found, use default
          if (!imagePath) {
            log(`    No matching product image found, using default image`);
            imagePath = DEFAULT_IMAGE_PATH;
          }

          // Upload image to Cloudinary
          let imageUrl = "";
          if (imagePath && fs.existsSync(imagePath)) {
            const uploaded = await uploadToCloudinary(
              imagePath,
              "sub-subcategories"
            );
            imageUrl = uploaded || "";
          } else if (imagePath === DEFAULT_IMAGE_PATH) {
            imageUrl = defaultImageUrl;
          }

          // Generate slug
          const slug = await findOrGenerateUniqueSlug(
            subSubcategoryName,
            subcategorySlug
          );

          // Create sub-subcategory
          try {
            const subSubcategory = new Category({
              name: subSubcategoryName,
              slug: slug,
              image: imageUrl,
              order: order,
              status: "Active",
              parentId: subcategory._id,
              headerCategoryId: mainCategory.headerCategoryId,
              isBestseller: false,
              hasWarning: false,
            });

            await subSubcategory.save();
            log(
              `    ✅ Created sub-subcategory: ${subSubcategoryName} (slug: ${slug})`
            );
            if (imageUrl) {
              log(`       Image: ${imageUrl}`);
            }
            totalCreated++;
            order++;
          } catch (error: any) {
            log(`    ❌ Error creating sub-subcategory: ${error.message}`);
            totalErrors++;
          }
        }
      }
    }

    log("\n✅ Seed completed successfully!");
    log(`\nSummary:`);
    log(`- Sub-subcategories created: ${totalCreated}`);
    log(`- Sub-subcategories skipped (already exist): ${totalSkipped}`);
    log(`- Categories/subcategories not found: ${totalNotFound}`);
    log(`- Errors: ${totalErrors}`);

    process.exit(0);
  } catch (error: any) {
    log(`❌ Seed failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

// Run the seed function
seedSubSubcategories();


