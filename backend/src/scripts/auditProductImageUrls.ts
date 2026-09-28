import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function audit() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("No MONGODB_URI in backend/.env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB Atlas in READ-ONLY mode...");
  await mongoose.connect(mongoUri);
  console.log("Connected successfully to DB:", mongoose.connection.name);
  console.log("Host:", mongoose.connection.host);

  const Product = mongoose.model(
    "ProductAudit",
    new mongoose.Schema({}, { strict: false }),
    "products"
  );

  const allProducts = await Product.find({}).lean();
  console.log(`\n=== 1. TOTAL PRODUCTS COUNT ===`);
  console.log(`Total Products in DB: ${allProducts.length}`);

  let withMainImage = 0;
  let withGalleryImages = 0;
  let withAnyImage = 0;
  let noImage = 0;

  const categories = {
    A_cloudinary: [] as any[],
    B_localhost: [] as any[],
    C_localUploads: [] as any[],
    D_assets: [] as any[],
    E_otherHttp: [] as any[],
    F_emptyOrMissing: [] as any[],
  };

  const galleryCategories = {
    A_cloudinary: [] as any[],
    B_localhost: [] as any[],
    C_localUploads: [] as any[],
    D_assets: [] as any[],
    E_otherHttp: [] as any[],
    F_emptyOrMissing: [] as any[],
  };

  function classify(url: string | null | undefined) {
    if (!url || typeof url !== "string" || url.trim() === "") return "F_emptyOrMissing";
    const u = url.trim();
    if (u.startsWith("https://res.cloudinary.com/")) return "A_cloudinary";
    if (u.includes("localhost") || u.includes("127.0.0.1")) return "B_localhost";
    if (u.startsWith("/uploads/") || u.startsWith("uploads/")) return "C_localUploads";
    if (u.startsWith("/assets/") || u.startsWith("assets/")) return "D_assets";
    if (u.startsWith("http://") || u.startsWith("https://")) return "E_otherHttp";
    return "E_otherHttp"; // relative or other
  }

  for (const p of allProducts as any[]) {
    const mainImg = p.mainImage;
    const gallery = Array.isArray(p.galleryImages) ? p.galleryImages : [];

    const hasMain = Boolean(mainImg && typeof mainImg === "string" && mainImg.trim() !== "");
    const hasGal = gallery.some((g: any) => typeof g === "string" && g.trim() !== "");

    if (hasMain) withMainImage++;
    if (hasGal) withGalleryImages++;
    if (hasMain || hasGal) withAnyImage++;
    else noImage++;

    const cat = classify(mainImg);
    categories[cat].push({
      id: p._id.toString(),
      name: p.productName || p.name,
      mainImage: mainImg,
      status: p.status,
      publish: p.publish,
    });

    for (const g of gallery) {
      const gCat = classify(g);
      galleryCategories[gCat].push({
        id: p._id.toString(),
        name: p.productName || p.name,
        galleryImage: g,
      });
    }
  }

  console.log(`\n=== 2. PRODUCTS WITH IMAGES ===`);
  console.log(`Products with mainImage: ${withMainImage}`);
  console.log(`Products with galleryImages: ${withGalleryImages}`);
  console.log(`Products with any image: ${withAnyImage}`);
  console.log(`Products with NO image: ${noImage}`);

  console.log(`\n=== 3. MAIN IMAGE CATEGORIZATION BREAKDOWN ===`);
  console.log(`A. Cloudinary HTTPS (https://res.cloudinary.com/...): ${categories.A_cloudinary.length}`);
  console.log(`B. localhost (http://localhost:5000/...):              ${categories.B_localhost.length}`);
  console.log(`C. local uploads (/uploads/...):                         ${categories.C_localUploads.length}`);
  console.log(`D. frontend assets (/assets/...):                        ${categories.D_assets.length}`);
  console.log(`E. other HTTP/HTTPS:                                     ${categories.E_otherHttp.length}`);
  console.log(`F. missing/null/empty:                                   ${categories.F_emptyOrMissing.length}`);

  console.log(`\n=== 4. GALLERY IMAGE CATEGORIZATION BREAKDOWN ===`);
  console.log(`A. Cloudinary HTTPS: ${galleryCategories.A_cloudinary.length}`);
  console.log(`B. localhost:        ${galleryCategories.B_localhost.length}`);
  console.log(`C. local uploads:     ${galleryCategories.C_localUploads.length}`);
  console.log(`D. frontend assets:   ${galleryCategories.D_assets.length}`);
  console.log(`E. other HTTP/HTTPS:  ${galleryCategories.E_otherHttp.length}`);
  console.log(`F. missing/empty:     ${galleryCategories.F_emptyOrMissing.length}`);

  console.log(`\n=== 5. REPRESENTATIVE SAMPLES BY CATEGORY (mainImage) ===`);

  for (const [catName, list] of Object.entries(categories)) {
    console.log(`\n--- Category ${catName} (Count: ${list.length}) ---`);
    const samples = list.slice(0, 5);
    for (const s of samples) {
      console.log(`  [${s.id}] "${s.name}": ${s.mainImage}`);
    }
  }

  console.log(`\n=== 6. LOCAL DISK EXISTENCE CHECK FOR LOCALHOST / UPLOADS IMAGES ===`);
  const uploadsBaseDir = path.join(__dirname, "../../uploads");

  let localReferenced = 0;
  let localFound = 0;
  let localMissing = 0;

  const allUrlsToCheck = new Set<string>();
  for (const item of [...categories.B_localhost, ...categories.C_localUploads]) {
    if (item.mainImage) allUrlsToCheck.add(item.mainImage);
  }
  for (const item of [...galleryCategories.B_localhost, ...galleryCategories.C_localUploads]) {
    if (item.galleryImage) allUrlsToCheck.add(item.galleryImage);
  }

  console.log(`Unique localhost/upload URLs referenced across products: ${allUrlsToCheck.size}`);
  for (const rawUrl of allUrlsToCheck) {
    localReferenced++;
    let relPath = rawUrl;
    if (relPath.includes("/uploads/")) {
      relPath = relPath.substring(relPath.indexOf("/uploads/") + "/uploads/".length);
    } else if (relPath.startsWith("uploads/")) {
      relPath = relPath.substring("uploads/".length);
    }
    const fullPath = path.join(uploadsBaseDir, relPath);
    const exists = fs.existsSync(fullPath);
    if (exists) {
      localFound++;
    } else {
      localMissing++;
      console.log(`  MISSING on disk: ${rawUrl} -> ${fullPath}`);
    }
  }
  console.log(`Total local URLs referenced: ${localReferenced}`);
  console.log(`Found on local disk: ${localFound}`);
  console.log(`Missing on local disk: ${localMissing}`);

  console.log(`\n=== 7. CLOUDINARY CONFIGURATION CHECK ===`);
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const hasKey = Boolean(process.env.CLOUDINARY_API_KEY);
  const hasSecret = Boolean(process.env.CLOUDINARY_API_SECRET);

  console.log(`Cloud Name configured: ${cloudName ? cloudName : "NONE"}`);
  console.log(`API Key configured:    ${hasKey ? "YES (masked)" : "NO"}`);
  console.log(`API Secret configured: ${hasSecret ? "YES (masked)" : "NO"}`);

  if (cloudName && hasKey && hasSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    try {
      const ping = await cloudinary.api.ping();
      console.log(`Cloudinary Ping Status: ${ping.status}`);
      console.log(`Cloudinary Ping Rate Limit Remaining: ${ping.rate_limit_remaining}`);
    } catch (e: any) {
      console.log(`Cloudinary Ping Failed: ${e.message}`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDisconnected from DB. Forensic audit complete.");
}

audit().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
