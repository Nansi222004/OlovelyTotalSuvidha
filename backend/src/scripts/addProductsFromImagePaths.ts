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

const LOG_FILE = path.join(__dirname, "../../add_products_from_paths.log");

function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/assets");
const SELLER_MOBILE = "6268423926";

// Product image paths provided by user
const PRODUCT_IMAGE_PATHS = [
  "frontend/assets/Image-20251130T081301Z-1-001/Image/product/product/Bakery & Biscuits/Cookies/Parle Milano Chocolate Chip Biscuit/Parle Milano Chocolate Chip Biscuit.jpg",
  "frontend/assets/Image-20251130T081301Z-1-001/Image/product/product/Bakery & Biscuits/Glucose & Marie/Parle-G Glucose Biscuit - Pack of 2/Parle-G Glucose Biscuit - Pack of 2.jpg",
  "frontend/assets/Image-20251130T081301Z-1-001/Image/product/product/Snacks & Munchies/Bhujia & Mixtures/Balaji Ratlami Sev Bhujia/Balaji Ratlami Sev Bhujia.jpg",
  "frontend/assets/Image-20251130T081301Z-1-001/Image/product/product/Snacks & Munchies/Chips & Crisps/Kurkure Solid Masti Masala Twisteez Crisps/132817b.jpg",
  "frontend/assets/Image-20251130T081301Z-1-001/Image/product/product/Masala, Oil & More/Oil/Fortune Premium Kachi Ghani Pure Mustard Oil/15907c.jpg",
];

log("Starting Add Products from Image Paths Script");
log(`MONGO_URI: ${MONGO_URI}`);
log(`SELLER_MOBILE: ${SELLER_MOBILE}`);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Parse image path to extract category hierarchy and product name
function parseImagePath(imagePath: string): {
  categoryName: string;
  subcategoryName: string;
  productName: string;
  fullPath: string;
} {
  // Normalize path separators
  const normalizedPath = imagePath.replace(/\\/g, "/");

  // Extract parts after "product/product/"
  const productIndex = normalizedPath.indexOf("product/product/");
  if (productIndex === -1) {
    throw new Error(`Invalid path format: ${imagePath}`);
  }

  const relativePath = normalizedPath.substring(productIndex + "product/product/".length);
  const parts = relativePath.split("/");

  if (parts.length < 3) {
    throw new Error(`Invalid path structure. Expected: Category/Subcategory/Product/Image, got: ${relativePath}`);
  }

  const categoryName = parts[0];
  const subcategoryName = parts[1];
  // Product name is the folder name (parts[2])
  const productName = parts[2];

  // Full path to image file
  const fullPath = path.join(__dirname, "../../../", normalizedPath);

  return {
    categoryName,
    subcategoryName,
    productName,
    fullPath,
  };
}

// Find or create category hierarchy
async function findOrCreateCategoryHierarchy(
  categoryName: string,
  subcategoryName: string
): Promise<{ categoryId: mongoose.Types.ObjectId; subcategoryId: mongoose.Types.ObjectId }> {
  // Find root category
  let rootCategory = await Category.findOne({
    name: { $regex: new RegExp(`^${categoryName}$`, "i") },
    parentId: null,
  });

  if (!rootCategory) {
    log(`⚠️  Root category "${categoryName}" not found. Creating it...`);
    // Try to find header category (Grocery) for root categories
    const groceryHeader = await HeaderCategory.findOne({
      $or: [{ name: "Grocery" }, { slug: "grocery" }],
    });

    rootCategory = await Category.create({
      name: categoryName,
      order: 0,
      status: "Active",
      isBestseller: false,
      hasWarning: false,
      headerCategoryId: groceryHeader?._id || null,
    });
    log(`✅ Created root category: ${categoryName}`);
  }

  // Find subcategory
  let subcategory = await Category.findOne({
    name: { $regex: new RegExp(`^${subcategoryName}$`, "i") },
    parentId: rootCategory._id,
  });

  if (!subcategory) {
    log(`⚠️  Subcategory "${subcategoryName}" not found under "${categoryName}". Creating it...`);
    subcategory = await Category.create({
      name: subcategoryName,
      parentId: rootCategory._id,
      order: 0,
      status: "Active",
      isBestseller: false,
      hasWarning: false,
      headerCategoryId: rootCategory.headerCategoryId || null, // Inherit from parent
    });
    log(`✅ Created subcategory: ${subcategoryName}`);
  }

  return {
    categoryId: rootCategory._id,
    subcategoryId: subcategory._id,
  };
}

