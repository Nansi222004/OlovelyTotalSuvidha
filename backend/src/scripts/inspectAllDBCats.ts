import mongoose from "mongoose";
import Category from "../models/Category";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const allCats = await Category.find({}).sort({ order: 1 });
  console.log(`Total categories in DB: ${allCats.length}`);
  for (const c of allCats) {
    console.log(`- [order: ${c.order}] "${c.name}" | slug: '${c.slug}' | status: '${c.status}' | parent: ${c.parentId} | header: ${c.headerCategoryId}`);
  }
  await mongoose.disconnect();
}
run();
