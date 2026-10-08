import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import HeaderCategory from "../models/HeaderCategory";
import Category from "../models/Category";
import Product from "../models/Product";
import Seller from "../models/Seller";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function audit() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not found");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB for READ-ONLY Audit.\n");

  // 1. Audit Header Categories
  const headers = await HeaderCategory.find().sort({ order: 1 }).lean();
  console.log(`=== HEADER CATEGORIES (Total: ${headers.length}) ===`);

  const categories = await Category.find().lean();
  console.log(`=== ALL CATEGORIES (Total in DB: ${categories.length}) ===\n`);

  // Build mapping of headerCategoryId -> children
  const childrenByHeader = new Map<string, any[]>();
  for (const c of categories) {
    if (c.headerCategoryId) {
      const key = c.headerCategoryId.toString();
      const list = childrenByHeader.get(key) || [];
      list.push(c);
      childrenByHeader.set(key, list);
    }
  }

  console.log("Header Category Channel Derivation:");
  const headerSummary: any[] = [];
  for (const h of headers) {
    const children = childrenByHeader.get(h._id.toString()) || [];
    const activeChildren = children.filter((c) => c.status === "Active");
    const channels = new Set<string>();
    for (const c of activeChildren) {
      for (const ch of c.commerceChannels || []) {
        channels.add(ch);
      }
    }
    const channelList = Array.from(channels).sort();
    headerSummary.push({
      id: h._id.toString(),
      name: h.name,
      status: h.status,
      order: h.order,
      slug: h.slug,
      activeChildrenCount: activeChildren.length,
      totalChildrenCount: children.length,
      derivedChannels: channelList,
    });
    console.log(
      `  [${h.order}] ${h.name.padEnd(25)} | Status: ${h.status.padEnd(11)} | Active Children: ${String(activeChildren.length).padStart(2)} | Derived: [${channelList.join(", ")}]`
    );
  }

  // 2. Audit Top-Level Categories vs Subcategories
  const topLevel = categories.filter((c) => !c.parentId);
  const subCategories = categories.filter((c) => c.parentId);

  console.log(`\n=== CATEGORIES BREAKDOWN ===`);
  console.log(`Top-Level Categories (parentId is null): ${topLevel.length}`);
  console.log(`Subcategories (has parentId): ${subCategories.length}`);
  console.log(`Total Categories: ${categories.length}`);

  // Channel breakdown
  let qcOnlyCount = 0;
  let ecomOnlyCount = 0;
  let bothCount = 0;
  let invalidOrEmptyCount = 0;

  const invalidCategories: any[] = [];

  const auditRows: any[] = [];

  for (const c of categories) {
    const channels = c.commerceChannels || [];
    const hasQc = channels.includes("QUICK_COMMERCE");
    const hasEcom = channels.includes("ECOMMERCE");
    const hasInvalid = channels.some((ch: string) => ch !== "QUICK_COMMERCE" && ch !== "ECOMMERCE");

    let usage = "UNKNOWN";
    if (hasInvalid || channels.length === 0) {
      invalidOrEmptyCount++;
      usage = "INVALID/EMPTY";
      invalidCategories.push({ name: c.name, channels, status: c.status });
    } else if (hasQc && hasEcom) {
      bothCount++;
      usage = "QC + ECOMMERCE";
    } else if (hasQc) {
      qcOnlyCount++;
      usage = "QUICK_COMMERCE ONLY";
    } else if (hasEcom) {
      ecomOnlyCount++;
      usage = "ECOMMERCE ONLY";
    }

    const header = headers.find((h) => h._id.toString() === c.headerCategoryId?.toString());

    auditRows.push({
      name: c.name,
      status: c.status,
      isSub: Boolean(c.parentId),
      headerName: header ? header.name : "NONE",
      hasQc,
      hasEcom,
      channels: channels.join(", "),
      usage,
    });
  }

  console.log(`\n=== CHANNEL COUNTS (All Categories) ===`);
  console.log(`QC-only:         ${qcOnlyCount}`);
  console.log(`Ecommerce-only:  ${ecomOnlyCount}`);
  console.log(`Both:            ${bothCount}`);
  console.log(`Invalid / Empty: ${invalidOrEmptyCount}`);
  console.log(`Total:           ${categories.length}`);

  // Check top-level only channel counts
  let topQcOnly = 0;
  let topEcomOnly = 0;
  let topBoth = 0;
  for (const c of topLevel) {
    const channels = c.commerceChannels || [];
    const hasQc = channels.includes("QUICK_COMMERCE");
    const hasEcom = channels.includes("ECOMMERCE");
    if (hasQc && hasEcom) topBoth++;
    else if (hasQc) topQcOnly++;
    else if (hasEcom) topEcomOnly++;
  }
  console.log(`\n=== CHANNEL COUNTS (Top-Level Only) ===`);
  console.log(`Top QC-only:        ${topQcOnly}`);
  console.log(`Top Ecommerce-only: ${topEcomOnly}`);
  console.log(`Top Both:           ${topBoth}`);
  console.log(`Top Total:          ${topLevel.length}`);

  if (invalidCategories.length > 0) {
    console.log(`\n⚠️ INVALID/EMPTY CATEGORIES FOUND:`, invalidCategories);
  } else {
    console.log(`\n✅ ZERO invalid or empty category commerceChannels found.`);
  }

  // Print full audit table (sorted by headerName, name)
  console.log(`\n=== COMPLETE CATEGORY AUDIT TABLE ===`);
  console.log(
    `${"Category Name".padEnd(35)} | ${"Status".padEnd(8)} | ${"QC".padEnd(4)} | ${"Ecom".padEnd(4)} | ${"Type".padEnd(8)} | ${"Header Category".padEnd(25)} | ${"Usage"}`
  );
  console.log("-".repeat(120));
  auditRows
    .sort((a, b) => a.headerName.localeCompare(b.headerName) || a.name.localeCompare(b.name))
    .forEach((row) => {
      console.log(
        `${row.name.padEnd(35)} | ${row.status.padEnd(8)} | ${(row.hasQc ? "YES" : "NO").padEnd(4)} | ${(row.hasEcom ? "YES" : "NO").padEnd(4)} | ${(row.isSub ? "SUB" : "TOP").padEnd(8)} | ${row.headerName.padEnd(25)} | ${row.usage}`
      );
    });

  // 3. Product Audit (Read-Only)
  console.log(`\n=== PRODUCT AUDIT (Read-Only) ===`);
  const totalProducts = await Product.countDocuments();
  const platformProducts = await Product.countDocuments({ ownerType: "PLATFORM" });
  const vendorProducts = await Product.countDocuments({ ownerType: { $ne: "PLATFORM" } });
  const qcProducts = await Product.countDocuments({ productType: "QUICK_COMMERCE" });
  const ecomProducts = await Product.countDocuments({ productType: "ECOMMERCE" });
  const missingTypeProducts = await Product.countDocuments({ productType: { $nin: ["QUICK_COMMERCE", "ECOMMERCE"] } });
  const wholesaleProducts = await Product.countDocuments({ wholesaleEnabled: true });

  console.log(`Total Products:           ${totalProducts}`);
  console.log(`Platform Products:        ${platformProducts}`);
  console.log(`Vendor Products:          ${vendorProducts}`);
  console.log(`Quick Commerce Products:  ${qcProducts}`);
  console.log(`Ecommerce Products:       ${ecomProducts}`);
  console.log(`Missing/Invalid Type:     ${missingTypeProducts}`);
  console.log(`Wholesale Enabled:        ${wholesaleProducts}`);

  // Inspect products for Category Channel Compatibility
  const catMap = new Map<string, any>(categories.map((c) => [c._id.toString(), c]));
  const products = await Product.find({})
    .select("productName ownerType productType category wholesaleEnabled seller")
    .lean();

  let incompatibleProductCount = 0;
  const incompatibleSamples: any[] = [];

  for (const p of products) {
    const cat = p.category ? catMap.get(p.category.toString()) : null;
    if (!cat) {
      incompatibleProductCount++;
      if (incompatibleSamples.length < 10) {
        incompatibleSamples.push({
          id: p._id,
          name: p.productName,
          reason: "Category not found in Category collection",
          catId: p.category,
        });
      }
      continue;
    }

    const catChannels: string[] = cat.commerceChannels || [];
    if (p.productType === "QUICK_COMMERCE" && !catChannels.includes("QUICK_COMMERCE")) {
      incompatibleProductCount++;
      if (incompatibleSamples.length < 10) {
        incompatibleSamples.push({
          id: p._id,
          name: p.productName,
          productType: p.productType,
          categoryName: cat.name,
          catChannels,
          reason: "QC product has Ecommerce-only category",
        });
      }
    } else if (p.productType === "ECOMMERCE" && !catChannels.includes("ECOMMERCE")) {
      incompatibleProductCount++;
      if (incompatibleSamples.length < 10) {
        incompatibleSamples.push({
          id: p._id,
          name: p.productName,
          productType: p.productType,
          categoryName: cat.name,
          catChannels,
          reason: "Ecommerce product has QC-only category",
        });
      }
    }
  }

  console.log(`\nProduct Category Compatibility Check:`);
  console.log(`Incompatible/Orphan Products: ${incompatibleProductCount}`);
  if (incompatibleSamples.length > 0) {
    console.log("Incompatible Samples:", JSON.stringify(incompatibleSamples, null, 2));
  } else {
    console.log("✅ All sampled products are fully compatible with their category commerceChannels!");
  }

  // 4. Inspect Platform Products Specifically
  const platformSample = await Product.find({ ownerType: "PLATFORM" })
    .select("productName productType category wholesaleEnabled seller")
    .populate("category", "name commerceChannels")
    .limit(10)
    .lean();
  console.log(`\nPlatform-Owned Product Samples (${platformSample.length} shown):`);
  for (const p of platformSample) {
    const cat: any = p.category;
    console.log(
      `  - [${p.productType}] "${p.productName}" | Cat: ${cat?.name || "NONE"} (${cat?.commerceChannels?.join(", ")}) | Wholesale: ${p.wholesaleEnabled}`
    );
  }

  await mongoose.disconnect();
  console.log("\nRead-only audit completed successfully.");
}

audit().catch((err) => {
  console.error(err);
  process.exit(1);
});
