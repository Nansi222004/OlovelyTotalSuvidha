import { Router } from "express";
import { getCoupons, validateCoupon } from "../modules/customer/controllers/customerCouponController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Publicly visible coupons
router.get("/", getCoupons);

// Protect validation as it might require user context
router.post("/validate", authenticate, validateCoupon);

export default router;
