import { Router } from "express";
import { getProducts, getProductById } from "../modules/customer/controllers/customerProductController";

const router = Router();

// Public routes (no auth required for viewing products)
router.get("/", getProducts);
router.get("/:id", getProductById);

export default router;
