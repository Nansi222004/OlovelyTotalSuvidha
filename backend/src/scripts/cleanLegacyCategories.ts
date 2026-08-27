import mongoose from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";
import { CATEGORIES_45_LIST } from "./seed45Categories";
import { cache } from "../utils/cache";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const targetNames = new Set(CATEGORIES_45_LIST.map((c) => c.name.toLowerCase()));
  const allCats = await Category.find({});
  const legacyCats = allCats.filter((c) => !targetNames.has(c.name.toLowerCase()));

  console.log(`Total in DB: ${allCats.length}`);
  console.log(`45 Target Categories: ${allCats.length - legacyCats.length}`);
  console.log(`Legacy Categories to clean: ${legacyCats.length}`);

  for (const c of legacyCats) {
    const prodCount = await Product.countDocuments({ category: c._id });
    console.log(`- Legacy: "${c.name}" (id: ${c._id}, status: ${c.status}, parent: ${c.parentId}, prods: ${prodCount})`);
  }

  // Deactivate or remove legacy categories so ONLY the 45 categories appear
  if (legacyCats.length > 0) {
    const legacyIds = legacyCats.map((c) => c._id);
    const res = await Category.deleteMany({ _id: { $in: legacyIds } });
    console.log(`\nRemoved ${res.deletedCount} legacy categories from Category collection.`);
  }

  // Invalidate caches
  cache.delete("customer-categories-list");
  cache.delete("customer-categories-list-v2");
  cache.delete("customer-categories-tree");
  cache.invalidatePattern(/^customer-category-/);
  cache.invalidatePattern(/^home-content-/);

  const remaining = await Category.find({ status: "Active" }).sort({ order: 1 });
  console.log(`\nRemaining Active Categories in DB: ${remaining.length}`);
  remaining.forEach((c) => console.log(`  [${c.order}] ${c.name} (${c.slug})`));

  await mongoose.disconnect();
}
run();
