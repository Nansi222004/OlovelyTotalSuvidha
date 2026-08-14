import { Router } from "express";
import {
  getCategories,
  getCategoryById,
  getSubcategories,
  getAllCategoriesWithSubcategories,
  getAllSubcategories,
  getSubSubCategories,
} from "../modules/seller/controllers/categoryController";

const router = Router();

// Category routes - Public for retrieval
// Admin/Seller specific management routes are in their respective route files

// Get all categories (parent categories only by default)
router.get("/", getCategories);

// Get all subcategories (across all categories)
router.get("/subcategories", getAllSubcategories);

// Get all categories with nested subcategories
router.get("/all-with-subcategories", getAllCategoriesWithSubcategories);

// Get category by ID
router.get("/:id", getCategoryById);

// Get subcategories of a specific category
// Get subcategories of a specific category
router.get("/:id/subcategories", getSubcategories);

// Get sub-subcategories of a specific subcategory
router.get("/:subCategoryId/sub-subcategories", getSubSubCategories);

export default router;

