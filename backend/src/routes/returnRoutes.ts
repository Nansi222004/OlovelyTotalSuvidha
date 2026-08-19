import { Router } from "express";
import {
  getReturnRequests,
  getReturnRequestById,
  updateReturnStatus,
  confirmSellerReceipt,
} from "../modules/seller/controllers/returnController";
import { authenticate, requireUserType, requireApprovedUser } from "../middleware/auth";

const router = Router();

// All routes require authentication, seller user type, and operational approval
router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(requireApprovedUser);

// Get seller's return requests with filters
router.get("/", getReturnRequests);

// Get return request by ID
router.get("/:id", getReturnRequestById);

// Update return request status (Seller: Pending → Approved | Rejected ONLY)
router.patch("/:id/status", updateReturnStatus);

// Confirm physical receipt of returned item (Handed To Seller → Completed → triggers settlement)
router.post("/:id/confirm-receipt", confirmSellerReceipt);

export default router;
