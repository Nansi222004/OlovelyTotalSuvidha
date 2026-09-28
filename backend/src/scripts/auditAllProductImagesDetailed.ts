import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import fs from "fs";

dotenv.config({ path: path.join("d:/Appzeto_Projects/OlovelyTotalSuvidha/backend", ".env") });

async function checkAllProductUrls() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(mongoUri!);

  const Product = mongoose.model(
    "ProductAudit2",
    new mongoose.Schema({}, { strict: false }),
    "products"
  );

  const products = await Product.find({}).lean();
  console.log(`Auditing all ${products.length} products...\n`);

  const frontendPublicDir = "d:/Appzeto_Projects/OlovelyTotalSuvidha/frontend/public";
  const backendUploadsDir = "d:/Appzeto_Projects/OlovelyTotalSuvidha/backend/uploads";

  const missingAssets: any[] = [];
  const existingAssets: any[] = [];
  const localhostUrls: any[] = [];
  const otherUrls: any[] = [];

  for (const p of products as any[]) {
    const mainImg = p.mainImage || "";
    const gallery = Array.isArray(p.galleryImages) ? p.galleryImages : [];
    const allImages = [mainImg, ...gallery];

    for (const img of allImages) {
      if (!img) continue;
      if (img.startsWith("/assets/")) {
        const fullPath = path.join(frontendPublicDir, img);
        if (fs.existsSync(fullPath)) {
          existingAssets.push({ id: p._id, name: p.productName, img });
        } else {
          missingAssets.push({ id: p._id, name: p.productName, img, path: fullPath });
        }
      } else if (img.includes("localhost")) {
        localhostUrls.push({ id: p._id, name: p.productName, img });
      } else {
        otherUrls.push({ id: p._id, name: p.productName, img });
      }
    }
  }

  console.log(`=== ASSET URLS CHECK (/assets/...) ===`);
  console.log(`Found on disk in frontend/public: ${existingAssets.length}`);
  console.log(`MISSING on disk in frontend/public: ${missingAssets.length}`);
  if (missingAssets.length > 0) {
    console.log("Missing asset files:");
    for (const m of missingAssets) {
      console.log(`  [${m.id}] ${m.name}: ${m.img}`);
    }
  }

  console.log(`\n=== LOCALHOST URLS CHECK (http://localhost:5000/...) ===`);
  console.log(`Total localhost image references: ${localhostUrls.length}`);
  // Check if they exist in backend/uploads
  const uniqueLocalhost = Array.from(new Set(localhostUrls.map(l => l.img)));
  console.log(`Unique localhost URLs: ${uniqueLocalhost.length}`);
  for (const u of uniqueLocalhost) {
    const rel = u.replace("http://localhost:5000/uploads/", "");
    const diskPath = path.join(backendUploadsDir, rel);
    const exists = fs.existsSync(diskPath);
    console.log(`  ${exists ? "EXISTS" : "MISSING"} on disk: ${u}`);
  }

  await mongoose.disconnect();
}

checkAllProductUrls().catch(console.error);
