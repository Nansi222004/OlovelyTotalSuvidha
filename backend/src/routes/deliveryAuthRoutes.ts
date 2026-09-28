import { Router } from "express";
import * as deliveryAuthController from "../modules/delivery/controllers/deliveryAuthController";
import { deleteAccount } from "../modules/delivery/controllers/deliveryProfileController";
import { otpRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// Send SMS OTP route
router.post("/send-sms-otp", otpRateLimiter, deliveryAuthController.sendSmsOtp);

// Verify SMS OTP and login route
router.post("/verify-sms-otp", loginRateLimiter, deliveryAuthController.verifySmsOtp);

// Register route
router.post("/register", deliveryAuthController.register);

// Profile route (authenticated, does not require approval)
router.get("/profile", authenticate, deliveryAuthController.getProfile);

// Self-service delete delivery partner account (authenticated, delivery only)
router.delete("/account", authenticate, requireUserType("Delivery"), deleteAccount);

export default router;
