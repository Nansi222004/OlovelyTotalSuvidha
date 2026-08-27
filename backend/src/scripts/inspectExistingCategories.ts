import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";
import Product from "../models/Product";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("Connected to DB");

    const headerCats = await HeaderCategory.find({}).sort({ order: 1 });
    console.log(`\n--- Header Categories (${headerCats.length}) ---`);
    headerCats.forEach((h) => {
      console.log(`[Header] ${h._id} | ${h.name} | slug: ${h.slug} | status: ${h.status} | order: ${h.order}`);
    });

    const rootCats = await Category.find({ parentId: null }).sort({ order: 1 });
    console.log(`\n--- Root Categories (parentId: null) (${rootCats.length}) ---`);
    for (const c of rootCats) {
      const prodCount = await Product.countDocuments({ category: c._id });
      const childCount = await Category.countDocuments({ parentId: c._id });
      console.log(`[Root] ${c._id} | "${c.name}" | slug: ${c.slug} | order: ${c.order} | status: ${c.status} | header: ${c.headerCategoryId} | children: ${childCount} | prods: ${prodCount}`);
    }

    const subCats = await Category.find({ parentId: { $ne: null } }).sort({ order: 1 });
    console.log(`\n--- Subcategories (have parentId) (${subCats.length}) ---`);
    for (const c of subCats) {
      const prodCount = await Product.countDocuments({ subcategory: c._id });
      console.log(`[Sub] ${c._id} | "${c.name}" | slug: ${c.slug} | parentId: ${c.parentId} | prods: ${prodCount}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
