import { Request, Response } from "express";
import Admin from "../../../models/Admin";
import { generateToken } from "../../../services/jwtService";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Admin OTP login was retired. Keep explicit responses for older clients without
 * touching the shared OTP service used by customers and delivery flows.
 */
export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    message: "Admin OTP login is no longer supported. Please use email and password.",
  });
});

export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    message: "Admin OTP login is no longer supported. Please use email and password.",
  });
});

/** Authenticate an existing admin with the model's bcrypt comparison method. */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const admin = await Admin.findOne({ email }).select("+password");
  const isValid = admin ? await admin.comparePassword(password) : false;
  if (!admin || !isValid) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  const token = generateToken(admin._id.toString(), "Admin", admin.role);
  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        mobile: admin.mobile,
        email: admin.email,
        role: admin.role,
      },
    },
  });
});

/**
 * Register new admin (optional - typically admins are created by super admin)
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, mobile, email, password, role } = req.body;

  // Validation
  if (!firstName || !lastName || !mobile || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  if (!/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  // Check if admin already exists
  const existingAdmin = await Admin.findOne({
    $or: [{ mobile }, { email }],
  });

  if (existingAdmin) {
    return res.status(409).json({
      success: false,
      message: "Admin already exists with this mobile or email",
    });
  }

  // Create new admin
  const admin = await Admin.create({
    firstName,
    lastName,
    mobile,
    email,
    password,
    role: role || "Admin",
  });

  // Generate token
  const token = generateToken(admin._id.toString(), "Admin", admin.role);

  return res.status(201).json({
    success: true,
    message: "Admin registered successfully",
    data: {
      token,
      user: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        mobile: admin.mobile,
        email: admin.email,
        role: admin.role,
      },
    },
  });
});
