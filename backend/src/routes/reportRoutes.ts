import { Router } from "express";
import { getSalesReport } from "../modules/seller/controllers/reportController";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));

// Get seller's sales report
router.get("/sales", getSalesReport);

export default router;
