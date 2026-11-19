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
  PRODUCTS: "olovely/products",
  PRODUCT_GALLERY: "olovely/products/gallery",
  CATEGORIES: "olovely/categories",
  SUBCATEGORIES: "olovely/subcategories",
  COUPONS: "olovely/coupons",
  SELLERS: "olovely/sellers",
  SELLER_PROFILE: "olovely/sellers/profile",
  SELLER_DOCUMENTS: "olovely/sellers/documents",
  DELIVERY: "olovely/delivery",
  DELIVERY_DOCUMENTS: "olovely/delivery/documents",
  STORES: "olovely/stores",
  USERS: "olovely/users",
  BANNERS: "olovely/banners",
} as const;
