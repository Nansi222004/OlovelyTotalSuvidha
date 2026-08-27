import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import Category from "../models/Category";
import { cache } from "../utils/cache";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../seed_45_categories.log");

function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  try {
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  } catch {
    // Ignore logging file errors
  }
  console.log(message);
}

// Configuration
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";

// Helper to generate clean slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface CategorySeedItem {
  order: number;
  name: string;
  image: string;
}

export const CATEGORIES_45_LIST: CategorySeedItem[] = [
  { order: 1, name: "Rani Masala Spices All", image: "/assets/category-masala.png" },
  { order: 2, name: "All Grocery Mart", image: "/assets/category-organic-&-healthy-living.png" },
  { order: 3, name: "Vegetable & Fruits Fresh", image: "/assets/category-fruits-veg.png" },
  { order: 4, name: "Oils Ghee", image: "/assets/category-dairy.png" },
  { order: 5, name: "Dairy Items Milk Product", image: "/assets/category-dairy.png" },
  { order: 6, name: "Chips Namkeen & Cold Drinks", image: "/assets/category-snacks.png" },
  { order: 7, name: "Bakery & Biscuit Item", image: "/assets/category-biscuits.png" },
  { order: 8, name: "Sweet Farsan & Chocolate", image: "/assets/category-sweet-tooth.png" },
  { order: 9, name: "Pan Parlour All Item", image: "/assets/category-paan-corner.png" },
  { order: 10, name: "Tea & Coffee", image: "/assets/category-tea,-coffe-&-health-drink.png" },
  { order: 11, name: "Fruits Vegetable Juice", image: "/assets/category-drinks.png" },
  { order: 12, name: "Icecream Faluda", image: "/assets/category-sweet-tooth.png" },
  { order: 13, name: "Breakfast, Lunch & Dinner", image: "/assets/category-breakfast.png" },
  { order: 14, name: "Ready to Eat Item", image: "/assets/category-breakfast.png" },
  { order: 15, name: "Non Veg Restaurant", image: "/assets/category-chicken,-meat-&-fish.png" },
  { order: 16, name: "Cosmetics Item, Bath & Body", image: "/assets/category-personal-care.png" },
  { order: 17, name: "Skins Face Hair", image: "/assets/category-personal-care.png" },
  { order: 18, name: "Baby Care Products", image: "/assets/category-baby-care.png" },
  { order: 19, name: "Ladies Wear Fashion", image: "/assets/shopbystore/fashion.jpg" },
  { order: 20, name: "Mens Wear Fashion", image: "/assets/shopbystore/fashion.jpg" },
  { order: 21, name: "Foot Wear Ladies", image: "/assets/shopbystore/fashion.jpg" },
  { order: 22, name: "Foot Wear Mens", image: "/assets/shopbystore/fashion.jpg" },
  { order: 23, name: "Toys & Sports Item", image: "/assets/shopbystore/sports.jpg" },
  { order: 24, name: "Travel Item", image: "/assets/shopbystore/hobby.jpg" },
  { order: 25, name: "Cleaners & Refill Item", image: "/assets/category-cleaning.png" },
  { order: 26, name: "Stationery & Games Item", image: "/assets/category-home-&-office.png" },
  { order: 27, name: "Electronics All Items", image: "/assets/shopbystore/hobby.jpg" },
  { order: 28, name: "Pet Store Products", image: "/assets/category-pet-care.png" },
  { order: 29, name: "Medical Health Pharma", image: "/assets/category-pharma-&-wellness.png" },
  { order: 30, name: "Jewellery Item", image: "/assets/shopbystore/fashion.jpg" },
  { order: 31, name: "Home Decor", image: "/assets/category-home-&-office.png" },
  { order: 32, name: "Handicraft & Hosiery Item", image: "/assets/shopbystore/fashion.jpg" },
  { order: 33, name: "Kids Wear", image: "/assets/shopbystore/fashion.jpg" },
  { order: 34, name: "Ladies & Jean Bag Purse", image: "/assets/shopbystore/fashion.jpg" },
  { order: 35, name: "Yoga & Jim Item", image: "/assets/shopbystore/sports.jpg" },
  { order: 36, name: "Kitchen Item Vasan Bhandar", image: "/assets/category-home-&-office.png" },
  { order: 37, name: "AC, Fridge, TV, Electronics", image: "/assets/shopbystore/hobby.jpg" },
  { order: 38, name: "Mobile Item Accessories", image: "/assets/shopbystore/hobby.jpg" },
  { order: 39, name: "Furniture All", image: "/assets/category-home-&-office.png" },
  { order: 40, name: "Puja Item", image: "/assets/shopbystore/spiritual.jpg" },
  { order: 41, name: "Festival Item", image: "/assets/shopbystore/spiritual.jpg" },
  { order: 42, name: "All Spices Wholesaler", image: "/assets/category-masala.png" },
  { order: 43, name: "Pan Masala Shutiya Wholesaler", image: "/assets/category-paan-corner.png" },
  { order: 44, name: "All Kiriyana Item Wholesaler", image: "/assets/category-organic-&-healthy-living.png" },
  { order: 45, name: "Confectionery Retail Item", image: "/assets/category-sweet-tooth.png" },
];

