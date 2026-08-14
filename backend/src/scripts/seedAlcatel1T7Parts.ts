import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import axios from "axios";
import Category from "../models/Category";
import Product from "../models/Product";
import Seller from "../models/Seller";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../seed_alcatel_1t7_parts.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const MAXBHI_URL =
  "https://www.maxbhi.com/alcatel-1t-7-spare-parts-and-accessories.html";

// Reuse an existing seller; fallback to the default retail seller from other seed scripts
const DEFAULT_SELLER_EMAIL = "retail@Dhakad Snazzy.com";

async function fetchAlcatel1T7ProductNames(): Promise<string[]> {
  log(`Fetching HTML from ${MAXBHI_URL}`);
  const response = await axios.get(MAXBHI_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const html: string = response.data;

  // Heuristic: grab all text nodes that mention "Alcatel 1T 7"
  const regex = />[^<]*Alcatel 1T 7[^<]*</gi;
  const names = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    let text = match[0]
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    // Clean common boilerplate like "by Maxbhi.com"
    text = text.replace(/by\s+Maxbhi\.com/gi, "").trim();

    if (text.length < 3) continue;
    names.add(text);
  }

  const result = Array.from(names);
  log(`Extracted ${result.length} raw product names from Maxbhi`);
  return result;
}

async function seedAlcatelParts() {
  try {
    log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Resolve seller
    let seller = await Seller.findOne({ email: DEFAULT_SELLER_EMAIL });
    if (!seller) {
      log(
        `Seller with email ${DEFAULT_SELLER_EMAIL} not found. Please create one or adjust DEFAULT_SELLER_EMAIL in seedAlcatel1T7Parts.ts.`
      );
      process.exit(1);
    }
    log(`Using seller: ${seller.sellerName} (${seller.storeName})`);

    // 2. Resolve category (prefer Electronics, fall back to any Active category)
    let category = await Category.findOne({
      slug: "electronics",
    });
    if (!category) {
      category = await Category.findOne({ name: /Electronics/i });
    }
    if (!category) {
      log(
        "Electronics category not found. Using first active category as fallback."
      );
      category = await Category.findOne({ status: "Active" });
    }
    if (!category) {
      log("No category found. Cannot seed products.");
      process.exit(1);
    }
    log(`Using category: ${category.name} (slug: ${category.slug})`);

    // 3. Scrape product names from Maxbhi
    const names = await fetchAlcatel1T7ProductNames();
    if (names.length === 0) {
      log("No product names found on Maxbhi page. Aborting.");
      process.exit(1);
    }

    // 4. Upsert products
    let createdCount = 0;
    let updatedCount = 0;

    for (const rawName of names) {
      const productName = rawName;

      const existing = await Product.findOne({ productName });
      const baseData = {
        productName,
        smallDescription: "Spare part for Alcatel 1T 7",
        description: `${productName} - Spare part for Alcatel 1T 7`,
        category: category._id,
        seller: seller._id,
        mainImage: "",
        galleryImages: [],
        price: 0,
        compareAtPrice: 0,
        stock: 0,
        sku: undefined,
        publish: false,
        status: "Active" as const,
        popular: false,
        dealOfDay: false,
        tags: ["alcatel-1t7", "maxbhi-scraped"],
        requiresApproval: false,
        isReturnable: false,
      };

      await Product.findOneAndUpdate(
        { productName },
        baseData,
        { upsert: true, new: false }
      );

      if (existing) {
        updatedCount++;
        log(`Updated existing product: ${productName}`);
      } else {
        createdCount++;
        log(`Created new product: ${productName}`);
      }
    }

    log(
      `Seeding completed. Created: ${createdCount}, Updated: ${updatedCount}, Total processed: ${names.length}`
    );
    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    log(`Seeding failed: ${error.message || error}`);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedAlcatelParts();

