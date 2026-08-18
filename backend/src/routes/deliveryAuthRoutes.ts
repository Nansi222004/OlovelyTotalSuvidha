import { Router } from "express";
import * as deliveryAuthController from "../modules/delivery/controllers/deliveryAuthController";
import { otpRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";
import { authenticate } from "../middleware/auth";

const router = Router();

// Send SMS OTP route
router.post("/send-sms-otp", otpRateLimiter, deliveryAuthController.sendSmsOtp);

// Verify SMS OTP and login route
router.post("/verify-sms-otp", loginRateLimiter, deliveryAuthController.verifySmsOtp);

// Register route
router.post("/register", deliveryAuthController.register);

// Profile route (authenticated, does not require approval)
router.get("/profile", authenticate, deliveryAuthController.getProfile);

export default router;
