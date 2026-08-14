import { Router } from "express";
import {
  getReturnRequests,
  getReturnRequestById,
  updateReturnStatus,
} from "../modules/seller/controllers/returnController";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));

// Get seller's return requests with filters
router.get("/", getReturnRequests);

// Get return request by ID
router.get("/:id", getReturnRequestById);

// Update return request status
router.patch("/:id/status", updateReturnStatus);

export default router;
