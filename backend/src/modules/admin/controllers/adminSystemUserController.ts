import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Admin from "../../../models/Admin";

/**
 * Get all system users (admins) with filters and pagination
 */
export const getAllSystemUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};

    // Filter by role
    if (role && (role === "Super Admin" || role === "Admin")) {
      query.role = role;
    }

    // Search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search as string, $options: "i" } },
        { lastName: { $regex: search as string, $options: "i" } },
        { email: { $regex: search as string, $options: "i" } },
        { mobile: { $regex: search as string, $options: "i" } },
      ];
    }

    // Sort options
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [admins, total] = await Promise.all([
      Admin.find(query)
        .select("-password") // Don't return password
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit as string)),
      Admin.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "System users fetched successfully",
      data: admins.map((admin) => ({
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        mobile: admin.mobile,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get system user by ID
 */
export const getSystemUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const admin = await Admin.findById(id).select("-password");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "System user not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "System user fetched successfully",
      data: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        mobile: admin.mobile,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    });
  }
);

/**
 * Create new system user (admin)
 */
export const createSystemUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { firstName, lastName, mobile, email, password, role } = req.body;

    // Validation
    if (!firstName || !lastName || !mobile || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate role
    if (role && role !== "Admin" && role !== "Super Admin") {
      return res.status(400).json({
        success: false,
        message: "Role must be either 'Admin' or 'Super Admin'",
      });
    }

    // Validate mobile number format
    if (!/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit mobile number is required",
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
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
      role: role || "Admin", // Default to "Admin" if not provided
    });

    return res.status(201).json({
      success: true,
      message: "System user created successfully",
      data: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        mobile: admin.mobile,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    });
  }
);

/**
 * Update system user (admin)
 */
export const updateSystemUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { firstName, lastName, mobile, email, password, role } = req.body;

    // Find the admin
    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "System user not found",
      });
    }

    // Validate role if provided
    if (role && role !== "Admin" && role !== "Super Admin") {
      return res.status(400).json({
        success: false,
        message: "Role must be either 'Admin' or 'Super Admin'",
      });
    }

    // Check if email is being changed and if it's already in use
    if (email && email !== admin.email) {
      const existingAdmin = await Admin.findOne({
        email,
        _id: { $ne: id },
      });
      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: "Email already in use by another admin",
        });
      }
    }

    // Check if mobile is being changed and if it's already in use
    if (mobile && mobile !== admin.mobile) {
      const existingAdmin = await Admin.findOne({
        mobile,
        _id: { $ne: id },
      });
      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: "Mobile number already in use by another admin",
        });
      }
    }

    // Validate mobile number format if provided
    if (mobile && !/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit mobile number is required",
      });
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Update fields
    if (firstName) admin.firstName = firstName;
    if (lastName) admin.lastName = lastName;
    if (email) admin.email = email;
    if (mobile) admin.mobile = mobile;
    if (role) admin.role = role as "Admin" | "Super Admin";
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }
      admin.password = password; // Will be hashed by pre-save hook
    }

    await admin.save();

    // Return updated admin without password
    const updatedAdmin = await Admin.findById(id).select("-password");

    return res.status(200).json({
      success: true,
      message: "System user updated successfully",
      data: {
        id: updatedAdmin!._id,
        firstName: updatedAdmin!.firstName,
        lastName: updatedAdmin!.lastName,
        mobile: updatedAdmin!.mobile,
        email: updatedAdmin!.email,
        role: updatedAdmin!.role,
        updatedAt: updatedAdmin!.updatedAt,
      },
    });
  }
);

/**
 * Delete system user (admin)
 */
export const deleteSystemUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Prevent deleting yourself
    const currentUserId = req.user!.userId;
    if (id === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "System user not found",
      });
    }

    // Prevent deleting the last Super Admin
    if (admin.role === "Super Admin") {
      const superAdminCount = await Admin.countDocuments({ role: "Super Admin" });
      if (superAdminCount === 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the last Super Admin",
        });
      }
    }

    await Admin.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "System user deleted successfully",
    });
  }
);

