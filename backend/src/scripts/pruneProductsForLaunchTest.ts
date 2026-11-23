/**
 * One-off clean-up requested for the launch test (2026-11-24): permanently delete every product
 * except the three kept below, and remove references to the deleted products from carts,
 * wishlists, reviews, inventory rows, "Lowest Prices", home sections, shops and promo strips.
 * Order items, returns and inventory transactions are history and are left untouched.
 *
 * A JSON backup of everything deleted is written before any change.
 *
 *   npx tsx src/scripts/pruneProductsForLaunchTest.ts <backupDir>            # report only
 *   npx tsx src/scripts/pruneProductsForLaunchTest.ts <backupDir> --apply    # back up + delete
 */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/Product";
import CartItem from "../models/CartItem";
import Wishlist from "../models/Wishlist";
import Review from "../models/Review";
import Inventory from "../models/Inventory";
import LowestPricesProduct from "../models/LowestPricesProduct";
import HomeSection from "../models/HomeSection";
import Shop from "../models/Shop";
import PromoStrip from "../models/PromoStrip";

dotenv.config();

const KEEP_IDS = [
  "6b0420a3b32fd7c0667b9716", // CORINDER POWDER (Admin / Platform)
  "6afd37d6434dc215b01ff8a8", // Olovely Test Product (Ajay store)
  "6ab76082934498a2f5963e9e", // Fresh Cow Milk 500ml (Neelam Store)
].map((id) => new mongoose.Types.ObjectId(id));

const APPLY = process.argv.includes("--apply");
const backupDir = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const kept = await Product.find({ _id: { $in: KEEP_IDS } }).select("productName").lean();
  if (kept.length !== KEEP_IDS.length) {
    throw new Error(`Expected ${KEEP_IDS.length} products to keep, found ${kept.length}. Aborting.`);
  }
  console.log(`Keeping: ${kept.map((p: any) => p.productName).join(" | ")}`);

  const toDelete = await Product.find({ _id: { $nin: KEEP_IDS } }).lean();
  const ids = toDelete.map((p: any) => p._id);
  const inIds = { $in: ids };

  const related = {
    cartItems: await CartItem.find({ product: inIds }).lean(),
    reviews: await Review.find({ product: inIds }).lean(),
    inventory: await Inventory.find({ product: inIds }).lean(),
    lowestPrices: await LowestPricesProduct.find({ product: inIds }).lean(),
  };
  const counts = {
    wishlists: await Wishlist.countDocuments({ products: inIds }),
    homeSections: await HomeSection.countDocuments({ products: inIds }),
    shops: await Shop.countDocuments({ products: inIds }),
    promoStrips: await PromoStrip.countDocuments({ featuredProducts: inIds }),
  };

  console.log(`Products to delete: ${toDelete.length}`);
  console.log(
    `Related: cart items ${related.cartItems.length}, reviews ${related.reviews.length}, inventory rows ${related.inventory.length}, lowest-prices ${related.lowestPrices.length}; ` +
      `references to remove in wishlists ${counts.wishlists}, home sections ${counts.homeSections}, shops ${counts.shops}, promo strips ${counts.promoStrips}`
  );

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to back up and delete.");
    await mongoose.disconnect();
    return;
  }
  if (!backupDir) throw new Error("A backup directory argument is required with --apply.");

  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `products-backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ deletedAt: new Date().toISOString(), products: toDelete, ...related }, null, 1));
  console.log(`Backup written: ${backupFile}`);

  const r = {
    products: (await Product.deleteMany({ _id: inIds })).deletedCount,
    cartItems: (await CartItem.deleteMany({ product: inIds })).deletedCount,
    reviews: (await Review.deleteMany({ product: inIds })).deletedCount,
    inventory: (await Inventory.deleteMany({ product: inIds })).deletedCount,
    lowestPrices: (await LowestPricesProduct.deleteMany({ product: inIds })).deletedCount,
    wishlists: (await Wishlist.updateMany({}, { $pull: { products: inIds } })).modifiedCount,
    homeSections: (await HomeSection.updateMany({}, { $pull: { products: inIds } })).modifiedCount,
    shops: (await Shop.updateMany({}, { $pull: { products: inIds } })).modifiedCount,
    promoStrips: (await PromoStrip.updateMany({}, { $pull: { featuredProducts: inIds } })).modifiedCount,
  };
  console.log("Done:", JSON.stringify(r));
  console.log(`Products remaining: ${await Product.countDocuments()}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Failed:", error.message);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
