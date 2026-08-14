import { Router } from "express";
import * as customerAuthController from "../modules/customer/controllers/customerAuthController";
import { otpRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Send SMS OTP route
router.post("/send-sms-otp", otpRateLimiter, customerAuthController.sendSmsOtp);

// Verify SMS OTP and login route (auto-creates user if not exists)
router.post("/verify-sms-otp", loginRateLimiter, customerAuthController.verifySmsOtp);

export default router;
