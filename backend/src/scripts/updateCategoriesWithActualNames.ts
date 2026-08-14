import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(
  __dirname,
  "../../update_categories_actual_names.log"
);
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";

log("Starting Update Categories with Actual Names Script");
log(`MONGO_URI: ${MONGO_URI}`);

// Category and subcategory mappings
const categoryMappings: Record<
  string,
  { categories: string[]; subcategories: Record<string, string[]> }
> = {
  wedding: {
    categories: ["Bridal Wear", "Groom Wear", "Wedding Decor", "Wedding Gifts"],
    subcategories: {
      "Bridal Wear": [
        "Bridal Lehengas",
        "Bridal Sarees",
        "Bridal Gowns",
        "Bridal Accessories",
      ],
      "Groom Wear": [
        "Sherwanis",
        "Suits & Blazers",
        "Traditional Kurta Sets",
        "Groom Accessories",
      ],
      "Wedding Decor": [
        "Mandap Decorations",
        "Stage Backdrops",
        "Floral Arrangements",
        "Lighting & Candles",
      ],
      "Wedding Gifts": [
        "Gift Sets",
        "Personalized Gifts",
        "Home Decor Gifts",
        "Kitchen Gift Sets",
      ],
    },
  },
  winter: {
    categories: [
      "Winter Clothing",
      "Home Heating",
      "Winter Care",
      "Hot Beverages",
    ],
    subcategories: {
      "Winter Clothing": [
        "Sweaters & Cardigans",
        "Jackets & Coats",
        "Thermal Wear",
        "Winter Accessories",
      ],
      "Home Heating": [
        "Heaters & Radiators",
        "Electric Blankets",
        "Hot Water Bags",
        "Room Warmers",
      ],
      "Winter Care": [
        "Moisturizers & Creams",
        "Lip Balms",
        "Hand & Foot Care",
        "Body Lotions",
      ],
      "Hot Beverages": [
        "Tea & Coffee",
        "Hot Chocolate",
        "Soups & Broths",
        "Instant Drink Mixes",
      ],
    },
  },
  electronics: {
    categories: [
      "Mobile & Accessories",
      "Audio Devices",
      "Computer & Laptop",
      "Smart Devices",
    ],
    subcategories: {
      "Mobile & Accessories": [
        "Smartphones",
        "Mobile Cases & Covers",
        "Chargers & Cables",
        "Power Banks",
      ],
      "Audio Devices": [
        "Headphones & Earphones",
        "Speakers",
        "Soundbars",
        "Audio Accessories",
      ],
      "Computer & Laptop": [
        "Laptops",
        "Desktop Computers",
        "Keyboards & Mouse",
        "Computer Accessories",
      ],
      "Smart Devices": [
        "Smart Watches",
        "Fitness Trackers",
        "Smart Home Devices",
        "Wearable Tech",
      ],
    },
  },
  beauty: {
    categories: ["Makeup", "Skincare", "Hair Care", "Personal Grooming"],
    subcategories: {
      Makeup: ["Face Makeup", "Eye Makeup", "Lip Products", "Makeup Brushes"],
      Skincare: [
        "Face Cleansers",
        "Face Serums",
        "Face Moisturizers",
        "Face Masks",
      ],
      "Hair Care": [
        "Shampoos & Conditioners",
        "Hair Oils",
        "Hair Styling Products",
        "Hair Accessories",
      ],
      "Personal Grooming": [
        "Body Care",
        "Deodorants & Perfumes",
        "Nail Care",
        "Grooming Tools",
      ],
    },
  },
  grocery: {
    categories: [
      "Staples & Grains",
      "Cooking Essentials",
      "Snacks & Beverages",
      "Dairy & Breakfast",
    ],
    subcategories: {
      "Staples & Grains": [
        "Rice & Rice Products",
        "Wheat & Atta",
        "Pulses & Dals",
        "Cereals & Muesli",
      ],
      "Cooking Essentials": [
        "Spices & Masalas",
        "Cooking Oils",
        "Salt & Sugar",
        "Vinegar & Sauces",
      ],
      "Snacks & Beverages": [
        "Chips & Namkeen",
        "Biscuits & Cookies",
        "Soft Drinks",
        "Juices & Drinks",
      ],
      "Dairy & Breakfast": [
        "Milk & Milk Products",
        "Butter & Cheese",
        "Bread & Bakery",
        "Breakfast Cereals",
      ],
    },
  },
  fashion: {
    categories: [
      "Women's Clothing",
      "Men's Clothing",
      "Footwear",
      "Accessories",
    ],
    subcategories: {
      "Women's Clothing": [
        "Dresses & Gowns",
        "Tops & T-Shirts",
        "Jeans & Pants",
        "Ethnic Wear",
      ],
      "Men's Clothing": [
        "Shirts & T-Shirts",
        "Jeans & Trousers",
        "Formal Wear",
        "Traditional Wear",
      ],
      Footwear: [
        "Casual Shoes",
        "Sports Shoes",
        "Sandals & Slippers",
        "Formal Shoes",
      ],
      Accessories: [
        "Bags & Wallets",
        "Belts & Watches",
        "Sunglasses",
        "Jewelry",
      ],
    },
  },
  sports: {
    categories: [
      "Sports Equipment",
      "Activewear",
      "Fitness & Gym",
      "Outdoor Sports",
    ],
    subcategories: {
      "Sports Equipment": [
        "Balls & Sports Gear",
        "Rackets & Bats",
        "Fitness Equipment",
        "Sports Accessories",
      ],
      Activewear: [
        "Sports T-Shirts",
        "Track Pants",
        "Sports Shoes",
        "Sports Accessories",
      ],
      "Fitness & Gym": [
        "Gym Equipment",
        "Yoga Mats",
        "Resistance Bands",
        "Fitness Accessories",
      ],
      "Outdoor Sports": [
        "Camping Gear",
        "Hiking Equipment",
        "Water Sports",
        "Adventure Gear",
      ],
    },
  },
};

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function updateCategories() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // Get all Published header categories
    const headerCategories = await HeaderCategory.find({
      status: "Published",
    }).sort({ order: 1 });

    if (headerCategories.length === 0) {
      log("No Published header categories found.");
      process.exit(0);
    }

    log(`Found ${headerCategories.length} Published header categories`);

    let totalCategoriesUpdated = 0;
    let totalSubcategoriesUpdated = 0;

    // Process each header category
    for (const headerCategory of headerCategories) {
      const headerSlug = headerCategory.slug.toLowerCase();
      log(
        `\n--- Processing Header Category: ${headerCategory.name} (${headerSlug}) ---`
      );

      // Get mapping for this header category
      const mapping = categoryMappings[headerSlug];

      if (!mapping) {
        log(`No mapping found for header category: ${headerSlug}. Skipping...`);
        continue;
      }

      // Find existing categories for this header category
      const existingCategories = await Category.find({
        headerCategoryId: headerCategory._id,
        parentId: null, // Root categories only
      }).sort({ order: 1 });

      if (existingCategories.length === 0) {
        log(`No categories found for ${headerCategory.name}. Skipping...`);
        continue;
      }

      log(`Found ${existingCategories.length} categories to update`);

      // Update each category
      for (
        let i = 0;
        i < existingCategories.length && i < mapping.categories.length;
        i++
      ) {
        const category = existingCategories[i];
        const newCategoryName = mapping.categories[i];
        const newCategorySlug = generateSlug(newCategoryName);

        // Check if a category with the new name already exists (to avoid duplicates)
        const existingWithNewName = await Category.findOne({
          name: newCategoryName,
          _id: { $ne: category._id },
        });

        if (existingWithNewName) {
          log(
            `Category "${newCategoryName}" already exists with different ID. Skipping update for "${category.name}"`
          );
          continue;
        }

        // Update category
        category.name = newCategoryName;
        category.slug = newCategorySlug;
        await category.save();

        totalCategoriesUpdated++;
        log(`  Updated category: "${category.name}" -> "${newCategoryName}"`);

        // Get subcategories for this category
        const subcategoryNames = mapping.subcategories[newCategoryName];
        if (!subcategoryNames) {
          log(`  No subcategories mapping found for "${newCategoryName}"`);
          continue;
        }

        // Find existing subcategories for this category
        const existingSubcategories = await Category.find({
          parentId: category._id,
        }).sort({ order: 1 });

        log(`  Found ${existingSubcategories.length} subcategories to update`);

        // Update each subcategory
        for (
          let j = 0;
          j < existingSubcategories.length && j < subcategoryNames.length;
          j++
        ) {
          const subcategory = existingSubcategories[j];
          const newSubcategoryName = subcategoryNames[j];
          const newSubcategorySlug = generateSlug(newSubcategoryName);

          // Check if a subcategory with the new name already exists
          const existingSubWithNewName = await Category.findOne({
            name: newSubcategoryName,
            _id: { $ne: subcategory._id },
          });

          if (existingSubWithNewName) {
            log(
              `    Subcategory "${newSubcategoryName}" already exists. Skipping update for "${subcategory.name}"`
            );
            continue;
          }

          // Update subcategory
          subcategory.name = newSubcategoryName;
          subcategory.slug = newSubcategorySlug;
          await subcategory.save();

          totalSubcategoriesUpdated++;
          log(
            `    Updated subcategory: "${subcategory.name}" -> "${newSubcategoryName}"`
          );
        }
      }
    }

    log("\n✅ Update completed successfully!");
    log(`\nSummary:`);
    log(`- Categories updated: ${totalCategoriesUpdated}`);
    log(`- Subcategories updated: ${totalSubcategoriesUpdated}`);
    log(
      `\nTotal items updated: ${
        totalCategoriesUpdated + totalSubcategoriesUpdated
      }`
    );

    process.exit(0);
  } catch (error: any) {
    log(`❌ Update failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

updateCategories();


