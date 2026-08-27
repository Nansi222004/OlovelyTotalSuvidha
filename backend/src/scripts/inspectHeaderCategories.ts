import mongoose from "mongoose";
import HeaderCategory from "../models/HeaderCategory";
import Category from "../models/Category";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const headers = await HeaderCategory.find().sort({ order: 1 });
  console.log(`Total Header Categories: ${headers.length}`);
  for (const h of headers) {
    console.log(`- [${h.order}] ${h.name} | slug: '${h.slug}' | icon: '${h.iconName}' | status: '${h.status}' | related: '${h.relatedCategory}' | _id: ${h._id}`);
  }
  await mongoose.disconnect();
}
run();
