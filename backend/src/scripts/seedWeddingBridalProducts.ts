import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import readline from "readline";
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

const LOG_FILE = path.join(__dirname, "../../seed_wedding_bridal_products.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const SELLER_MOBILE = "7999267233";

// Product data for each subcategory
const productData: Record<string, string[]> = {
  "Bridal Lehengas": [
    "Red Embroidered Bridal Lehenga",
    "Maroon Zardosi Bridal Lehenga",
    "Pink Sequined Bridal Lehenga",
    "Ivory Traditional Bridal Lehenga",
    "Gold Thread Work Bridal Lehenga",
  ],
  "Bridal Sarees": [
    "Red Banarasi Bridal Saree",
    "Maroon Kanjeevaram Bridal Saree",
    "Pink Silk Bridal Saree",
    "Ivory Designer Bridal Saree",
    "Gold Zari Work Bridal Saree",
  ],
  "Bridal Gowns": [
    "White A-Line Bridal Gown",
    "Ivory Mermaid Bridal Gown",
    "Champagne Ball Gown",
    "Blush Pink Bridal Gown",
    "Cream Designer Bridal Gown",
  ],
  "Bridal Accessories": [
    "Bridal Jewelry Set",
    "Bridal Maang Tikka",
    "Bridal Nose Ring",
    "Bridal Bangles Set",
    "Bridal Hair Accessories",
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

    // 3. Find Wedding header category
    log(`\nFinding Wedding header category...`);
    const weddingHeader = await HeaderCategory.findOne({
      slug: "wedding",
      status: "Published",
    });

    if (!weddingHeader) {
      log(`❌ Wedding header category not found or not Published`);
      process.exit(1);
    }

    log(`✅ Found header category: ${weddingHeader.name}`);

    // 4. Find Bridal Wear category
    log(`\nFinding Bridal Wear category...`);
    const bridalWearCategory = await Category.findOne({
      name: "Bridal Wear",
      headerCategoryId: weddingHeader._id,
      parentId: null,
    });

    if (!bridalWearCategory) {
      log(`❌ Bridal Wear category not found under Wedding header category`);
      log(
        `Please ensure the category exists. You may need to run the seed script first.`
      );
      process.exit(1);
    }

    log(`✅ Found category: ${bridalWearCategory.name}`);

    // 5. Find all 4 subcategories
    log(`\nFinding subcategories under Bridal Wear...`);
    const subcategories = await Category.find({
      parentId: bridalWearCategory._id,
      status: "Active",
    }).sort({ order: 1 });

    if (subcategories.length === 0) {
      log(`❌ No subcategories found under Bridal Wear`);
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
      "Bridal Lehengas",
      "Bridal Sarees",
      "Bridal Gowns",
      "Bridal Accessories",
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
      const productNames = productData[subcategory.name];
      if (!productNames || productNames.length === 0) {
        log(`⚠️  No product data found for subcategory: ${subcategory.name}`);
        continue;
      }

      log(`\n--- Creating products for: ${subcategory.name} ---`);

      for (let i = 0; i < productNames.length; i++) {
        const productName = productNames[i];

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

        // Generate price (between 5000 and 50000)
        const basePrice = 5000 + Math.floor(Math.random() * 45000);
        const discountPercent = 10 + Math.floor(Math.random() * 30); // 10-40% discount
        const discountedPrice = Math.round(
          basePrice * (1 - discountPercent / 100)
        );
        const stock = 10 + Math.floor(Math.random() * 90); // 10-100 stock

        // Create product
        await Product.create({
          productName,
          seller: seller._id,
          headerCategoryId: weddingHeader._id,
          category: bridalWearCategory._id,
          subcategory: subcategory._id,
          price: basePrice,
          compareAtPrice: basePrice,
          stock: stock,
          publish: true,
          popular: false,
          dealOfDay: false,
          status: "Active",
          isReturnable: true,
          maxReturnDays: 7,
          totalAllowedQuantity: 5,
          smallDescription: `Beautiful ${productName.toLowerCase()} perfect for your special day`,
          tags: [
            "wedding",
            "bridal",
            subcategory.name.toLowerCase().replace(/\s+/g, "-"),
            "traditional",
          ],
          variations: [
            {
              name: "Standard",
              value: "Standard Size",
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
          `  ✅ Created: ${productName} (Price: ₹${basePrice}, Discount: ${discountPercent}%, Stock: ${stock})`
        );
      }
    }

    log("\n✅ Product seeding completed successfully!");
    log(`\nSummary:`);
    log(`- Seller: ${seller.sellerName} (${seller.storeName})`);
    log(`- Header Category: ${weddingHeader.name}`);
    log(`- Category: ${bridalWearCategory.name}`);
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

