import { Request, Response } from "express";
import Admin from "../../../models/Admin";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Get authenticated admin's profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const admin = await Admin.findById(userId).select("-password");

    if (!admin) {
        return res.status(404).json({
            success: false,
            message: "Admin not found",
        });
    }

    return res.status(200).json({
        success: true,
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
});

/**
 * Update authenticated admin's profile
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { firstName, lastName, email, mobile } = req.body;

    // Find the admin
    const admin = await Admin.findById(userId);

    if (!admin) {
        return res.status(404).json({
            success: false,
            message: "Admin not found",
        });
    }

    // Check if email is being changed and if it's already in use
    if (email && email !== admin.email) {
        const existingAdmin = await Admin.findOne({ email, _id: { $ne: userId } });
        if (existingAdmin) {
            return res.status(409).json({
                success: false,
                message: "Email already in use by another admin",
            });
        }
    }

    // Check if mobile is being changed and if it's already in use
    if (mobile && mobile !== admin.mobile) {
        const existingAdmin = await Admin.findOne({ mobile, _id: { $ne: userId } });
        if (existingAdmin) {
            return res.status(409).json({
                success: false,
                message: "Mobile number already in use by another admin",
            });
        }
    }

    // Update fields
    if (firstName) admin.firstName = firstName;
    if (lastName) admin.lastName = lastName;
    if (email) admin.email = email;
    if (mobile) admin.mobile = mobile;

    await admin.save();

    return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: {
            id: admin._id,
            firstName: admin.firstName,
            lastName: admin.lastName,
            mobile: admin.mobile,
            email: admin.email,
            role: admin.role,
            updatedAt: admin.updatedAt,
        },
    });
});
