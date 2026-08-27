import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import HeaderCategory from "../models/HeaderCategory";
import Category from "../models/Category";
import { cache } from "../utils/cache";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";

export interface HeaderCategoryConfig {
  order: number;
  name: string;
  slug: string;
  iconName: string;
  categoryNames: string[];
}

export const HEADER_CATEGORIES_CONFIG: HeaderCategoryConfig[] = [
  {
    order: 1,
    name: "Grocery",
    slug: "grocery",
    iconName: "grocery-basket",
    categoryNames: [
      "Rani Masala Spices All",
      "All Grocery Mart",
      "Oils Ghee",
      "Pan Parlour All Item",
      "Tea & Coffee",
      "Breakfast, Lunch & Dinner",
      "Ready to Eat Item",
      "Non Veg Restaurant",
      "All Spices Wholesaler",
      "Pan Masala Shutiya Wholesaler",
      "All Kiriyana Item Wholesaler",
    ],
  },
  {
    order: 2,
    name: "Fruits & Vegetables",
    slug: "fruits-vegetables",
    iconName: "vegetables",
    categoryNames: [
      "Vegetable & Fruits Fresh",
      "Fruits Vegetable Juice",
    ],
  },
  {
    order: 3,
    name: "Dairy & Milk",
    slug: "dairy-milk",
    iconName: "milk-dairy",
    categoryNames: [
      "Dairy Items Milk Product",
    ],
  },
  {
    order: 4,
    name: "Bakery & Biscuits",
    slug: "bakery-biscuits",
    iconName: "bakery",
    categoryNames: [
      "Bakery & Biscuit Item",
    ],
  },
  {
    order: 5,
    name: "Snacks & Drinks",
    slug: "snacks-drinks",
    iconName: "fast-food",
    categoryNames: [
      "Chips Namkeen & Cold Drinks",
      "Sweet Farsan & Chocolate",
      "Icecream Faluda",
      "Confectionery Retail Item",
    ],
  },
  {
    order: 6,
    name: "Beauty",
    slug: "beauty",
    iconName: "beauty-cosmetics",
    categoryNames: [
      "Cosmetics Item, Bath & Body",
      "Skins Face Hair",
      "Baby Care Products",
      "Medical Health Pharma",
    ],
  },
  {
    order: 7,
    name: "Fashion",
    slug: "fashion",
    iconName: "fashion",
    categoryNames: [
      "Ladies Wear Fashion",
      "Mens Wear Fashion",
      "Foot Wear Ladies",
      "Foot Wear Mens",
      "Jewellery Item",
      "Handicraft & Hosiery Item",
      "Kids Wear",
      "Ladies & Jean Bag Purse",
    ],
  },
  {
    order: 8,
    name: "Electronics",
    slug: "electronics",
    iconName: "electronics",
    categoryNames: [
      "Electronics All Items",
      "AC, Fridge, TV, Electronics",
      "Mobile Item Accessories",
    ],
  },
  {
    order: 9,
    name: "Home & Furniture",
    slug: "home-furniture",
    iconName: "furniture",
    categoryNames: [
      "Travel Item",
      "Cleaners & Refill Item",
      "Stationery & Games Item",
      "Pet Store Products",
      "Home Decor",
      "Kitchen Item Vasan Bhandar",
      "Furniture All",
      "Puja Item",
      "Festival Item",
    ],
  },
  {
    order: 10,
    name: "Toys & Sports",
    slug: "toys-sports",
    iconName: "sports",
    categoryNames: [
      "Toys & Sports Item",
      "Yoga & Jim Item",
    ],
  },
];

export async function syncHeaderCategories() {
  console.log("==================================================================");
  console.log("     SYNC CUSTOMER HEADER CATEGORIES (45 CATEGORY MAPPING)       ");
  console.log("==================================================================");

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
      console.log("Connected to MongoDB");
    }

    // 1. Unpublish deprecated / placeholder header categories
    const unpublishSlugs = ["wedding", "winter", "teal", "all", "household", "dairy-breakfast", "personal-care", "sports"];
    await HeaderCategory.updateMany(
      { slug: { $in: unpublishSlugs } },
      { $set: { status: "Unpublished" } }
    );
    console.log(`Unpublished deprecated header categories: ${unpublishSlugs.join(", ")}`);

    // 2. Create or Update the 10 curated published HeaderCategories
    const headerMap = new Map<string, mongoose.Types.ObjectId>();

    for (const config of HEADER_CATEGORIES_CONFIG) {
      let header = await HeaderCategory.findOne({
        $or: [{ slug: config.slug }, { name: config.name }],
      });

      if (header) {
        header.name = config.name;
        header.slug = config.slug;
        header.iconName = config.iconName;
        header.iconLibrary = "Custom";
        header.order = config.order;
        header.status = "Published";
        await header.save();
        console.log(`[UPDATED HEADER] [${config.order}] "${header.name}" (slug: '${header.slug}', icon: '${header.iconName}')`);
      } else {
        header = await HeaderCategory.create({
          name: config.name,
          slug: config.slug,
          iconName: config.iconName,
          iconLibrary: "Custom",
          order: config.order,
          status: "Published",
        });
        console.log(`[CREATED HEADER] [${config.order}] "${header.name}" (slug: '${header.slug}', icon: '${header.iconName}')`);
      }

      headerMap.set(config.slug, header._id as mongoose.Types.ObjectId);
    }

    // 3. Map the 45 categories to their HeaderCategory IDs
    console.log("\n--- Mapping 45 Categories to HeaderCategory IDs ---");
    let mappedCount = 0;

    for (const config of HEADER_CATEGORIES_CONFIG) {
      const headerId = headerMap.get(config.slug);
      if (!headerId) continue;

      for (const catName of config.categoryNames) {
        const cat = await Category.findOne({
          name: { $regex: new RegExp(`^${catName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        });

        if (cat) {
          cat.headerCategoryId = headerId;
          await cat.save();
          mappedCount++;
          console.log(`  - Category "${cat.name}" -> Header "${config.name}" (order: ${config.order})`);
        } else {
          console.warn(`  ! WARNING: Category "${catName}" not found in DB!`);
        }
      }
    }

    // 4. Invalidate caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-list-v2");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);
    cache.invalidatePattern(/^home-content-/);
    console.log("\nInvalidated backend customer and category caches.");

    console.log("\n==================================================================");
    console.log("                 HEADER SYNC COMPLETED SUCCESSFULLY               ");
    console.log("==================================================================");
    console.log(`Curated Header Categories: ${HEADER_CATEGORIES_CONFIG.length}`);
    console.log(`Total 45 Categories Mapped: ${mappedCount} / 45`);
    console.log("==================================================================\n");

    return {
      success: true,
      headerCount: HEADER_CATEGORIES_CONFIG.length,
      mappedCount,
    };
  } catch (err: any) {
    console.error("Failed to sync header categories:", err);
    throw err;
  }
}

if (require.main === module) {
  syncHeaderCategories()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      await mongoose.disconnect();
      process.exit(1);
    });
}
