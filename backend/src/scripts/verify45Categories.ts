import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Category from "../models/Category";
import { CATEGORIES_45_LIST } from "./seed45Categories";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";

async function verify() {
  console.log("==================================================================");
  console.log("          VERIFICATION AUDIT: 45 HANDWRITTEN CATEGORIES          ");
  console.log("==================================================================");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for Verification\n");

    const targetNames = CATEGORIES_45_LIST.map((c) => c.name);
    
    // 1. Fetch categories from DB matching target names
    const dbCats = await Category.find({
      name: { $in: targetNames },
    }).sort({ order: 1 });

    console.log(`[CHECK 1] Categories Count Check:`);
    console.log(`  - Target expected: 45`);
    console.log(`  - Found in DB:     ${dbCats.length}`);

    // 2. Active status check
    const activeCats = dbCats.filter((c) => c.status === "Active");
    console.log(`\n[CHECK 2] Active Status Check:`);
    console.log(`  - Expected Active: 45`);
    console.log(`  - Actual Active:   ${activeCats.length}`);

    // 3. Missing categories check
    const missing = CATEGORIES_45_LIST.filter(
      (t) => !dbCats.some((db) => db.name.toLowerCase() === t.name.toLowerCase())
    );
    console.log(`\n[CHECK 3] Missing Categories Check:`);
    console.log(`  - Missing count:   ${missing.length}`);
    if (missing.length > 0) {
      missing.forEach((m) => console.log(`    * Missing: [${m.order}] ${m.name}`));
    }

    // 4. Duplicate categories check
    const nameCounts = new Map<string, number>();
    for (const c of dbCats) {
      const lower = c.name.toLowerCase();
      nameCounts.set(lower, (nameCounts.get(lower) || 0) + 1);
    }
    const duplicateEntries = Array.from(nameCounts.entries()).filter(([_, count]) => count > 1);
    console.log(`\n[CHECK 4] Duplicate Categories Check:`);
    console.log(`  - Duplicate count: ${duplicateEntries.length}`);

    // 5. Order 1-45 check
    console.log(`\n[CHECK 5] Sequential Order (1–45) Check:`);
    let orderMismatchCount = 0;
    CATEGORIES_45_LIST.forEach((expectedItem) => {
      const matched = dbCats.find((c) => c.name.toLowerCase() === expectedItem.name.toLowerCase());
      if (!matched) {
        orderMismatchCount++;
        console.log(`  - [ORDER MISMATCH] "${expectedItem.name}" NOT FOUND`);
      } else if (matched.order !== expectedItem.order) {
        orderMismatchCount++;
        console.log(`  - [ORDER MISMATCH] "${expectedItem.name}" expected order ${expectedItem.order} but got ${matched.order}`);
      }
    });
    if (orderMismatchCount === 0) {
      console.log(`  - All 45 categories have EXACT correct order positions 1 through 45.`);
    }

    // 6. Slug uniqueness check
    console.log(`\n[CHECK 6] Slug Uniqueness Check:`);
    const slugCounts = new Map<string, number>();
    for (const c of dbCats) {
      slugCounts.set(c.slug, (slugCounts.get(c.slug) || 0) + 1);
    }
    const duplicateSlugs = Array.from(slugCounts.entries()).filter(([_, count]) => count > 1);
    console.log(`  - Duplicate slugs: ${duplicateSlugs.length}`);

    // 7. API Consumption Simulation Checks
    console.log(`\n[CHECK 7] Consumer API Simulation Checks:`);
    
    // A. Admin Category List Query (Category.find({}).sort({ order: 1 }))
    const adminQueryCats = await Category.find({}).sort({ order: 1 });
    const adminHasAll45 = CATEGORIES_45_LIST.every((item) =>
      adminQueryCats.some((c) => c.name.toLowerCase() === item.name.toLowerCase())
    );
    console.log(`  - Admin Category List Query (/api/admin/categories): ${adminHasAll45 ? "PASSED (all 45 present)" : "FAILED"}`);

    // B. Seller Category Selection Query (Category.find({ parentId: null, status: "Active" }))
    const sellerQueryCats = await Category.find({ parentId: null, status: "Active" });
    const sellerHasAll45 = CATEGORIES_45_LIST.every((item) =>
      sellerQueryCats.some((c) => c.name.toLowerCase() === item.name.toLowerCase())
    );
    console.log(`  - Seller Category Selection Query (/api/categories): ${sellerHasAll45 ? "PASSED (all 45 root active)" : "FAILED"}`);

    // C. Customer Category Listing Query (Category.find({ status: "Active" }).sort({ order: 1 }))
    const customerQueryCats = await Category.find({ status: "Active" }).sort({ order: 1 });
    const customerHasAll45 = CATEGORIES_45_LIST.every((item) =>
      customerQueryCats.some((c) => c.name.toLowerCase() === item.name.toLowerCase())
    );
    console.log(`  - Customer Category Listing Query (/api/customer/categories): ${customerHasAll45 ? "PASSED (all 45 active)" : "FAILED"}`);

    // 8. HeaderCategory & Navigation Audit
    console.log(`\n[CHECK 8] HeaderCategory & Customer Header Navigation Audit:`);
    const HeaderCategory = (await import("../models/HeaderCategory")).default;
    const publishedHeaders = await HeaderCategory.find({ status: "Published" }).sort({ order: 1 });
    console.log(`  - Published HeaderCategories count: ${publishedHeaders.length} (Expected: 10)`);
    publishedHeaders.forEach((h, idx) => {
      console.log(`    [${idx + 1}] "${h.name}" (slug: '${h.slug}', icon: '${h.iconName}', order: ${h.order})`);
    });

    const deprecatedHeaders = await HeaderCategory.find({
      slug: { $in: ["wedding", "winter", "teal", "all"] },
      status: "Published"
    });
    console.log(`  - Deprecated/Placeholder Published Headers: ${deprecatedHeaders.length} (Expected: 0)`);

    const categoriesWithHeader = await Category.find({
      name: { $in: targetNames },
      headerCategoryId: { $exists: true, $ne: null }
    });
    console.log(`  - 45 Categories mapped to HeaderCategory: ${categoriesWithHeader.length} / 45`);

    // Print Full List Table
    console.log("\n==================================================================");
    console.log("                  FINAL 45 CATEGORIES IN DATABASE                 ");
    console.log("==================================================================");
    console.log("Order | Name                             | Slug                           | HeaderCategory");
    console.log("------+----------------------------------+--------------------------------+----------------");
    const fullCatsWithHeader = await Category.find({ name: { $in: targetNames } })
      .populate("headerCategoryId", "name")
      .sort({ order: 1 });

    fullCatsWithHeader.forEach((c: any) => {
      const orderStr = c.order.toString().padStart(5, " ");
      const nameStr = c.name.padEnd(32, " ");
      const slugStr = c.slug.padEnd(30, " ");
      const headerName = c.headerCategoryId?.name || "None";
      console.log(`${orderStr} | ${nameStr} | ${slugStr} | ${headerName}`);
    });
    console.log("==================================================================\n");

    const allPassed =
      dbCats.length === 45 &&
      activeCats.length === 45 &&
      missing.length === 0 &&
      duplicateEntries.length === 0 &&
      orderMismatchCount === 0 &&
      duplicateSlugs.length === 0 &&
      adminHasAll45 &&
      sellerHasAll45 &&
      customerHasAll45 &&
      publishedHeaders.length === 10 &&
      deprecatedHeaders.length === 0 &&
      categoriesWithHeader.length === 45;

    if (allPassed) {
      console.log(">>> ALL VERIFICATION CHECKS PASSED PERFECTLY (100%) <<<\n");
    } else {
      console.error(">>> SOME VERIFICATION CHECKS FAILED! <<<\n");
      process.exitCode = 1;
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("Verification failed with error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verify();
