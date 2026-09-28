import { Router } from "express";
import * as sellerAuthController from "../modules/seller/controllers/sellerAuthController";
import { otpRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// Send OTP route
router.post("/send-otp", otpRateLimiter, sellerAuthController.sendOTP);

// Verify OTP and login route
router.post("/verify-otp", loginRateLimiter, sellerAuthController.verifyOTP);

// Register route
router.post("/register", sellerAuthController.register);

// Profile routes (protected)
router.get("/profile", authenticate, sellerAuthController.getProfile);
router.put("/profile", authenticate, sellerAuthController.updateProfile);
router.put("/toggle-shop-status", authenticate, sellerAuthController.toggleShopStatus);

// Self-service delete seller account (protected, seller only)
router.delete("/account", authenticate, requireUserType("Seller"), sellerAuthController.deleteAccount);

export default router;
