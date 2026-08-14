import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

const SellerSchema = new mongoose.Schema({}, { strict: false });
const Seller = mongoose.models.Seller || mongoose.model("Seller", SellerSchema);

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("MONGODB_URI missing");
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    console.log("\n=== All Products ===");
    const products = await Product.find({})
      .select("_id productName seller")
      .lean();
    console.log(JSON.stringify(products, null, 2));

    console.log("\n=== All Sellers ===");
    const sellers = await Seller.find({})
      .select("_id sellerName mobile")
      .lean();
    console.log(JSON.stringify(sellers, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
};

run();
