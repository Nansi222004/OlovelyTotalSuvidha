import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const CLOUDINARY_DIR = path.join(process.cwd(), "..", "cloudinary");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const INDEX_JSON_PATH = path.join(CLOUDINARY_DIR, "index.json");

interface CloudinaryIndexItem {
  public_id: string;
  url?: string;
  secure_url?: string;
  delivery_url?: string;
  local_path?: string;
  format?: string;
}

/**
 * Build index map from cloudinary/index.json and directory traversal
 */
function buildFileMap(): Map<string, string> {
  const urlToFileMap = new Map<string, string>();

  // 1. Parse index.json if it exists
  if (fs.existsSync(INDEX_JSON_PATH)) {
    console.log(`[Migration] Reading Cloudinary index: ${INDEX_JSON_PATH}`);
    try {
      let rawData = fs.readFileSync(INDEX_JSON_PATH, "utf-8");
      // Remove UTF-8 BOM, null bytes, and non-JSON prefix characters
      rawData = rawData.replace(/^\uFEFF/, "").replace(/^\uFFFD/, "").trim();
      const firstBracketIndex = rawData.indexOf("[");
      if (firstBracketIndex !== -1) {
        rawData = rawData.substring(firstBracketIndex);
      }
      const items: CloudinaryIndexItem[] = JSON.parse(rawData);

      for (const item of items) {
        let physicalFile = "";

        if (item.local_path) {
          // local_path is like "assets/cloudinary/banners/xyz.jpg"
          const relPath = item.local_path.replace(/^assets\/cloudinary\//, "");
          const candidate = path.join(CLOUDINARY_DIR, relPath);
          if (fs.existsSync(candidate)) {
            physicalFile = candidate;
          }
        }

        if (!physicalFile && item.public_id) {
          const ext = item.format ? `.${item.format}` : "";
          const candidate = path.join(CLOUDINARY_DIR, `${item.public_id}${ext}`);
          if (fs.existsSync(candidate)) {
            physicalFile = candidate;
          }
        }

        if (physicalFile) {
          if (item.url) urlToFileMap.set(item.url, physicalFile);
          if (item.secure_url) urlToFileMap.set(item.secure_url, physicalFile);
          if (item.delivery_url) urlToFileMap.set(item.delivery_url, physicalFile);
          if (item.public_id) {
            urlToFileMap.set(item.public_id, physicalFile);
            // Also store versionless variations
            urlToFileMap.set(`dv1l9sb4p/${item.public_id}`, physicalFile);
          }
        }
      }
    } catch (err) {
      console.error("[Migration] Warning reading index.json:", err);
    }
  }

  // 2. Traversal scan of cloudinary directory for all media files
  console.log(`[Migration] Scanning disk files in ${CLOUDINARY_DIR}...`);
  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (!entry.name.endsWith(".meta.json") && entry.name !== "index.json") {
        const relativeToCloudinary = path.relative(CLOUDINARY_DIR, fullPath).replace(/\\/g, "/");
        urlToFileMap.set(relativeToCloudinary, fullPath);
        urlToFileMap.set(entry.name, fullPath);

        // Remove extension for public_id match
        const nameWithoutExt = relativeToCloudinary.replace(/\.[^/.]+$/, "");
        urlToFileMap.set(nameWithoutExt, fullPath);
      }
    }
  }
  scanDir(CLOUDINARY_DIR);

  console.log(`[Migration] Indexed ${urlToFileMap.size} file mapping keys.`);
  return urlToFileMap;
}

/**
 * Check if string looks like a Cloudinary URL or ID
 */
function isCloudinaryUrl(val: string): boolean {
  if (typeof val !== "string") return false;
  return (
    val.includes("cloudinary.com") ||
    val.includes("res.cloudinary.com") ||
    val.includes("dv1l9sb4p") ||
    val.startsWith("dhakadsnazzy/")
  );
}

/**
 * Find matching disk file for a given Cloudinary URL string
 */
function findDiskFileForUrl(urlStr: string, fileMap: Map<string, string>): string | null {
  if (fileMap.has(urlStr)) return fileMap.get(urlStr)!;

  // Extract public ID from URL like http://res.cloudinary.com/dv1l9sb4p/image/upload/v1739.../dhakadsnazzy/products/abc.jpg
  const match = urlStr.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\?.*)?$/);
  if (match && match[1]) {
    const publicIdWithExt = match[1];
    if (fileMap.has(publicIdWithExt)) return fileMap.get(publicIdWithExt)!;

    const publicIdNoExt = publicIdWithExt.replace(/\.[^/.]+$/, "");
    if (fileMap.has(publicIdNoExt)) return fileMap.get(publicIdNoExt)!;
  }

  // Match by filename
  const filename = urlStr.split("/").pop()?.split("?")[0];
  if (filename && fileMap.has(filename)) {
    return fileMap.get(filename)!;
  }

  return null;
}

/**
 * Main migration function
 */
