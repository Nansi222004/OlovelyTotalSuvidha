import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import readline from "readline";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";
import Product from "../models/Product";
import Seller from "../models/Seller";
import {
  sendOTP as sendOTPService,
  verifyOTP as verifyOTPService,
} from "../services/otpService";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(
  __dirname,
  "../../seed_grocery_cooking_essentials_products.log"
);
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const SELLER_MOBILE = "7999267233";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/assets");
const PRODUCT_IMAGES_BASE = path.join(
  FRONTEND_ASSETS_PATH,
  "Image-20251130T081301Z-1-001",
  "Image",
  "product",
  "product"
);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper to upload to Cloudinary
async function uploadToCloudinary(
  localPath: string,
  folder: string = "products"
): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    log("Cloudinary not configured, using local path");
    return localPath.startsWith("http")
      ? localPath
      : `/assets/${path.basename(localPath)}`;
  }

  // If the path is already an absolute path and exists, use it directly
  let fullPath: string | null = null;
  if (path.isAbsolute(localPath) && fs.existsSync(localPath)) {
    fullPath = localPath;
  } else {
    // Try multiple possible paths for relative paths
    const possiblePaths = [
      path.join(FRONTEND_ASSETS_PATH, localPath.replace("/assets/", "")),
      path.join(
        __dirname,
        "../../../frontend/public",
        localPath.replace("/assets/", "")
      ),
      localPath.startsWith("/")
        ? localPath
        : path.join(FRONTEND_ASSETS_PATH, localPath),
    ];

    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        fullPath = tryPath;
        break;
      }
    }
  }

  if (!fullPath) {
    log(`Warning: File not found for ${localPath}`);
    return null; // Return null - we'll skip products without images
  }

  try {
    const result = await cloudinary.uploader.upload(fullPath, {
      folder: `dhakadsnazzy/${folder}`,
      resource_type: "image",
      use_filename: true,
      unique_filename: false,
    });
    log(`Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error: any) {
    log(`Cloudinary upload failed: ${error.message}`);
    return null; // Return null instead of placeholder - we'll skip products without images
  }
}

// Product data for each subcategory with image paths
// Paths are relative to: Image-20251130T081301Z-1-001/Image/product/product/
const productData: Record<
  string,
  Array<{ name: string; imagePath?: string; pack?: string }>
> = {
  "Spices & Masalas": [
    {
      name: "Badshah Chat Masala",
      imagePath: "Masala, Oil & More/Powdered Spices/Badshah Chat Masala",
      pack: "100 g",
    },
    {
      name: "MDH Garam Masala",
      imagePath: "Masala, Oil & More/Powdered Spices",
      pack: "100 g",
    },
    {
      name: "Everest Pav Bhaji Masala",
      imagePath: "Masala, Oil & More/Powdered Spices",
      pack: "100 g",
    },
    {
      name: "Whole Farm Premium Red Chilli Whole",
      imagePath:
        "Masala, Oil & More/Whole Spices/Whole Farm Premium Red Chilli Whole",
      pack: "100 g",
    },
    {
      name: "Turmeric Powder Premium",
      imagePath: "Masala, Oil & More/Powdered Spices",
      pack: "200 g",
    },
  ],
  "Cooking Oils": [
    {
      name: "Fortune Sunflower Oil",
      imagePath: "Masala, Oil & More/Cooking Oils",
      pack: "1 L",
    },
    {
      name: "Saffola Gold Refined Oil",
      imagePath: "Masala, Oil & More/Cooking Oils",
      pack: "1 L",
    },
    {
      name: "Dhara Mustard Oil",
      imagePath: "Masala, Oil & More/Cooking Oils",
      pack: "1 L",
    },
    {
      name: "Fortune Rice Bran Oil",
      imagePath: "Masala, Oil & More/Cooking Oils",
      pack: "1 L",
    },
    {
      name: "Olive Oil Extra Virgin",
      imagePath: "Masala, Oil & More/Cooking Oils",
      pack: "500 ml",
    },
  ],
  "Salt & Sugar": [
    {
      name: "Tata Salt Iodized",
      imagePath: "Masala, Oil & More/Salt & Sugar",
      pack: "1 kg",
    },
    {
      name: "Sugar White Crystal",
      imagePath: "Masala, Oil & More/Salt & Sugar",
      pack: "1 kg",
    },
    {
      name: "Rock Salt Sendha Namak",
      imagePath: "Masala, Oil & More/Salt & Sugar",
      pack: "500 g",
    },
    {
      name: "Brown Sugar Natural",
      imagePath: "Masala, Oil & More/Salt & Sugar",
      pack: "500 g",
    },
    {
      name: "Black Salt Kala Namak",
      imagePath: "Masala, Oil & More/Salt & Sugar",
      pack: "200 g",
    },
  ],
  "Vinegar & Sauces": [
    {
      name: "Veeba Chef's Special Hot Sweet Tomato Chilli Sauce",
      imagePath:
        "Sauces & Spreads/Tomoto & Chilli Ketchup/Veeba Chef's Special Hot Sweet Tomato Chilli Sauce",
      pack: "500 g",
    },
    {
      name: "Kissan Tomato Ketchup",
      imagePath: "Sauces & Spreads/Tomoto & Chilli Ketchup",
      pack: "500 g",
    },
    {
      name: "Maggi Hot & Sweet Sauce",
      imagePath: "Sauces & Spreads/Tomoto & Chilli Ketchup",
      pack: "500 g",
    },
    {
      name: "White Vinegar Premium",
      imagePath: "Sauces & Spreads",
      pack: "500 ml",
    },
    {
      name: "Apple Cider Vinegar",
      imagePath: "Sauces & Spreads",
      pack: "500 ml",
    },
  ],
};

// Helper function to prompt for OTP
function promptOTP(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter the OTP received on your phone: ", (otp) => {
      rl.close();
      resolve(otp.trim());
    });
  });
}

// Helper to find first available image in a directory (searches recursively)
async function findImageInDirectory(dirPath: string): Promise<string | null> {
  const possibleExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  // Try multiple path formats
  const possiblePaths = [
    // Full path from product base directory
    path.join(PRODUCT_IMAGES_BASE, dirPath),
    // Relative path from assets
    path.join(FRONTEND_ASSETS_PATH, dirPath.replace("/assets/", "")),
    // Direct path
    dirPath.startsWith("/")
      ? dirPath
      : path.join(FRONTEND_ASSETS_PATH, dirPath),
  ];

  // Function to recursively search for images
  const searchForImages = (searchPath: string): string | null => {
    if (!fs.existsSync(searchPath)) {
      return null;
    }

    try {
      const items = fs.readdirSync(searchPath);

      // First, check for images directly in this directory
      for (const item of items) {
        const itemPath = path.join(searchPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (possibleExtensions.includes(ext)) {
            log(`Found image: ${itemPath}`);
            return itemPath;
          }
        }
      }

      // If no images found, search in subdirectories (max depth 2)
      for (const item of items) {
        const itemPath = path.join(searchPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          const found = searchForImages(itemPath);
          if (found) return found;
        }
      }
    } catch (error) {
      log(`Error reading directory ${searchPath}: ${error}`);
    }

    return null;
  };

  // Try each possible path
  for (const tryPath of possiblePaths) {
    const found = searchForImages(tryPath);
    if (found) return found;
  }

  return null;
}

async function seedProducts() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Find seller by mobile number
    log(`\nFinding seller with mobile: ${SELLER_MOBILE}`);
    const seller = await Seller.findOne({ mobile: SELLER_MOBILE });

    if (!seller) {
      log(`❌ Seller not found with mobile number: ${SELLER_MOBILE}`);
      log("Please ensure the seller exists in the database.");
      process.exit(1);
    }

    log(`✅ Found seller: ${seller.sellerName} (${seller.storeName})`);

    // 2. Send OTP for authentication
    log(`\nSending OTP to ${SELLER_MOBILE}...`);
    try {
      const otpResult = await sendOTPService(SELLER_MOBILE, "Seller", true);
      log(`✅ ${otpResult.message}`);

      // Extract OTP from message if in mock mode
      let otp = "";
      if (otpResult.message.includes("OTP:")) {
        const match = otpResult.message.match(/OTP:\s*(\d+)/);
        if (match) {
          otp = match[1];
          log(`📱 OTP extracted from message: ${otp}`);
        }
      }

      // If OTP not extracted, prompt user
      if (!otp) {
        otp = await promptOTP();
      }

      // Verify OTP
      log(`\nVerifying OTP...`);
      const isValid = await verifyOTPService(SELLER_MOBILE, otp, "Seller");

      if (!isValid) {
        log(`❌ Invalid or expired OTP. Please try again.`);
        process.exit(1);
      }

      log(`✅ OTP verified successfully`);
    } catch (error: any) {
      log(`❌ Error during OTP process: ${error.message}`);
      process.exit(1);
    }

    // 3. Find Grocery header category
    log(`\nFinding Grocery header category...`);
    const groceryHeader = await HeaderCategory.findOne({
      slug: "grocery",
      status: "Published",
    });

    if (!groceryHeader) {
      log(`❌ Grocery header category not found or not Published`);
      process.exit(1);
    }

    log(`✅ Found header category: ${groceryHeader.name}`);

    // 4. Find Cooking Essentials category
    log(`\nFinding Cooking Essentials category...`);
    const cookingEssentialsCategory = await Category.findOne({
      name: "Cooking Essentials",
      headerCategoryId: groceryHeader._id,
      parentId: null,
    });

    if (!cookingEssentialsCategory) {
      log(
        `❌ Cooking Essentials category not found under Grocery header category`
      );
      log(
        `Please ensure the category exists. You may need to run the seed script first.`
      );
      process.exit(1);
    }

    log(`✅ Found category: ${cookingEssentialsCategory.name}`);

    // 5. Find all 4 subcategories
    log(`\nFinding subcategories under Cooking Essentials...`);
    const subcategories = await Category.find({
      parentId: cookingEssentialsCategory._id,
      status: "Active",
    }).sort({ order: 1 });

    if (subcategories.length === 0) {
      log(`❌ No subcategories found under Cooking Essentials`);
      log(
        `Please ensure subcategories exist. You may need to run the seed script first.`
      );
      process.exit(1);
    }

    log(`✅ Found ${subcategories.length} subcategories:`);
    subcategories.forEach((sub) => {
      log(`  - ${sub.name}`);
    });

    // Verify we have all 4 required subcategories
    const requiredSubcategories = [
      "Spices & Masalas",
      "Cooking Oils",
      "Salt & Sugar",
      "Vinegar & Sauces",
    ];

    const foundSubcategoryNames = subcategories.map((s) => s.name);
    const missingSubcategories = requiredSubcategories.filter(
      (name) => !foundSubcategoryNames.includes(name)
    );

    if (missingSubcategories.length > 0) {
      log(`❌ Missing subcategories: ${missingSubcategories.join(", ")}`);
      process.exit(1);
    }

    // 6. Create products for each subcategory
    let totalProductsCreated = 0;

    for (const subcategory of subcategories) {
      const products = productData[subcategory.name];
      if (!products || products.length === 0) {
        log(`⚠️  No product data found for subcategory: ${subcategory.name}`);
        continue;
      }

      log(`\n--- Creating products for: ${subcategory.name} ---`);

      for (let i = 0; i < products.length; i++) {
        const productInfo = products[i];
        const productName = productInfo.name;

        // Check if product already exists
        const existingProduct = await Product.findOne({
          productName,
          subcategory: subcategory._id,
          seller: seller._id,
        });

        if (existingProduct) {
          log(`  ⚠️  Product "${productName}" already exists. Skipping...`);
          continue;
        }

        // Find and upload product image - ONLY CREATE IF IMAGE EXISTS
        let productImage: string | null = null;
        if (productInfo.imagePath) {
          // Try to find image in the specified directory
          const foundImagePath = await findImageInDirectory(
            productInfo.imagePath
          );
          if (foundImagePath) {
            productImage = await uploadToCloudinary(foundImagePath, "products");
            if (!productImage) {
              log(`  ⚠️  Failed to upload image for "${productName}"`);
            }
          } else {
            log(`  ⚠️  No image found in directory: ${productInfo.imagePath}`);
          }
        }

        // Skip product if no image found
        if (!productImage || productImage.includes("placeholder")) {
          log(`  ⚠️  Skipping "${productName}" - no image available`);
          continue;
        }

        // Generate price (between 50 and 500 for grocery items)
        const basePrice = 50 + Math.floor(Math.random() * 450);
        const discountPercent = 5 + Math.floor(Math.random() * 20); // 5-25% discount
        const discountedPrice = Math.round(
          basePrice * (1 - discountPercent / 100)
        );
        const stock = 20 + Math.floor(Math.random() * 80); // 20-100 stock

        // Create product
        await Product.create({
          productName,
          seller: seller._id,
          headerCategoryId: groceryHeader._id,
          category: cookingEssentialsCategory._id,
          subcategory: subcategory._id,
          mainImage: productImage,
          price: basePrice,
          compareAtPrice: basePrice,
          stock: stock,
          pack: productInfo.pack || "1 unit",
          publish: true,
          popular: false,
          dealOfDay: false,
          status: "Active",
          isReturnable: true,
          maxReturnDays: 7,
          totalAllowedQuantity: 10,
          smallDescription: `Premium quality ${productName.toLowerCase()} - ${
            productInfo.pack || "1 unit"
          }`,
          tags: [
            "grocery",
            "cooking-essentials",
            subcategory.name.toLowerCase().replace(/\s+/g, "-"),
            "premium",
          ],
          variations: [
            {
              name: "Standard",
              value: productInfo.pack || "1 unit",
              price: basePrice,
              discPrice: discountedPrice,
              stock: stock,
              status: "Available",
            },
          ],
          rating: 0,
          reviewsCount: 0,
          discount: discountPercent,
          requiresApproval: false,
        });

        totalProductsCreated++;
        log(
          `  ✅ Created: ${productName} (Price: ₹${basePrice}, Discount: ${discountPercent}%, Stock: ${stock}, Image: Uploaded)`
        );
      }
    }

    log("\n✅ Product seeding completed successfully!");
    log(`\nSummary:`);
    log(`- Seller: ${seller.sellerName} (${seller.storeName})`);
    log(`- Header Category: ${groceryHeader.name}`);
    log(`- Category: ${cookingEssentialsCategory.name}`);
    log(`- Subcategories processed: ${subcategories.length}`);
    log(`- Products created: ${totalProductsCreated}`);
    log(`\nTotal products created: ${totalProductsCreated}`);

    process.exit(0);
  } catch (error: any) {
    log(`❌ Seeding failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

seedProducts();

