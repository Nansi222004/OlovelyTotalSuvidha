import fs from "fs";
import path from "path";
import { UploadOptions, UploadResult } from "./cloudinaryService";

const UPLOADS_BASE_DIR = path.join(process.cwd(), "uploads");

/**
 * Ensure destination directory exists on disk
 */
function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getFullUrl(relativePath: string): string {
  const serverUrl = process.env.SERVER_URL ? process.env.SERVER_URL.replace(/\/$/, "") : "";
  return `${serverUrl}${relativePath}`;
}

/**
 * Save image buffer to local uploads directory
 */
export async function uploadImageFromBuffer(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const folder = options.folder || "olovely/products";
  const normalizedFolder = folder.replace(/^\/+/, "");
  const targetDir = path.join(UPLOADS_BASE_DIR, normalizedFolder);
  ensureDirExists(targetDir);

  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000);
  const filename = `${timestamp}_${randomSuffix}.png`;
  const filePath = path.join(targetDir, filename);

  await fs.promises.writeFile(filePath, buffer);

  const relativeUrl = `/uploads/${normalizedFolder}/${filename}`;
  const fullUrl = getFullUrl(relativeUrl);

  return {
    url: fullUrl,
    secureUrl: fullUrl,
    publicId: `${normalizedFolder}/${filename}`,
    bytes: buffer.length,
    format: "png",
  };
}

/**
 * Save document buffer (image / pdf) to local uploads directory
 */
export async function uploadDocumentFromBuffer(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const folder = options.folder || "olovely/documents";
  const normalizedFolder = folder.replace(/^\/+/, "");
  const targetDir = path.join(UPLOADS_BASE_DIR, normalizedFolder);
  ensureDirExists(targetDir);

  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000);
  const ext = options.resourceType === "raw" ? "pdf" : "png";
  const filename = `${timestamp}_${randomSuffix}.${ext}`;
  const filePath = path.join(targetDir, filename);

  await fs.promises.writeFile(filePath, buffer);

  const relativeUrl = `/uploads/${normalizedFolder}/${filename}`;
  const fullUrl = getFullUrl(relativeUrl);

  return {
    url: fullUrl,
    secureUrl: fullUrl,
    publicId: `${normalizedFolder}/${filename}`,
    bytes: buffer.length,
    format: ext,
  };
}

/**
 * Delete file from local disk by publicId or URL
 */
export async function deleteImage(publicIdOrUrl: string): Promise<void> {
  try {
    let relativePath = publicIdOrUrl;
    if (relativePath.startsWith("/uploads/")) {
      relativePath = relativePath.replace("/uploads/", "");
    }
    const fullPath = path.join(UPLOADS_BASE_DIR, relativePath);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (error) {
    console.error(`Failed to delete local file ${publicIdOrUrl}:`, error);
  }
}
