import { Request, Response } from "express";
import Customer from "../../../models/Customer";
import SupportedLanguage from "../../../models/SupportedLanguage";
import {
  sendSmsOtp as sendSmsOtpService,
  verifySmsOtp as verifySmsOtpService,
} from "../../../services/otpService";
import { generateToken } from "../../../services/jwtService";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Send SMS OTP to customer mobile number
 * Returns session_id for verification
 */
export const sendSmsOtp = asyncHandler(async (req: Request, res: Response) => {
  const rawMobile = req.body.mobile;
  const mobile = rawMobile != null ? String(rawMobile).trim().replace(/\D/g, '').slice(0, 10) : '';

  if (!mobile || mobile.length !== 10) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  try {
    const result = await sendSmsOtpService(mobile, "Customer");

    return res.status(200).json({
      success: true,
      message: result.message,
      sessionId: result.sessionId,
    });
  } catch (error: any) {
    console.error(`[CUSTOMER_AUTH] send-sms-otp error for ${mobile}:`, error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to send OTP. Please try again.",
    });
  }
});

/**
 * Verify SMS OTP and login customer
 * Requires session_id and otp
 * Auto-creates customer if not exists
 */
export const verifySmsOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { mobile, otp, sessionId } = req.body;

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit mobile number is required",
      });
    }

    if (!otp || !/^[0-9]{4}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Valid 4-digit OTP is required",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required for verification",
      });
    }

    // Verify SMS OTP
    const isValid = await verifySmsOtpService(
      sessionId,
      otp,
      mobile,
      "Customer",
    );
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Find or create customer
    let customer = await Customer.findOne({ phone: mobile });
    let isNewUser = false;

    if (!customer) {
      // Auto-create new customer with placeholder data
      customer = await Customer.create({
        phone: mobile,
        name: "User",
        email: `${mobile}@olovely.temp`,
        status: "Active",
        walletAmount: 0,
        totalOrders: 0,
        totalSpent: 0,
      });
      isNewUser = true;
    }

    // Generate JWT token
    const token = generateToken(customer._id.toString(), "Customer");

    // Check preferred language active status
    let languageSelected = false;
    let preferredLanguage: string | null = customer.preferredLanguage || null;

    if (preferredLanguage) {
      const activeLang = await SupportedLanguage.findOne({
        code: preferredLanguage.toLowerCase(),
        isActive: true,
      });
      if (activeLang) {
        languageSelected = true;
      } else {
        languageSelected = false;
      }
    }

    return res.status(200).json({
      success: true,
      message: isNewUser
        ? "Account created and login successful"
        : "Login successful",
      data: {
        token,
        user: {
          id: customer._id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          walletAmount: customer.walletAmount,
          refCode: customer.refCode,
          status: customer.status,
          preferredLanguage,
        },
        isNewUser,
        languageSelected,
      },
    });
  },
);
