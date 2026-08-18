import { Router } from "express";
import { getSalesReport } from "../modules/seller/controllers/reportController";
import { authenticate, requireUserType, requireApprovedUser } from "../middleware/auth";

const router = Router();

// All routes require authentication, seller user type, and operational approval
router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(requireApprovedUser);

// Get seller's sales report
router.get("/sales", getSalesReport);

export default router;
