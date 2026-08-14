import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";
import Product from "../models/Product";
import Seller from "../models/Seller";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(
  __dirname,
  "../../seed_products_sub_subcategories.log"
);
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

log("Starting Seed Products for Sub-Subcategories Script");
log(`MONGO_URI: ${MONGO_URI}`);
log(`PRODUCT_IMAGES_PATH: ${PRODUCT_IMAGES_PATH}`);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Category name mapping for folder structure
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

// Subcategory name mapping
const subcategoryFolderMap: { [key: string]: string } = {
  "Leafy & Herbs": "Leafies & Herbs",
  "Curd & Paneer": "Curd & Yogurt",
  "Bread & Buns": "Bread & Pav",
  "Chips & Namkeen": "Chips & Crisps",
  "Fruit Juices": "Fruit Juices",
  "Instant Meals": "Noodles",
  "Baking Needs": "Baking Needs",
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function findBestMatchProducts(
  subSubcategoryName: string,
  productFolders: string[],
  maxProducts: number = 2
): string[] {
  const normalizedName = normalizeString(subSubcategoryName);
  const matches: { folder: string; score: number }[] = [];

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

  const searchWords =
    nameWords.length > 0
      ? nameWords
      : subSubcategoryName
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 2);

  for (const folder of productFolders) {
    const folderLower = folder.toLowerCase();
    let score = 0;
    let matchedWords = 0;

    if (normalizeString(folder) === normalizedName) {
      matches.push({ folder, score: 1000 });
      continue;
    }

    for (const word of searchWords) {
      if (folderLower.includes(word)) {
        score += word.length * 2;
        matchedWords++;
      }
    }

    const folderWords = folderLower
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2);
    for (const folderWord of folderWords) {
      if (normalizedName.includes(folderWord)) {
        score += folderWord.length;
        matchedWords++;
      }
    }

    if (matchedWords > 0 && score > 3) {
      matches.push({ folder, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, maxProducts).map((m) => m.folder);
}

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

  const files = fs.readdirSync(productPath);
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  const exactMatch = `${productFolder}.jpg`;
  if (files.includes(exactMatch)) {
    return path.join(productPath, exactMatch);
  }

  for (const ext of imageExtensions) {
    const fileName = `${productFolder}${ext}`;
    if (files.includes(fileName)) {
      return path.join(productPath, fileName);
    }
  }

  for (const ext of imageExtensions) {
    const imageFiles = files.filter((f) =>
      f.toLowerCase().endsWith(ext)
    );
    if (imageFiles.length > 0) {
      const matchingFile = imageFiles.find((f) =>
        normalizeString(f).includes(normalizeString(productFolder))
      );
      if (matchingFile) {
        return path.join(productPath, matchingFile);
      }
      return path.join(productPath, imageFiles[0]);
    }
  }

  return null;
}

async function uploadToCloudinary(
  localPath: string,
  folder: string = "products"
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
      folder: `dhakadsnazzy/${folder}`,
      resource_type: "image",
      use_filename: true,
      unique_filename: false,
    });
    log(`Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error: any) {
    log(`Cloudinary upload failed: ${error.message}, using local path`);
    const relativePath = path.relative(FRONTEND_ASSETS_PATH, localPath);
    return `/${relativePath.replace(/\\/g, "/")}`;
  }
}

// Generate a random price between min and max
function generatePrice(min: number = 50, max: number = 500): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate SKU from product name
function generateSKU(productName: string): string {
  const prefix = productName
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${prefix}-${random}`;
}

