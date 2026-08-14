import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(__dirname, "../../seed_grocery_categories.log");
function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/assets");

log("Starting Grocery Categories Seed Script");
log(`MONGO_URI: ${MONGO_URI}`);
log(`FRONTEND_ASSETS_PATH: ${FRONTEND_ASSETS_PATH}`);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper to generate slug from name
function generateSlug(name: string, parentSlug?: string): string {
  let slug = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // If parent slug is provided, prefix it to ensure uniqueness
  if (parentSlug) {
    slug = `${parentSlug}-${slug}`;
  }

  return slug;
}

// Helper to find or generate unique slug
async function findOrGenerateUniqueSlug(
  baseName: string,
  parentSlug?: string,
  parentId?: Types.ObjectId
): Promise<string> {
  let slug = generateSlug(baseName, parentSlug);
  let counter = 1;
  const originalSlug = slug;

  // Check if slug already exists (globally, since slug is unique)
  while (true) {
    const existing = await Category.findOne({ slug });

    // If doesn't exist, use it
    if (!existing) {
      return slug;
    }

    // If exists with same parent, that's the one we want (skip creation in calling code)
    if (parentId && existing.parentId?.toString() === parentId.toString()) {
      return slug;
    }

    // Slug exists with different parent, generate new one
    slug = `${originalSlug}-${counter}`;
    counter++;

    // Safety check to prevent infinite loop
    if (counter > 100) {
      throw new Error(`Could not generate unique slug for ${baseName} after 100 attempts`);
    }
  }
}

