import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/assets");
const PRODUCT_IMAGES_PATH = path.join(
  FRONTEND_ASSETS_PATH,
  "Image-20251130T081301Z-1-001",
  "Image",
  "product",
  "product"
);

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

  // Common words to filter out
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

    // Check exact match first
    if (normalizeString(folder) === normalizedName) {
      matches.push({ folder, score: 1000 });
      continue;
    }

    // Check if any significant word from sub-subcategory is in folder name
    for (const word of searchWords) {
      if (folderLower.includes(word)) {
        score += word.length * 2;
        matchedWords++;
      }
    }

    // Also check if folder name is contained in sub-subcategory name
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

  // Sort by score descending and return top matches
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

  // Try exact match first: [ProductFolderName].jpg
  const exactMatch = `${productFolder}.jpg`;
  if (files.includes(exactMatch)) {
    return path.join(productPath, exactMatch);
  }

  // Try other extensions
  for (const ext of imageExtensions) {
    const fileName = `${productFolder}${ext}`;
    if (files.includes(fileName)) {
      return path.join(productPath, fileName);
    }
  }

  // Try to find any image file (prefer .jpg)
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

interface ProductMapping {
  category: string;
  subcategory: string;
  subSubcategory: string;
  products: Array<{
    name: string;
    imagePath: string | null;
  }>;
}

async function analyzeProducts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Find Grocery header category
    const headerCategory = await HeaderCategory.findOne({
      $or: [{ name: "Grocery" }, { slug: "grocery" }],
    });

    if (!headerCategory) {
      console.log('❌ Header category "Grocery" not found.');
      process.exit(1);
    }

    console.log(`Found header category: ${headerCategory.name}\n`);

    // Find all sub-subcategories (categories with parentId that is a subcategory)
    const allSubcategories = await Category.find({
      headerCategoryId: headerCategory._id,
      parentId: { $ne: null },
      status: "Active",
    });

    // Get all sub-subcategories (categories whose parent is a subcategory)
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

    console.log(`Found ${subSubcategories.length} sub-subcategories\n`);

    const productMappings: ProductMapping[] = [];
    let totalProductsFound = 0;
    let totalProductsWithImages = 0;

    // Process each sub-subcategory
    for (const subSubcat of subSubcategories) {
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

      // Find best matching products
      const matchedProducts = findBestMatchProducts(
        subSubcat.name,
        productFolders,
        2
      );

      const products: Array<{ name: string; imagePath: string | null }> = [];

      for (const productFolder of matchedProducts) {
        const imagePath = findProductImage(
          categoryFolder,
          subcategoryFolder,
          productFolder
        );
        products.push({
          name: productFolder,
          imagePath: imagePath,
        });
        totalProductsFound++;
        if (imagePath) {
          totalProductsWithImages++;
        }
      }

      if (products.length > 0) {
        productMappings.push({
          category: subSubcat.categoryName,
          subcategory: subSubcat.subcategoryName,
          subSubcategory: subSubcat.name,
          products: products,
        });
      }
    }

    // Display results
    console.log("=".repeat(80));
    console.log("PRODUCT MAPPING ANALYSIS");
    console.log("=".repeat(80));
    console.log(`\nTotal Sub-Subcategories: ${subSubcategories.length}`);
    console.log(`Sub-Subcategories with products found: ${productMappings.length}`);
    console.log(`Total products to be added: ${totalProductsFound}`);
    console.log(`Products with images: ${totalProductsWithImages}`);
    console.log(`Products without images: ${totalProductsFound - totalProductsWithImages}\n`);

    console.log("\n" + "=".repeat(80));
    console.log("DETAILED PRODUCT LIST");
    console.log("=".repeat(80) + "\n");

    for (const mapping of productMappings) {
      console.log(
        `\n📦 ${mapping.category} > ${mapping.subcategory} > ${mapping.subSubcategory}`
      );
      for (const product of mapping.products) {
        const imageStatus = product.imagePath ? "✅" : "❌";
        console.log(`   ${imageStatus} ${product.name}`);
        if (product.imagePath) {
          console.log(`      Image: ${path.relative(PRODUCT_IMAGES_PATH, product.imagePath)}`);
        }
      }
    }

    // Save to JSON file
    const outputPath = path.join(__dirname, "../../product_mappings.json");
    fs.writeFileSync(
      outputPath,
      JSON.stringify(productMappings, null, 2),
      "utf-8"
    );
    console.log(`\n\n✅ Analysis complete! Results saved to: ${outputPath}`);

    process.exit(0);
  } catch (error: any) {
    console.error(`❌ Analysis failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeProducts();