async function seedProducts() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Find the specified seller
    const SELLER_ID = "694696400aa496f39fb4afb6";
    const SELLER_MOBILE = "8260521733";

    let seller = await Seller.findOne({
      $or: [
        { _id: SELLER_ID },
        { mobile: SELLER_MOBILE },
      ],
    });

    if (!seller) {
      log(`❌ Seller not found with ID: ${SELLER_ID} or mobile: ${SELLER_MOBILE}`);
      log("Please ensure the seller exists in the database.");
      process.exit(1);
    }

    log(`✅ Found seller: ${seller.sellerName} (${seller.storeName})`);
    log(`   Email: ${seller.email} | Mobile: ${seller.mobile}`);

    // 2. Find Grocery header category
    const headerCategory = await HeaderCategory.findOne({
      $or: [{ name: "Grocery" }, { slug: "grocery" }],
    });

    if (!headerCategory) {
      log('❌ Header category "Grocery" not found.');
      process.exit(1);
    }

    log(`Found header category: ${headerCategory.name}\n`);

    // 3. Find all sub-subcategories
    const allSubcategories = await Category.find({
      headerCategoryId: headerCategory._id,
      parentId: { $ne: null },
      status: "Active",
    });

    const subSubcategories: any[] = [];
    for (const subcategory of allSubcategories) {
      const children = await Category.find({
        parentId: subcategory._id,
        status: "Active",
      });
      for (const child of children) {
        const parentCategory = await Category.findById(subcategory.parentId);
        subSubcategories.push({
          _id: child._id,
          name: child.name,
          subcategoryName: subcategory.name,
          subcategoryId: subcategory._id,
          categoryName: parentCategory?.name || "Unknown",
          categoryId: parentCategory?._id || null,
        });
      }
    }

    log(`Found ${subSubcategories.length} sub-subcategories\n`);

    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalNoImage = 0;

    // 4. Process each sub-subcategory
    for (const subSubcat of subSubcategories) {
      log(
        `\n--- Processing: ${subSubcat.categoryName} > ${subSubcat.subcategoryName} > ${subSubcat.name} ---`
      );

      const categoryFolder =
        categoryFolderMap[subSubcat.categoryName] || subSubcat.categoryName;
      const subcategoryFolder =
        subcategoryFolderMap[subSubcat.subcategoryName] ||
        subSubcat.subcategoryName;

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
      }

      if (productFolders.length === 0) {
        log(`  No product folders found, skipping...`);
        totalSkipped++;
        continue;
      }

      // Find best matching products (1-2 per sub-subcategory)
      const matchedProducts = findBestMatchProducts(
        subSubcat.name,
        productFolders,
        2
      );

      if (matchedProducts.length === 0) {
        log(`  No matching products found, skipping...`);
        totalSkipped++;
        continue;
      }

      // Create products
      for (const productFolder of matchedProducts) {
        const imagePath = findProductImage(
          categoryFolder,
          subcategoryFolder,
          productFolder
        );

        if (!imagePath) {
          log(`  ❌ No image found for ${productFolder}, skipping...`);
          totalNoImage++;
          continue;
        }

        // Check if product already exists
        const existingProduct = await Product.findOne({
          productName: productFolder,
          category: subSubcat.categoryId,
        });

        if (existingProduct) {
          log(`  Product "${productFolder}" already exists, skipping...`);
          totalSkipped++;
          continue;
        }

        // Upload image
        const imageUrl = await uploadToCloudinary(imagePath, "products");

        if (!imageUrl) {
          log(`  ❌ Failed to upload image for ${productFolder}, skipping...`);
          totalNoImage++;
          continue;
        }

        // Generate pricing
        const basePrice = generatePrice(50, 500);
        const compareAtPrice = Math.round(basePrice * 1.2); // 20% markup for MRP
        const discount = Math.round(
          ((compareAtPrice - basePrice) / compareAtPrice) * 100
        );

        // Create product
        try {
          await Product.create({
            productName: productFolder,
            smallDescription: `${productFolder} - Fresh & Quality Assured`,
            description: `Premium quality ${productFolder}. Fresh, hygienic, and carefully selected for you.`,
            category: subSubcat.categoryId,
            subcategory: subSubcat.subcategoryId,
            headerCategoryId: headerCategory._id,
            seller: seller._id,
            mainImage: imageUrl,
            galleryImages: [imageUrl],
            price: basePrice,
            compareAtPrice: compareAtPrice,
            stock: Math.floor(Math.random() * 50) + 10, // Random stock between 10-60
            sku: generateSKU(productFolder),
            publish: true,
            status: "Active",
            popular: Math.random() > 0.7, // 30% chance of being popular
            dealOfDay: false,
            rating: parseFloat((Math.random() * 2 + 3).toFixed(1)), // Random rating 3.0-5.0
            reviewsCount: Math.floor(Math.random() * 100),
            discount: discount,
            tags: [subSubcat.categoryName, subSubcat.subcategoryName, subSubcat.name],
            requiresApproval: false,
            isReturnable: true,
            maxReturnDays: 7,
          });

          log(`  ✅ Created product: ${productFolder}`);
          log(`     Price: ₹${basePrice} | MRP: ₹${compareAtPrice} | Discount: ${discount}%`);
          totalCreated++;
        } catch (error: any) {
          log(`  ❌ Error creating product "${productFolder}": ${error.message}`);
          totalErrors++;
        }
      }
    }

    log("\n✅ Seeding completed!");
    log(`\nSummary:`);
    log(`- Products created: ${totalCreated}`);
    log(`- Products skipped (already exist or no match): ${totalSkipped}`);
    log(`- Products skipped (no image): ${totalNoImage}`);
    log(`- Errors: ${totalErrors}`);

    process.exit(0);
  } catch (error: any) {
    log(`❌ Seeding failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

seedProducts();