export async function seed45Categories() {
  log("==================================================================");
  log("Starting Seed Script: 45 Handwritten Categories for Olovely Admin");
  log("==================================================================");

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
      log("Connected to MongoDB successfully");
    }

    const createdList: { order: number; name: string; id: string; slug: string }[] = [];
    const skippedOrUpdatedList: { order: number; name: string; id: string; slug: string; reason: string }[] = [];

    for (const item of CATEGORIES_45_LIST) {
      const generatedSlug = generateSlug(item.name);

      // Check if category already exists by exact name (case-insensitive) or slug
      const existing = await Category.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
          { slug: generatedSlug },
        ],
      });

      if (existing) {
        // Update order and ensure active status without breaking relationships
        let modified = false;
        if (existing.order !== item.order) {
          existing.order = item.order;
          modified = true;
        }
        if (existing.status !== "Active") {
          existing.status = "Active";
          modified = true;
        }
        if (!existing.image && item.image) {
          existing.image = item.image;
          modified = true;
        }

        if (modified) {
          await existing.save();
        }

        skippedOrUpdatedList.push({
          order: item.order,
          name: existing.name,
          id: existing._id.toString(),
          slug: existing.slug,
          reason: modified ? "Updated existing category order/status" : "Already existed with identical settings",
        });

        log(`[EXISTS] [${item.order}/45] "${item.name}" -> ID: ${existing._id} (Order: ${existing.order}, Status: ${existing.status})`);
      } else {
        // Create new category record
        const newCat = await Category.create({
          name: item.name,
          slug: generatedSlug,
          order: item.order,
          image: item.image || "",
          status: "Active",
          parentId: null,
          headerCategoryId: null,
          isBestseller: false,
          hasWarning: false,
          totalSubcategories: 0,
          commissionRate: 0,
          translations: {},
        });

        createdList.push({
          order: item.order,
          name: newCat.name,
          id: newCat._id.toString(),
          slug: newCat.slug,
        });

        log(`[CREATED] [${item.order}/45] "${newCat.name}" -> ID: ${newCat._id}, Slug: "${newCat.slug}", Order: ${newCat.order}`);
      }
    }

    // Invalidate relevant category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-list-v2");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);
    log("Invalidated category caches");

    // Verification queries
    const allListNames = CATEGORIES_45_LIST.map((c) => c.name);
    const dbMatchedCategories = await Category.find({
      name: { $in: allListNames },
    }).sort({ order: 1 });

    const activeCount = dbMatchedCategories.filter((c) => c.status === "Active").length;
    const missing = CATEGORIES_45_LIST.filter(
      (c) => !dbMatchedCategories.some((db) => db.name.toLowerCase() === c.name.toLowerCase())
    );

    // Duplicate check
    const nameMap = new Map<string, number>();
    for (const c of dbMatchedCategories) {
      const lower = c.name.toLowerCase();
      nameMap.set(lower, (nameMap.get(lower) || 0) + 1);
    }
    const duplicates = Array.from(nameMap.entries()).filter(([_, count]) => count > 1);

    log("\n==================================================================");
    log("                       SEEDING SUMMARY REPORT                     ");
    log("==================================================================");
    log(`Categories in target list:         ${CATEGORIES_45_LIST.length}`);
    log(`Categories newly created:          ${createdList.length}`);
    log(`Categories skipped / updated:      ${skippedOrUpdatedList.length}`);
    log(`Total matched categories in DB:    ${dbMatchedCategories.length}`);
    log(`Active categories from list:       ${activeCount}`);
    log(`Duplicate seeded categories:       ${duplicates.length}`);
    log(`Missing categories from list:      ${missing.length}`);
    log("==================================================================\n");

    return {
      success: true,
      createdCount: createdList.length,
      skippedCount: skippedOrUpdatedList.length,
      totalCount: dbMatchedCategories.length,
      activeCount,
      duplicatesCount: duplicates.length,
      missingCount: missing.length,
      createdList,
      skippedOrUpdatedList,
    };
  } catch (error: any) {
    log(`Error during 45 categories seeding: ${error.message}`);
    console.error(error);
    throw error;
  }
}

// Execute directly if run via CLI
if (require.main === module) {
  seed45Categories()
    .then(async () => {
      await mongoose.disconnect();
      log("Database disconnected. Seeding completed successfully.");
      process.exit(0);
    })
    .catch(async (err) => {
      await mongoose.disconnect();
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
