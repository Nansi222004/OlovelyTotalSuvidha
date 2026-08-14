import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validate configuration
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.warn("⚠️  Cloudinary credentials not found in environment variables");
}

export default cloudinary;

// Folder structure constants
export const CLOUDINARY_FOLDERS = {
  PRODUCTS: "dhakadsnazzy/products",
  PRODUCT_GALLERY: "dhakadsnazzy/products/gallery",
  CATEGORIES: "dhakadsnazzy/categories",
  SUBCATEGORIES: "dhakadsnazzy/subcategories",
  COUPONS: "dhakadsnazzy/coupons",
  SELLERS: "dhakadsnazzy/sellers",
  SELLER_PROFILE: "dhakadsnazzy/sellers/profile",
  SELLER_DOCUMENTS: "dhakadsnazzy/sellers/documents",
  DELIVERY: "dhakadsnazzy/delivery",
  DELIVERY_DOCUMENTS: "dhakadsnazzy/delivery/documents",
  STORES: "dhakadsnazzy/stores",
  USERS: "dhakadsnazzy/users",
} as const;
