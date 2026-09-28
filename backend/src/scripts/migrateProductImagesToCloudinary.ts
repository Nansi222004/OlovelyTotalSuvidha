import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Product from "../models/Product";

dotenv.config({ path: path.join(__dirname, "../../.env") });

interface ProductMigrationRow {
  productId: string;
  productName: string;
  field: "mainImage" | "galleryImages";
  oldValue: string;
  newValue: string;
  status: string;
}

async function run() {
  const isDryRun = process.argv.includes("--dry-run");
  const isExecute = process.argv.includes("--execute");
  const confirmDb = process.argv.find((arg) => arg.startsWith("--confirm-target-db="))?.split("=")[1];

  console.log("==================================================================");
  console.log(`    CLOUDINARY PRODUCT IMAGE MIGRATION`);
  console.log(`    Mode: ${isDryRun ? "DRY-RUN (Safe Read-Only)" : isExecute ? "EXECUTE (Write Mode)" : "UNKNOWN (Requires --dry-run or --execute)"}`);
  console.log("==================================================================\n");

  if (!isDryRun && !isExecute) {
    console.error("CRITICAL ABORT: You must specify either --dry-run or --execute");
    process.exit(1);
  }

  if (isExecute && confirmDb !== "test") {
    console.error("CRITICAL ABORT: Execution requires explicit confirmation flag: --confirm-target-db=test");
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set in environment variables");
  }

  // 1. Target Database Safety Checks
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(mongoUri);

  const dbName = mongoose.connection.name;
  const dbHost = mongoose.connection.host;
  console.log(`✓ Connected to host: ${dbHost}`);
  console.log(`✓ Active Database:  ${dbName}`);

  if (dbName !== "test") {
    await mongoose.disconnect();
    throw new Error(`CRITICAL ABORT: Connected to database "${dbName}". Target MUST be strictly "test".`);
  }

  if (!dbHost.includes("olovelytotalsuvidha") && !dbHost.includes("s0wpprt.mongodb.net")) {
    await mongoose.disconnect();
    throw new Error(`CRITICAL ABORT: Host "${dbHost}" does not match Olovely Atlas cluster.`);
  }

  // 2. Cloudinary Credentials & Ping Check
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    await mongoose.disconnect();
    throw new Error("CRITICAL ABORT: Cloudinary credentials missing in .env");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  console.log(`✓ Cloudinary configured for cloud_name: ${cloudName}`);
  const ping = await cloudinary.api.ping();
  if (ping.status !== "ok") {
    await mongoose.disconnect();
    throw new Error(`Cloudinary ping failed: ${JSON.stringify(ping)}`);
  }
  console.log(`✓ Cloudinary ping success (rate limit remaining: ${ping.rate_limit_remaining})\n`);

  // 3. Product Catalog Audit
  const totalProductsCount = await Product.countDocuments({});
  console.log(`Total Products in database: ${totalProductsCount}`);

  const TARGET_PREFIX = "http://localhost:5000/uploads/olovely/categories/";
  const targetProducts = await Product.find({
    $or: [
      { mainImage: { $regex: TARGET_PREFIX } },
      { galleryImages: { $regex: TARGET_PREFIX } },
    ],
  }).sort({ createdAt: -1 });

  console.log(`Target products with localhost category images: ${targetProducts.length}`);
  if (targetProducts.length !== 26) {
    console.warn(`⚠️ Warning: Expected exactly 26 products, found ${targetProducts.length}`);
  }

  const uploadsBaseDir = path.join(__dirname, "../../uploads");
  const reportRows: ProductMigrationRow[] = [];
  const cloudinaryUrlCache = new Map<string, string>();

  let mainImageMigratedCount = 0;
  let galleryImageMigratedCount = 0;
  let productsMigratedCount = 0;
  let errorCount = 0;

  // Helper to resolve & verify Cloudinary URL for a given localhost category URL
  async function resolveCloudinaryCategoryAsset(rawUrl: string): Promise<string> {
    if (cloudinaryUrlCache.has(rawUrl)) {
      return cloudinaryUrlCache.get(rawUrl)!;
    }

    // Extract filename (e.g. 1790340591578_6309.png -> 1790340591578_6309)
    const filenameWithExt = rawUrl.substring(rawUrl.indexOf(TARGET_PREFIX) + TARGET_PREFIX.length);
    const parsed = path.parse(filenameWithExt);
    const publicIdName = parsed.name; // e.g. 1790340591578_6309
    const expectedPublicId = `olovely/categories/${publicIdName}`;

    let secureUrl = "";

    // 1. First check if it already exists in Cloudinary (from Category migration)
    try {
      const existingResource = await cloudinary.api.resource(expectedPublicId);
      if (existingResource && existingResource.secure_url) {
        secureUrl = existingResource.secure_url;
      }
    } catch (err: any) {
      // 404 if not found
    }

    // 2. If not found in Cloudinary, check local disk and upload idempotently
    if (!secureUrl) {
      const localFilePath = path.join(uploadsBaseDir, "olovely/categories", filenameWithExt);
      if (!fs.existsSync(localFilePath)) {
        throw new Error(`Asset not found in Cloudinary (${expectedPublicId}) and missing on disk (${localFilePath})`);
      }

      if (isDryRun) {
        secureUrl = `https://res.cloudinary.com/${cloudName}/image/upload/[DRY_RUN_UPLOAD]/olovely/categories/${publicIdName}.jpg`;
      } else {
        console.log(`[UPLOAD FROM DISK] Uploading missing asset ${localFilePath} to ${expectedPublicId}...`);
        const uploadRes = await cloudinary.uploader.upload(localFilePath, {
          folder: "olovely/categories",
          public_id: publicIdName,
          resource_type: "image",
          overwrite: true,
          invalidate: true,
        });
        secureUrl = uploadRes.secure_url;
      }
    }

    // 3. Verify HTTP reachability and image content type (skip live fetch if dry-run mock)
    if (!isDryRun) {
      if (!secureUrl || !secureUrl.startsWith("https://res.cloudinary.com/")) {
        throw new Error(`Invalid Cloudinary URL returned: ${secureUrl}`);
      }

      const verifyRes = await fetch(secureUrl, { method: "HEAD" });
      if (!verifyRes.ok || verifyRes.status !== 200) {
        throw new Error(`Cloudinary URL failed HTTP verification check: Status ${verifyRes.status}`);
      }

      const contentType = verifyRes.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) {
        throw new Error(`Cloudinary asset returned non-image content-type: ${contentType}`);
      }
    }

    cloudinaryUrlCache.set(rawUrl, secureUrl);
    return secureUrl;
  }

  // 4. Process Each Target Product
  for (const prod of targetProducts) {
    const prodId = prod._id.toString();
    const prodName = prod.productName;
    let productHasChanges = false;

    let newMainImage = prod.mainImage;
    const newGalleryImages = [...(prod.galleryImages || [])];

    // Process mainImage
    if (prod.mainImage && prod.mainImage.includes(TARGET_PREFIX)) {
      try {
        const resolvedUrl = await resolveCloudinaryCategoryAsset(prod.mainImage);
        reportRows.push({
          productId: prodId,
          productName: prodName,
          field: "mainImage",
          oldValue: prod.mainImage,
          newValue: resolvedUrl,
          status: isDryRun ? "PLANNED (Dry Run)" : "MIGRATED_OK",
        });
        newMainImage = resolvedUrl;
        mainImageMigratedCount++;
        productHasChanges = true;
      } catch (err: any) {
        reportRows.push({
          productId: prodId,
          productName: prodName,
          field: "mainImage",
          oldValue: prod.mainImage,
          newValue: "N/A",
          status: `ERROR: ${err.message}`,
        });
        errorCount++;
      }
    }

    // Process galleryImages
    for (let i = 0; i < newGalleryImages.length; i++) {
      const gUrl = newGalleryImages[i];
      if (gUrl && gUrl.includes(TARGET_PREFIX)) {
        try {
          const resolvedUrl = await resolveCloudinaryCategoryAsset(gUrl);
          reportRows.push({
            productId: prodId,
            productName: prodName,
            field: "galleryImages",
            oldValue: gUrl,
            newValue: resolvedUrl,
            status: isDryRun ? "PLANNED (Dry Run)" : "MIGRATED_OK",
          });
          newGalleryImages[i] = resolvedUrl;
          galleryImageMigratedCount++;
          productHasChanges = true;
        } catch (err: any) {
          reportRows.push({
            productId: prodId,
            productName: prodName,
            field: "galleryImages",
            oldValue: gUrl,
            newValue: "N/A",
            status: `ERROR: ${err.message}`,
          });
          errorCount++;
        }
      }
    }

    if (productHasChanges) {
      productsMigratedCount++;
    }

    // If Execute mode, perform atomic update on the product
    if (isExecute && productHasChanges && errorCount === 0) {
      const updateResult = await Product.updateOne(
        { _id: prod._id },
        {
          $set: {
            mainImage: newMainImage,
            galleryImages: newGalleryImages,
          },
        }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error(`Failed to update Product ${prodId} (${prodName})`);
      }
    }
  }

  // 5. Output Audit & Migration Report Table
  console.log("\n==================================================================");
  console.log("                     MIGRATION REPORT TABLE                       ");
  console.log("==================================================================");
  console.table(
    reportRows.map((r, i) => ({
      "#": i + 1,
      Name: r.productName.length > 30 ? r.productName.substring(0, 27) + "..." : r.productName,
      Field: r.field,
      Status: r.status,
      OldValue: r.oldValue.length > 40 ? "..." + r.oldValue.substring(r.oldValue.length - 37) : r.oldValue,
      NewValue: r.newValue.length > 50 ? r.newValue.substring(0, 47) + "..." : r.newValue,
    }))
  );

  console.log("\n==================================================================");
  console.log("                     MIGRATION SUMMARY                           ");
  console.log("==================================================================");
  console.log(`Total Products in Catalog:       ${totalProductsCount}`);
  console.log(`Target Products Audited:         ${targetProducts.length}`);
  console.log(`Products Migrated / Planned:     ${productsMigratedCount}`);
  console.log(`mainImage Fields Handled:        ${mainImageMigratedCount}`);
  console.log(`galleryImages Elements Handled:  ${galleryImageMigratedCount}`);
  console.log(`Cloudinary Assets Reused:        ${cloudinaryUrlCache.size}`);
  console.log(`Errors / Unresolved:             ${errorCount}`);
  console.log("==================================================================\n");

  // 6. Post-migration verification if in Execute mode
  if (isExecute && errorCount === 0) {
    console.log("Running post-migration verification...");
    const postTotal = await Product.countDocuments({});
    if (postTotal !== totalProductsCount) {
      throw new Error(`POST-MIGRATION INTEGRITY ERROR: Total product count changed from ${totalProductsCount} to ${postTotal}!`);
    }

    const remainingLocalhost = await Product.countDocuments({
      $or: [
        { mainImage: { $regex: TARGET_PREFIX } },
        { galleryImages: { $regex: TARGET_PREFIX } },
      ],
    });

    console.log(`✓ Total products count unchanged: ${postTotal}`);
    console.log(`✓ Remaining localhost category references: ${remainingLocalhost}`);

    if (remainingLocalhost > 0) {
      throw new Error(`POST-MIGRATION ERROR: ${remainingLocalhost} products still have localhost category URLs!`);
    }

    console.log("✓ Post-migration verification PASSED completely!\n");
  }

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");

  if (errorCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Migration Fatal Error:", err);
  process.exit(1);
});
