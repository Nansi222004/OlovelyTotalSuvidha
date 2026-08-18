import { Router } from "express";
import { getDashboardStats } from "../modules/seller/controllers/dashboardController";
import { authenticate, requireUserType, requireApprovedUser } from "../middleware/auth";

const router = Router();

// All routes require authentication, seller user type, and operational approval
router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(requireApprovedUser);

// Get seller's dashboard statistics
router.get("/stats", getDashboardStats);

export default router;