// Upload image to Cloudinary
async function uploadToCloudinary(
  localPath: string,
  folder: string = "products"
): Promise<string | null> {
  if (!fs.existsSync(localPath)) {
    log(`❌ File not found: ${localPath}`);
    return null;
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    log("⚠️  Cloudinary not configured, using local path");
    const relativePath = path.relative(FRONTEND_ASSETS_PATH, localPath);
    return `/${relativePath.replace(/\\/g, "/")}`;
  }

  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder: `dhakadsnazzy/${folder}`,
      resource_type: "image",
      use_filename: true,
      unique_filename: false,
    });
    log(`✅ Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error: any) {
    log(`❌ Cloudinary upload failed: ${error.message}, using local path`);
    const relativePath = path.relative(FRONTEND_ASSETS_PATH, localPath);
    return `/${relativePath.replace(/\\/g, "/")}`;
  }
}

// Generate price based on product name/category
function generatePrice(_productName: string, categoryName: string): number {
  // Base prices by category
  const categoryPrices: { [key: string]: { min: number; max: number } } = {
    "Bakery & Biscuits": { min: 20, max: 200 },
    "Snacks & Munchies": { min: 10, max: 150 },
    "Masala, Oil & More": { min: 50, max: 500 },
  };

  const priceRange = categoryPrices[categoryName] || { min: 50, max: 500 };
  return Math.floor(Math.random() * (priceRange.max - priceRange.min + 1)) + priceRange.min;
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

async function addProducts() {
  try {
    await mongoose.connect(MONGO_URI);
    log("✅ Connected to MongoDB\n");

    // 1. Find the seller by mobile number
    const seller = await Seller.findOne({ mobile: SELLER_MOBILE });

    if (!seller) {
      log(`❌ Seller not found with mobile: ${SELLER_MOBILE}`);
      log("Please ensure the seller exists in the database.");
      await mongoose.disconnect();
      process.exit(1);
    }

    log(`✅ Found seller: ${seller.sellerName} (${seller.storeName})`);
    log(`   Email: ${seller.email} | Mobile: ${seller.mobile}\n`);

    const results = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: [] as Array<{ product: string; error: string }>,
    };

    // 2. Process each product image path
    for (const imagePath of PRODUCT_IMAGE_PATHS) {
      try {
        results.processed++;
        log(`\n--- Processing: ${imagePath} ---`);

        // Parse the path
        const { categoryName, subcategoryName, productName, fullPath } =
          parseImagePath(imagePath);

        log(`Category: ${categoryName}`);
        log(`Subcategory: ${subcategoryName}`);
        log(`Product: ${productName}`);

        // Find or create category hierarchy
        const { categoryId: _categoryId, subcategoryId } =
          await findOrCreateCategoryHierarchy(categoryName, subcategoryName);

        // Check if product already exists
        const existingProduct = await Product.findOne({
          productName: { $regex: new RegExp(`^${productName}$`, "i") },
          seller: seller._id,
          category: subcategoryId, // Use subcategory as the category for the product
        });

        if (existingProduct) {
          log(`⚠️  Product "${productName}" already exists. Skipping.`);
          results.skipped++;
          continue;
        }

        // Upload image
        log(`Uploading image: ${fullPath}`);
        const imageUrl = await uploadToCloudinary(fullPath, "products");

        if (!imageUrl) {
          throw new Error("Failed to upload image");
        }

        // Generate product data
        const price = generatePrice(productName, categoryName);
        const compareAtPrice = Math.floor(price * 1.2); // 20% markup for compare price
        const sku = generateSKU(productName);

        // Create product
        const product = await Product.create({
          productName: productName,
          smallDescription: `${productName} - High quality product`,
          description: `${productName}. Available in our store.`,
          category: subcategoryId, // Product is assigned to the subcategory
          seller: seller._id,
          mainImage: imageUrl,
          galleryImages: [imageUrl],
          price: price,
          compareAtPrice: compareAtPrice,
          stock: Math.floor(Math.random() * 100) + 10, // Random stock between 10-110
          sku: sku,
          publish: true,
          popular: false,
          dealOfDay: false,
          status: "Active",
          isReturnable: true,
          maxReturnDays: 7,
          tags: [categoryName, subcategoryName],
          requiresApproval: false,
          rating: 0,
          reviewsCount: 0,
          discount: Math.floor(((compareAtPrice - price) / compareAtPrice) * 100),
        });

        log(`✅ Created product: ${product.productName}`);
        log(`   Price: ₹${price} | Compare: ₹${compareAtPrice}`);
        log(`   SKU: ${sku} | Stock: ${product.stock}`);
        results.created++;
      } catch (error: any) {
        log(`❌ Error processing ${imagePath}: ${error.message}`);
        results.errors.push({
          product: imagePath,
          error: error.message,
        });
      }
    }

    // Print summary
    log("\n=== Summary ===");
    log(`Total processed: ${results.processed}`);
    log(`✅ Created: ${results.created}`);
    log(`⚠️  Skipped: ${results.skipped}`);
    log(`❌ Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      log("\n=== Errors ===");
      results.errors.forEach((err) => {
        log(`  ${err.product}: ${err.error}`);
      });
    }

    await mongoose.disconnect();
    log("\n✅ Script completed. Disconnected from MongoDB.");
  } catch (error: any) {
    log(`❌ Script failed: ${error.message}`);
    log(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addProducts()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script error:", error);
      process.exit(1);
    });
}

export default addProducts;


