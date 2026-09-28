import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Product from "../models/Product";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function verify() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(mongoUri!);

  const allProducts = await Product.find({}).lean();
  console.log(`\n=== POST-MIGRATION IN-DEPTH INTEGRITY AUDIT ===`);
  console.log(`1. Total Products in DB: ${allProducts.length}`);

  let cloudinaryCount = 0;
  let localhostCategoryCount = 0;
  let localhostAnyCount = 0;
  let assetCount = 0;
  let otherHttpCount = 0;

  const cloudinaryUrls = new Set<string>();

  for (const p of allProducts as any[]) {
    const main = p.mainImage || "";
    if (main.startsWith("https://res.cloudinary.com/")) {
      cloudinaryCount++;
      cloudinaryUrls.add(main);
    } else if (main.includes("localhost:5000/uploads/olovely/categories/")) {
      localhostCategoryCount++;
    } else if (main.includes("localhost") || main.includes("127.0.0.1")) {
      localhostAnyCount++;
    } else if (main.startsWith("/assets/")) {
      assetCount++;
    } else if (main.startsWith("http://") || main.startsWith("https://")) {
      otherHttpCount++;
    }

    if (Array.isArray(p.galleryImages)) {
      for (const g of p.galleryImages) {
        if (typeof g === "string" && g.startsWith("https://res.cloudinary.com/")) {
          cloudinaryUrls.add(g);
        }
      }
    }
  }

  console.log(`2. Products using Cloudinary HTTPS:             ${cloudinaryCount} (Expected: 26)`);
  console.log(`3. Products with localhost category URLs:       ${localhostCategoryCount} (Expected: 0)`);
  console.log(`4. Products with ANY localhost URLs:            ${localhostAnyCount} (Expected: 0)`);
  console.log(`5. Products with frontend /assets/ URLs:        ${assetCount} (Expected: 55)`);
  console.log(`6. Products with other external HTTP/HTTPS:     ${otherHttpCount} (Expected: 1)`);

  console.log(`\n=== 7. VERIFYING REACHABILITY OF ALL ${cloudinaryUrls.size} MIGRATED CLOUDINARY URLS ===`);
  let reachableCount = 0;
  let failedCount = 0;

  for (const url of cloudinaryUrls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && res.status === 200 && contentType.startsWith("image/")) {
        reachableCount++;
      } else {
        console.error(`  FAIL: ${url} -> Status ${res.status}, Type: ${contentType}`);
        failedCount++;
      }
    } catch (e: any) {
      console.error(`  ERROR: ${url} -> ${e.message}`);
      failedCount++;
    }
  }

  console.log(`Reachable with HTTP 200 and image/*: ${reachableCount} / ${cloudinaryUrls.size}`);
  console.log(`Failed checks: ${failedCount}`);

  await mongoose.disconnect();

  if (failedCount > 0 || localhostAnyCount > 0 || cloudinaryCount !== 26) {
    console.error("Verification FAILED!");
    process.exit(1);
  } else {
    console.log("\nALL POST-MIGRATION DATABASE CHECKS PASSED PERFECTLY!\n");
  }
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
