import mongoose from "mongoose";
import HeaderCategory from "../models/HeaderCategory";
import Category from "../models/Category";
import Product from "../models/Product";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const headers = await HeaderCategory.find().sort({ order: 1 });
  for (const h of headers) {
    const catCount = await Category.countDocuments({ headerCategoryId: h._id });
    const prodCount = await Product.countDocuments({ headerCategoryId: h._id });
    console.log(`Header: '${h.name}' (slug: '${h.slug}', id: ${h._id}, status: ${h.status}) -> categories: ${catCount}, products: ${prodCount}`);
  }
  await mongoose.disconnect();
}
run();