export async function runMigration() {
  console.log("\n=======================================================");
  console.log(" Starting Cloudinary to Local Storage Image Migration ");
  console.log("=======================================================\n");

  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/dhakadsnazzy";

  if (mongoose.connection.readyState !== 1) {
    console.log(`[Migration] Connecting to MongoDB: ${mongoUri.split("@").pop()}`);
    await mongoose.connect(mongoUri);
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to access MongoDB database instance.");
  }

  const fileMap = buildFileMap();
  const collections = await db.listCollections().toArray();

  let totalCollectionsScanned = 0;
  let totalDocsScanned = 0;
  let totalCloudinaryUrlsFound = 0;
  let totalImagesCopied = 0;
  let totalDocsUpdated = 0;
  const unmatchedUrls: string[] = [];
  const copiedFiles = new Set<string>();

  for (const colInfo of collections) {
    const colName = colInfo.name;
    // Skip system collections
    if (colName.startsWith("system.")) continue;

    totalCollectionsScanned++;
    const col = db.collection(colName);
    const docs = await col.find({}).toArray();

    for (const doc of docs) {
      totalDocsScanned++;
      let docModified = false;
      const updates: Record<string, any> = {};

      function processValue(val: any, fieldPath: string): any {
        if (!val) return val;

        if (typeof val === "string" && isCloudinaryUrl(val)) {
          totalCloudinaryUrlsFound++;
          const diskFile = findDiskFileForUrl(val, fileMap);

          if (diskFile && fs.existsSync(diskFile)) {
            // Determine relative target path inside backend/uploads/
            const relativeToCloudinary = path.relative(CLOUDINARY_DIR, diskFile).replace(/\\/g, "/");
            const targetPath = path.join(UPLOADS_DIR, relativeToCloudinary);
            const targetDir = path.dirname(targetPath);

            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            if (!fs.existsSync(targetPath)) {
              fs.copyFileSync(diskFile, targetPath);
              totalImagesCopied++;
              copiedFiles.add(targetPath);
            }

            const newLocalUrl = `/uploads/${relativeToCloudinary}`;
            docModified = true;
            return newLocalUrl;
          } else {
            if (!unmatchedUrls.includes(val)) {
              unmatchedUrls.push(val);
            }
            return val;
          }
        }

        if (Array.isArray(val)) {
          let arrayModified = false;
          const newArray = val.map((item, idx) => {
            const newItem = processValue(item, `${fieldPath}.${idx}`);
            if (newItem !== item) arrayModified = true;
            return newItem;
          });
          if (arrayModified) docModified = true;
          return newArray;
        }

        if (typeof val === "object" && val !== null && !(val instanceof Date) && !(val instanceof mongoose.Types.ObjectId)) {
          let objModified = false;
          const newObj: Record<string, any> = {};
          for (const key of Object.keys(val)) {
            const newVal = processValue(val[key], `${fieldPath}.${key}`);
            newObj[key] = newVal;
            if (newVal !== val[key]) objModified = true;
          }
          if (objModified) docModified = true;
          return newObj;
        }

        return val;
      }

      for (const key of Object.keys(doc)) {
        if (key === "_id") continue;
        const updatedVal = processValue(doc[key], key);
        if (updatedVal !== doc[key]) {
          updates[key] = updatedVal;
        }
      }

      if (docModified && Object.keys(updates).length > 0) {
        await col.updateOne({ _id: doc._id }, { $set: updates });
        totalDocsUpdated++;
      }
    }
  }

  console.log("\n=======================================================");
  console.log("                Migration Summary Report               ");
  console.log("=======================================================");
  console.log(`Collections Scanned:    ${totalCollectionsScanned}`);
  console.log(`Documents Scanned:      ${totalDocsScanned}`);
  console.log(`Cloudinary URLs Found:  ${totalCloudinaryUrlsFound}`);
  console.log(`Unique Images Copied:   ${totalImagesCopied}`);
  console.log(`Documents Updated:      ${totalDocsUpdated}`);
  console.log(`Unmatched URLs Count:   ${unmatchedUrls.length}`);
  if (unmatchedUrls.length > 0) {
    console.log("\nUnmatched Cloudinary URLs (not found on disk):");
    unmatchedUrls.slice(0, 10).forEach((u) => console.log(` - ${u}`));
    if (unmatchedUrls.length > 10) {
      console.log(` ... and ${unmatchedUrls.length - 10} more`);
    }
  }
  console.log("=======================================================\n");

  return {
    success: true,
    totalCollectionsScanned,
    totalDocsScanned,
    totalCloudinaryUrlsFound,
    totalImagesCopied,
    totalDocsUpdated,
    unmatchedCount: unmatchedUrls.length,
    unmatchedUrls: unmatchedUrls.slice(0, 50),
  };
}

// Execute directly if run via ts-node
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log("[Migration] Finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Migration] Fatal error during migration:", err);
      process.exit(1);
    });
}