// Helper to upload to Cloudinary
async function uploadToCloudinary(
  localPath: string,
  folder: string = "categories"
): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    log("Cloudinary not configured, using local path");
    return localPath.startsWith("http")
      ? localPath
      : `/assets/category/${path.basename(localPath)}`;
  }

  const fullPath = path.join(FRONTEND_ASSETS_PATH, "category", path.basename(localPath));

  if (!fs.existsSync(fullPath)) {
    log(`Warning: File not found: ${fullPath}, using path as-is`);
    return localPath.startsWith("http")
      ? localPath
      : `/assets/category/${path.basename(localPath)}`;
  }

  try {
    const result = await cloudinary.uploader.upload(fullPath, {
      folder: folder,
      resource_type: "image",
    });
    log(`Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error: any) {
    log(`Cloudinary upload failed: ${error.message}, using local path`);
    return localPath.startsWith("http")
      ? localPath
      : `/assets/category/${path.basename(localPath)}`;
  }
}

// Get the default image path
async function getDefaultImage(): Promise<string> {
  const imageFileName = "Breakfast & Instant Food.png";
  const imagePath = `/assets/category/${imageFileName}`;

  // Check if file exists locally
  const fullPath = path.join(FRONTEND_ASSETS_PATH, "category", imageFileName);
  if (!fs.existsSync(fullPath)) {
    log(`Warning: Image file not found at ${fullPath}, using path as-is`);
    return imagePath;
  }

  // Try to upload to Cloudinary if configured
  const uploadedUrl = await uploadToCloudinary(imageFileName, "categories");
  if (uploadedUrl) {
    return uploadedUrl;
  }

  return imagePath;
}

// Grocery Categories Data Structure (Categories and Subcategories only - no items)
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

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Find "Grocery" header category
    const headerCategory = await HeaderCategory.findOne({
      $or: [{ name: "Grocery" }, { slug: "grocery" }],
    });

    if (!headerCategory) {
      log(
        '❌ Header category "Grocery" not found. Please create it first.'
      );
      process.exit(1);
    }

    log(`Found header category: ${headerCategory.name} (${headerCategory._id})`);

    // 2. Get default image
    const defaultImage = await getDefaultImage();
    log(`Using default image: ${defaultImage}`);

    let totalCategoriesCreated = 0;
    let totalSubcategoriesCreated = 0;
    let totalSkipped = 0;

    // 3. Process each main category
    for (let categoryIndex = 0; categoryIndex < groceryCategoriesData.length; categoryIndex++) {
      const categoryData = groceryCategoriesData[categoryIndex];
      log(`\n--- Processing Category: ${categoryData.name} ---`);

      // Check if main category already exists
      const existingCategory = await Category.findOne({
        name: categoryData.name,
        headerCategoryId: headerCategory._id,
        parentId: null,
      });

      let mainCategory;
      if (existingCategory) {
        log(`Category "${categoryData.name}" already exists, skipping creation...`);
        mainCategory = existingCategory;
        totalSkipped++;
      } else {
        // Create main category with unique slug
        try {
          const categorySlug = await findOrGenerateUniqueSlug(categoryData.name);
          mainCategory = await Category.create({
            name: categoryData.name,
            slug: categorySlug,
            image: defaultImage,
            order: categoryIndex,
            status: "Active",
            isBestseller: false,
            hasWarning: false,
            parentId: null,
            headerCategoryId: headerCategory._id,
          });
          totalCategoriesCreated++;
          log(`Created category: ${categoryData.name} (slug: ${categorySlug})`);
        } catch (error: any) {
          if (error.code === 11000 && error.keyPattern?.slug) {
            // Duplicate slug error - try to find existing category
            const categorySlug = generateSlug(categoryData.name);
            const existingBySlug = await Category.findOne({ slug: categorySlug });
            if (existingBySlug && existingBySlug.headerCategoryId?.toString() === headerCategory._id.toString()) {
              log(`Category with slug "${categorySlug}" already exists, using existing...`);
              mainCategory = existingBySlug;
              totalSkipped++;
            } else {
              // Generate a new unique slug and retry
              const newSlug = await findOrGenerateUniqueSlug(categoryData.name);
              mainCategory = await Category.create({
                name: categoryData.name,
                slug: newSlug,
                image: defaultImage,
                order: categoryIndex,
                status: "Active",
                isBestseller: false,
                hasWarning: false,
                parentId: null,
                headerCategoryId: headerCategory._id,
              });
              totalCategoriesCreated++;
              log(`Created category: ${categoryData.name} (slug: ${newSlug})`);
            }
          } else {
            throw error;
          }
        }
      }

      // 4. Process subcategories for this category
      for (let subcatIndex = 0; subcatIndex < categoryData.subcategories.length; subcatIndex++) {
        const subcategoryName = categoryData.subcategories[subcatIndex];
        log(`  Processing subcategory: ${subcategoryName}`);

        // Check if subcategory already exists
        const existingSubcategory = await Category.findOne({
          name: subcategoryName,
          parentId: mainCategory._id,
        });

        if (existingSubcategory) {
          log(`  Subcategory "${subcategoryName}" already exists, skipping creation...`);
          totalSkipped++;
        } else {
          // Create subcategory with unique slug (include parent slug for uniqueness)
          try {
            const mainCategorySlug = mainCategory.slug || generateSlug(mainCategory.name);
            const subcategorySlug = await findOrGenerateUniqueSlug(
              subcategoryName,
              mainCategorySlug,
              mainCategory._id
            );
            await Category.create({
              name: subcategoryName,
              slug: subcategorySlug,
              image: defaultImage,
              order: subcatIndex,
              status: "Active",
              isBestseller: false,
              hasWarning: false,
              parentId: mainCategory._id,
              headerCategoryId: headerCategory._id,
            });
            totalSubcategoriesCreated++;
            log(`  Created subcategory: ${subcategoryName} (slug: ${subcategorySlug})`);
          } catch (error: any) {
            if (error.code === 11000 && error.keyPattern?.slug) {
              // Duplicate slug error - try to find existing subcategory
              const mainCategorySlug = mainCategory.slug || generateSlug(mainCategory.name);
              const baseSlug = generateSlug(subcategoryName, mainCategorySlug);
              const existingBySlug = await Category.findOne({ slug: baseSlug });
              if (existingBySlug && existingBySlug.parentId?.toString() === mainCategory._id.toString()) {
                log(`  Subcategory with slug "${baseSlug}" already exists, using existing...`);
                totalSkipped++;
              } else {
                // Generate a new unique slug and retry
                const newSlug = await findOrGenerateUniqueSlug(
                  subcategoryName,
                  mainCategorySlug,
                  mainCategory._id
                );
                await Category.create({
                  name: subcategoryName,
                  slug: newSlug,
                  image: defaultImage,
                  order: subcatIndex,
                  status: "Active",
                  isBestseller: false,
                  hasWarning: false,
                  parentId: mainCategory._id,
                  headerCategoryId: headerCategory._id,
                });
                totalSubcategoriesCreated++;
                log(`  Created subcategory: ${subcategoryName} (slug: ${newSlug})`);
              }
            } else {
              throw error;
            }
          }
        }
      }
    }

    log("\n✅ Seeding completed successfully!");
    log(`\nSummary:`);
    log(`- Header category: ${headerCategory.name}`);
    log(`- Main categories created: ${totalCategoriesCreated}`);
    log(`- Subcategories created: ${totalSubcategoriesCreated}`);
    log(`- Items skipped (already exist): ${totalSkipped}`);
    log(
      `\nTotal items created: ${totalCategoriesCreated + totalSubcategoriesCreated}`
    );

    process.exit(0);
  } catch (error: any) {
    log(`❌ Seeding failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

seed();


