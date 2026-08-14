import { Router } from "express";
import * as adminAuthController from "../modules/admin/controllers/adminAuthController";
import { otpRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Send OTP route
router.post("/send-otp", otpRateLimiter, adminAuthController.sendOTP);

// Verify OTP and login route
router.post("/verify-otp", loginRateLimiter, adminAuthController.verifyOTP);

// Register route
router.post("/register", adminAuthController.register);

export default router;
