import mongoose from "mongoose";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function checkData() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI not found in environment");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const headers = await HeaderCategory.find({});
    console.log(`Found ${headers.length} header categories:`);
    headers.forEach(h => console.log(`- ${h.name} (${h._id})`));

    const categories = await Category.find({ status: "Active" });
    console.log(`\nFound ${categories.length} active categories`);

    const withHeader = categories.filter(c => c.headerCategoryId);
    const withoutHeaderTopLevel = categories.filter(c => !c.headerCategoryId && !c.parentId);
    const subcategories = categories.filter(c => c.parentId);

    console.log(`\nCategories with headerCategoryId: ${withHeader.length}`);
    console.log(`Top-level categories missing headerCategoryId: ${withoutHeaderTopLevel.length}`);
    console.log(`Subcategories (have parentId): ${subcategories.length}`);

    if (withHeader.length > 0) {
      console.log("\nSample categories with header mapping:");
      withHeader.slice(0, 5).forEach(c => {
        const header = headers.find(h => h._id.toString() === c.headerCategoryId?.toString());
        console.log(`- ${c.name} -> ${header ? header.name : "UNKNOWN HEADER (" + c.headerCategoryId + ")"}`);
      });
    }

    if (withoutHeaderTopLevel.length > 0) {
      console.log("\nSample top-level categories MISSING header mapping:");
      withoutHeaderTopLevel.slice(0, 5).forEach(c => console.log(`- ${c.name}`));
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
