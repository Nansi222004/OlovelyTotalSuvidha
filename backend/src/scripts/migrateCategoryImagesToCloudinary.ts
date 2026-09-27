import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";

dotenv.config({ path: path.join(__dirname, "../../.env") });

interface MigrationRow {
  categoryId: string;
  categoryName: string;
  oldImage: string;
  newCloudinaryUrl: string;
  status: string;
}

async function run() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("==================================================================");
  console.log(`    CLOUDINARY CATEGORY IMAGE MIGRATION ${isDryRun ? "(DRY-RUN MODE)" : "(EXECUTE MODE)"}`);
  console.log("==================================================================\n");

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set in environment variables");
  }

  // 1. Target Database Safety Checks
  console.log("Connecting to MongoDB...");
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

  // 3. Category Count Check
  const allCategories = await Category.find({}).sort({ order: 1 });
  console.log(`Total categories in database: ${allCategories.length}`);
  if (allCategories.length !== 45) {
    console.warn(`⚠️ Warning: Expected exactly 45 categories, found ${allCategories.length}`);
  }

  const uploadsBaseDir = path.join(__dirname, "../../uploads");
  const reportRows: MigrationRow[] = [];
  let migratedCount = 0;
  let preservedCount = 0;
  let alreadyCloudinaryCount = 0;
  let errorCount = 0;

  for (const cat of allCategories) {
    const catId = cat._id.toString();
    const catName = cat.name;
    const currentImage = (cat.image || "").trim();

    // Check Case A: Already a Cloudinary URL
    if (currentImage.startsWith("https://res.cloudinary.com/")) {
      reportRows.push({
        categoryId: catId,
        categoryName: catName,
        oldImage: currentImage,
        newCloudinaryUrl: currentImage,
        status: "ALREADY_CLOUDINARY (skipped)",
      });
      alreadyCloudinaryCount++;
      continue;
    }

    // Check Case B: Preserved relative asset (e.g. Rani Masala)
    if (currentImage === "/assets/category-masala.png" || currentImage.startsWith("/assets/")) {
      reportRows.push({
        categoryId: catId,
        categoryName: catName,
        oldImage: currentImage,
        newCloudinaryUrl: currentImage,
        status: "PRESERVED_ASSET (unchanged)",
      });
      preservedCount++;
      continue;
    }

    // Check Case C: Localhost or local upload URL
    if (
      currentImage.startsWith("http://localhost:5000/uploads/") ||
      currentImage.startsWith("/uploads/") ||
      currentImage.includes("/uploads/olovely/categories/")
    ) {
      // Extract relative path inside uploads
      let relPath = "";
      if (currentImage.includes("/uploads/")) {
        relPath = currentImage.substring(currentImage.indexOf("/uploads/") + "/uploads/".length);
      } else {
        relPath = currentImage;
      }

      const localFilePath = path.join(uploadsBaseDir, relPath);
      const fileExists = fs.existsSync(localFilePath);

      if (!fileExists) {
        reportRows.push({
          categoryId: catId,
          categoryName: catName,
          oldImage: currentImage,
          newCloudinaryUrl: "N/A",
          status: `ERROR: Local file missing (${localFilePath})`,
        });
        errorCount++;
        continue;
      }

      const parsed = path.parse(localFilePath);
      const publicIdName = parsed.name; // e.g. 1790339948037_7648
      const expectedPublicId = `olovely/categories/${publicIdName}`;

      if (isDryRun) {
        reportRows.push({
          categoryId: catId,
          categoryName: catName,
          oldImage: currentImage,
          newCloudinaryUrl: `[PLANNED] Cloudinary folder olovely/categories with public_id ${publicIdName}`,
          status: "DRY_RUN_PLANNED (file verified on disk)",
        });
        migratedCount++;
        continue;
      }

      // Execute mode
      try {
        let secureUrl = "";

        // Check if resource already exists in Cloudinary (idempotency check)
        try {
          const existingResource = await cloudinary.api.resource(expectedPublicId);
          if (existingResource && existingResource.secure_url) {
            secureUrl = existingResource.secure_url;
            console.log(`[IDEMPOTENT REUSE] Asset already exists in Cloudinary: ${expectedPublicId}`);
          }
        } catch (err: any) {
          // 404 is expected if not uploaded yet
        }

        // Upload if not found
        if (!secureUrl) {
          console.log(`Uploading ${localFilePath} to ${expectedPublicId}...`);
          const uploadRes = await cloudinary.uploader.upload(localFilePath, {
            folder: "olovely/categories",
            public_id: publicIdName,
            resource_type: "image",
            overwrite: true,
            invalidate: true,
          });
          secureUrl = uploadRes.secure_url;
        }

        // Verify HTTPS URL
        if (!secureUrl || !secureUrl.startsWith("https://res.cloudinary.com/")) {
          throw new Error(`Invalid Cloudinary URL returned: ${secureUrl}`);
        }

        // Verify HTTP status responds with 200
        const verifyRes = await fetch(secureUrl, { method: "HEAD" });
        if (!verifyRes.ok && verifyRes.status !== 200) {
          throw new Error(`Cloudinary URL failed HTTP verification check: Status ${verifyRes.status}`);
        }

        // Atomic DB Update: ONLY image field
        const updateResult = await Category.updateOne(
          { _id: cat._id },
          { $set: { image: secureUrl } }
        );

        if (updateResult.modifiedCount === 0 && cat.image !== secureUrl) {
          throw new Error(`Failed to update Category.image in database`);
        }

        reportRows.push({
          categoryId: catId,
          categoryName: catName,
          oldImage: currentImage,
          newCloudinaryUrl: secureUrl,
          status: "MIGRATED_OK",
        });
        migratedCount++;
      } catch (uploadError: any) {
        console.error(`Error migrating category "${catName}":`, uploadError.message);
        reportRows.push({
          categoryId: catId,
          categoryName: catName,
          oldImage: currentImage,
          newCloudinaryUrl: "N/A",
          status: `FAILED: ${uploadError.message}`,
        });
        errorCount++;
      }
      continue;
    }

    // Other unexpected image format
    reportRows.push({
      categoryId: catId,
      categoryName: catName,
      oldImage: currentImage,
      newCloudinaryUrl: currentImage,
      status: "SKIPPED (unrecognized URL format)",
    });
  }

  // 4. Print Migration Report Table
  console.log("\n==================================================================");
  console.log("                     MIGRATION REPORT TABLE                       ");
  console.log("==================================================================");
  console.table(
    reportRows.map((r, i) => ({
      "#": i + 1,
      Name: r.categoryName,
      Status: r.status,
      OldImage: r.oldImage.length > 50 ? r.oldImage.substring(0, 47) + "..." : r.oldImage,
      CloudinaryUrl: r.newCloudinaryUrl.length > 50 ? r.newCloudinaryUrl.substring(0, 47) + "..." : r.newCloudinaryUrl,
    }))
  );

  console.log("\n==================================================================");
  console.log("                     MIGRATION SUMMARY                           ");
  console.log("==================================================================");
  console.log(`Total Categories Audited:  ${allCategories.length}`);
  console.log(`Migrated / Planned:        ${migratedCount}`);
  console.log(`Preserved Assets:          ${preservedCount}`);
  console.log(`Already Cloudinary:        ${alreadyCloudinaryCount}`);
  console.log(`Errors / Missing:          ${errorCount}`);
  console.log("==================================================================\n");

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
