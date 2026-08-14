import { Router } from "express";
import { getCategories, getCategoriesWithSubs, getCategoryById } from "../modules/customer/controllers/customerCategoryController";

const router = Router();

// Public routes
router.get("/", getCategories);
router.get("/tree", getCategoriesWithSubs);
router.get("/:id", getCategoryById);

export default router;
