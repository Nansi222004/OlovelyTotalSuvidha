/**
 * Moves subcategories from the legacy `SubCategory` collection into the `Category` tree
 * (a Category document with parentId = the parent category).
 *
 * Why: the admin Categories tree and the customer category page only read child Categories,
 * so subcategories created on the old /admin/subcategory page were invisible there.
 *
 * Safe by design:
 *  - The new Category keeps the SAME _id as the legacy SubCategory. Product.subcategory already
 *    stores that id (and references "Category"), so products need NO changes and stay linked.
 *  - Inherits header category, commerce channels and wholesale flag from the parent.
 *  - The legacy document is deleted only when nothing else (Shop, HomeSection, AppSettings)
 *    still points at it through the old SubCategory model; otherwise it is kept and reported.
 *  - Name clashes (Category.name is unique) are reported and skipped, never renamed silently.
 *  - DRY RUN by default. Nothing is written unless you pass --apply.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/migrateLegacySubCategories.ts           # report only
 *   npx tsx src/scripts/migrateLegacySubCategories.ts --apply   # perform the migration
 *
 * Take a database backup before running with --apply on production.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "../models/Category";
import SubCategory from "../models/SubCategory";
import Product from "../models/Product";
import Shop from "../models/Shop";
import HomeSection from "../models/HomeSection";
import AppSettings from "../models/AppSettings";

dotenv.config();

const APPLY = process.argv.includes("--apply");

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function countLegacyReferences(id: mongoose.Types.ObjectId) {
  const [shops, sections, settings] = await Promise.all([
    Shop.countDocuments({ $or: [{ subCategory: id }, { subCategory: { $in: [id] } }] }),
    HomeSection.countDocuments({ subCategories: id }),
    AppSettings.countDocuments({ "homeSections.subcategory": id }).catch(() => 0),
  ]);
  return shops + sections + settings;
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY RUN (no changes)"}\n`);

  const legacy = await SubCategory.find().lean();
  console.log(`Legacy subcategories found: ${legacy.length}\n`);

  const summary = { migrated: 0, alreadyMigrated: 0, legacyDeleted: 0, legacyKept: 0, skipped: 0 };

  for (const sub of legacy) {
    const label = `"${sub.name}" (${sub._id})`;
    const parent = await Category.findById(sub.category).lean();
    if (!parent) {
      console.log(`SKIP  ${label}: parent category ${sub.category} not found`);
      summary.skipped++;
      continue;
    }

    const productCount = await Product.countDocuments({ subcategory: sub._id });
    const existingSameId = await Category.findById(sub._id).lean();

    if (!existingSameId) {
      const nameClash = await Category.findOne({
        name: { $regex: `^${escapeRegex(sub.name.trim())}$`, $options: "i" },
      }).lean();
      const slugClash = await Category.findOne({ slug: toSlug(sub.name) }).lean();
      const clash = nameClash || slugClash;
      if (clash) {
        console.log(
          `SKIP  ${label} under "${parent.name}": a category named "${clash.name}" already exists ` +
            `(${clash._id}). Rename one of them, then re-run.`
        );
        summary.skipped++;
        continue;
      }

      console.log(
        `MOVE  ${label} → child of "${parent.name}" (keeps same id, ${productCount} product(s) stay linked)`
      );
      if (APPLY) {
        await Category.create({
          _id: sub._id,
          name: sub.name.trim(),
          image: sub.image,
          order: sub.order || 0,
          commissionRate: sub.commissionRate || 0,
          translations: sub.translations || {},
          parentId: parent._id,
          headerCategoryId: parent.headerCategoryId || null,
          commerceChannels:
            parent.commerceChannels && parent.commerceChannels.length > 0
              ? parent.commerceChannels
              : ["QUICK_COMMERCE", "ECOMMERCE"],
          wholesaleEnabled: parent.wholesaleEnabled ?? false,
          status: "Active",
          isBestseller: false,
          hasWarning: false,
        });
      }
      summary.migrated++;
    } else {
      console.log(`OK    ${label}: already exists in the category tree`);
      summary.alreadyMigrated++;
    }

    // Remove the legacy copy so it isn't listed twice, unless old-model references remain.
    const refs = await countLegacyReferences(sub._id as mongoose.Types.ObjectId);
    if (refs > 0) {
      console.log(`      keeping legacy record: still referenced ${refs} time(s) by Shop/HomeSection/AppSettings`);
      summary.legacyKept++;
    } else {
      if (APPLY) await SubCategory.deleteOne({ _id: sub._id });
      summary.legacyDeleted++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Moved to category tree:   ${summary.migrated}`);
  console.log(`Already in category tree: ${summary.alreadyMigrated}`);
  console.log(`Legacy records removed:   ${summary.legacyDeleted}`);
  console.log(`Legacy records kept:      ${summary.legacyKept}`);
  console.log(`Skipped (needs a fix):    ${summary.skipped}`);
  if (!APPLY) console.log("\nDry run only. Re-run with --apply to make these changes.");

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
