import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../remove_grocery_categories.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";

log("Starting Remove Grocery Categories Script");
log(`MONGO_URI: ${MONGO_URI}`);

// Grocery Categories Data Structure (same as seed script - categories and subcategories only)
const groceryCategoriesData = [
  {
    name: "Vegetables & Fruits",
    subcategories: [
      "Fresh Vegetables",
      "Fresh Fruits",
      "Leafy & Herbs",
      "Exotic",
    ],
  },
  {
    name: "Dairy, Bread & Eggs",
    subcategories: [
      "Milk",
      "Curd & Paneer",
      "Bread & Buns",
      "Eggs",
    ],
  },
  {
    name: "Munchies",
    subcategories: [
      "Chips & Namkeen",
      "Biscuits",
      "Chocolates",
      "Indian Snacks",
    ],
  },
  {
    name: "Cold Drinks & Juices",
    subcategories: [
      "Soft Drinks",
      "Fruit Juices",
      "Energy Drinks",
      "Water",
    ],
  },
  {
    name: "Breakfast & Instant Food",
    subcategories: [
      "Instant Meals",
      "Spreads",
    ],
  },
  {
    name: "Sweet Tooth",
    subcategories: [
      "Indian Sweets",
      "Desserts",
      "Baking Needs",
    ],
  },
  {
    name: "Bakery & Biscuits",
    subcategories: [
      "Cakes",
      "Cookies",
      "Rusks",
    ],
  },
  {
    name: "Tea, Coffee & More",
    subcategories: [
      "Tea",
      "Coffee",
      "Health Drinks",
    ],
  },
  {
    name: "Atta, Rice & Dal",
    subcategories: [
      "Atta & Flour",
      "Rice",
      "Dal & Pulses",
    ],
  },
  {
    name: "Masala, Oil & More",
    subcategories: [
      "Whole Spices",
      "Powdered Spices",
      "Cooking Oil",
    ],
  },
  {
    name: "Sauces & Spreads",
    subcategories: [
      "Sauces",
      "Pickles",
      "Chutney",
    ],
  },
  {
    name: "Chicken, Meat & Fish",
    subcategories: [
      "Chicken",
      "Mutton",
      "Fish",
    ],
  },
  {
    name: "Organic & Healthy Living",
    subcategories: [
      "Organic Staples",
      "Dry Fruits",
      "Seeds",
    ],
  },
  {
    name: "Baby Care",
    subcategories: [
      "Diapers",
      "Baby Food",
      "Baby Hygiene",
    ],
  },
  {
    name: "Pharma & Wellness",
    subcategories: [
      "OTC Medicines",
      "Vitamins",
      "First Aid",
    ],
  },
  {
    name: "Cleaning Essentials",
    subcategories: [
      "Home Cleaning",
      "Laundry",
      "Dishwash",
    ],
  },
  {
    name: "Personal Care",
    subcategories: [
      "Bath & Body",
      "Hair Care",
      "Oral Care",
    ],
  },
  {
    name: "Home & Office",
    subcategories: [
      "Kitchenware",
      "Stationery",
      "Electrical",
    ],
  },
  {
    name: "Pet Care",
    subcategories: [
      "Pet Food",
      "Pet Hygiene",
    ],
  },
];

// Recursive function to delete a category and all its descendants
async function deleteCategoryAndDescendants(categoryId: mongoose.Types.ObjectId): Promise<number> {
  let deletedCount = 0;

  // Find all children
  const children = await Category.find({ parentId: categoryId });

  // Recursively delete all children first
  for (const child of children) {
    deletedCount += await deleteCategoryAndDescendants(child._id);
  }

  // Delete the category itself
  const result = await Category.deleteOne({ _id: categoryId });
  if (result.deletedCount > 0) {
    deletedCount++;
  }

  return deletedCount;
}

async function removeGroceryCategories() {
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

    let totalDeleted = 0;
    let totalSkipped = 0;

    // 2. Process each main category from the seed data
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
        totalSkipped++;
        continue;
      }

      log(`Found category: ${categoryData.name} (${mainCategory._id})`);

      // Delete the category and all its descendants recursively
      const deletedCount = await deleteCategoryAndDescendants(mainCategory._id);
      totalDeleted += deletedCount;
      log(`Deleted ${deletedCount} items (category + subcategories + any descendants) for "${categoryData.name}"`);
    }

    // 3. Also delete any other categories under Grocery that might have been created
    // but not in our seed data (in case there were partial runs)
    const remainingCategories = await Category.find({
      headerCategoryId: headerCategory._id,
    });

    if (remainingCategories.length > 0) {
      log(`\n--- Cleaning up ${remainingCategories.length} remaining categories under Grocery ---`);
      for (const category of remainingCategories) {
        const deletedCount = await deleteCategoryAndDescendants(category._id);
        totalDeleted += deletedCount;
        log(`Deleted category: ${category.name} (${deletedCount} items total)`);
      }
    }

    log("\n✅ Deletion completed successfully!");
    log(`\nSummary:`);
    log(`- Header category: ${headerCategory.name}`);
    log(`- Total items deleted: ${totalDeleted}`);
    log(`- Categories not found (skipped): ${totalSkipped}`);

    // Verify deletion
    const remainingCount = await Category.countDocuments({
      headerCategoryId: headerCategory._id,
    });
    log(`- Remaining categories under Grocery: ${remainingCount}`);

    if (remainingCount === 0) {
      log("\n✅ All grocery categories have been successfully removed!");
    } else {
      log(`\n⚠️ Warning: ${remainingCount} categories still remain under Grocery header category.`);
    }

    process.exit(0);
  } catch (error: any) {
    log(`❌ Deletion failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

removeGroceryCategories();

