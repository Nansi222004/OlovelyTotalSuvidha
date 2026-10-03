import { Router } from "express";
import * as adminAuthController from "../modules/admin/controllers/adminAuthController";
import { otpRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/login", loginRateLimiter, adminAuthController.login);

// Compatibility endpoints: explicitly retired and never enter the shared OTP service.
router.post("/send-otp", otpRateLimiter, adminAuthController.sendOTP);

// Verify OTP and login route
router.post("/verify-otp", loginRateLimiter, adminAuthController.verifyOTP);

// Register route
router.post("/register", adminAuthController.register);

export default router;
