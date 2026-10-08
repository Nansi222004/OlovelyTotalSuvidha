import { Router } from "express";
import {
  getAllSellers,
  getSellerById,
  updateSellerStatus,
  updateSeller,
  deleteSeller,
  updateSellerCategoryCommissions,
  retrySellerPickupProvisioning,
  getSellerSuggestions,
} from "../modules/seller/controllers/sellerController";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// All routes require authentication and admin user type
router.use(authenticate);
router.use(requireUserType("Admin"));

// Get all sellers
router.get("/", getAllSellers);

// Read-only, ranked autocomplete (must precede the dynamic :id route)
router.get("/suggestions", getSellerSuggestions);

// Get seller by ID
router.get("/:id", getSellerById);

// Update seller status
router.patch("/:id/status", updateSellerStatus);

// Retry the recoverable external courier-pickup setup after approval.
router.post("/:id/courier-pickup/retry", retrySellerPickupProvisioning);

// Update seller category commissions
router.put("/:id/category-commissions", updateSellerCategoryCommissions);

// Update seller details
router.put("/:id", updateSeller);

// Delete seller
router.delete("/:id", deleteSeller);

export default router;
