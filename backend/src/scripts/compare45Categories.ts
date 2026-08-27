import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";
import Product from "../models/Product";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const CATEGORIES_TO_SEED = [
  { order: 1, name: "Rani Masala Spices All" },
  { order: 2, name: "All Grocery Mart" },
  { order: 3, name: "Vegetable & Fruits Fresh" },
  { order: 4, name: "Oils Ghee" },
  { order: 5, name: "Dairy Items Milk Product" },
  { order: 6, name: "Chips Namkeen & Cold Drinks" },
  { order: 7, name: "Bakery & Biscuit Item" },
  { order: 8, name: "Sweet Farsan & Chocolate" },
  { order: 9, name: "Pan Parlour All Item" },
  { order: 10, name: "Tea & Coffee" },
  { order: 11, name: "Fruits Vegetable Juice" },
  { order: 12, name: "Icecream Faluda" },
  { order: 13, name: "Breakfast, Lunch & Dinner" },
  { order: 14, name: "Ready to Eat Item" },
  { order: 15, name: "Non Veg Restaurant" },
  { order: 16, name: "Cosmetics Item, Bath & Body" },
  { order: 17, name: "Skins Face Hair" },
  { order: 18, name: "Baby Care Products" },
  { order: 19, name: "Ladies Wear Fashion" },
  { order: 20, name: "Mens Wear Fashion" },
  { order: 21, name: "Foot Wear Ladies" },
  { order: 22, name: "Foot Wear Mens" },
  { order: 23, name: "Toys & Sports Item" },
  { order: 24, name: "Travel Item" },
  { order: 25, name: "Cleaners & Refill Item" },
  { order: 26, name: "Stationery & Games Item" },
  { order: 27, name: "Electronics All Items" },
  { order: 28, name: "Pet Store Products" },
  { order: 29, name: "Medical Health Pharma" },
  { order: 30, name: "Jewellery Item" },
  { order: 31, name: "Home Decor" },
  { order: 32, name: "Handicraft & Hosiery Item" },
  { order: 33, name: "Kids Wear" },
  { order: 34, name: "Ladies & Jean Bag Purse" },
  { order: 35, name: "Yoga & Jim Item" },
  { order: 36, name: "Kitchen Item Vasan Bhandar" },
  { order: 37, name: "AC, Fridge, TV, Electronics" },
  { order: 38, name: "Mobile Item Accessories" },
  { order: 39, name: "Furniture All" },
  { order: 40, name: "Puja Item" },
  { order: 41, name: "Festival Item" },
  { order: 42, name: "All Spices Wholesaler" },
  { order: 43, name: "Pan Masala Shutiya Wholesaler" },
  { order: 44, name: "All Kiriyana Item Wholesaler" },
  { order: 45, name: "Confectionery Retail Item" },
];

async function check() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("Connected to DB");

  const allDbCats = await Category.find({});
  console.log(`Total categories in DB: ${allDbCats.length}`);

  console.log("\n--- Checking each of the 45 Categories against DB ---");
  for (const item of CATEGORIES_TO_SEED) {
    const exactNameMatch = allDbCats.find(c => c.name.toLowerCase() === item.name.toLowerCase());
    const slugMatch = allDbCats.find(c => c.slug === item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    
    // Check partial matches or words
    const words = item.name.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['item', 'items', 'all'].includes(w));
    const partialMatch = allDbCats.filter(c => {
      const cName = c.name.toLowerCase();
      return words.some(w => cName.includes(w));
    });

    console.log(`\n[${item.order}] "${item.name}"`);
    if (exactNameMatch) {
      console.log(`  -> EXACT MATCH: "${exactNameMatch.name}" (_id: ${exactNameMatch._id}, slug: ${exactNameMatch.slug}, status: ${exactNameMatch.status}, parent: ${exactNameMatch.parentId}, order: ${exactNameMatch.order})`);
    } else if (slugMatch) {
      console.log(`  -> SLUG MATCH: "${slugMatch.name}" (_id: ${slugMatch._id}, slug: ${slugMatch.slug})`);
    } else {
      console.log(`  -> NOT FOUND in DB`);
      if (partialMatch.length > 0) {
        console.log(`     (Similar in DB: ${partialMatch.map(p => `"${p.name}" [${p._id}]`).join(", ")})`);
      }
    }
  }

  await mongoose.disconnect();
}

check();
