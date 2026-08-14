import { Request, Response } from "express";
import Coupon from "../../../models/Coupon";

// Get available coupons
export const getCoupons = async (_req: Request, res: Response) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const coupons = await Coupon.find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: startOfToday },
        }).sort({ endDate: 1 });

        return res.status(200).json({
            success: true,
            data: coupons,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching coupons",
            error: error.message,
        });
    }
};

// Validate a coupon code
export const validateCoupon = async (req: Request, res: Response) => {
    try {
        const { code, orderTotal } = req.body;
        // const userId = req.user!.userId; // Not currently used, but authentication is checked by middleware

        if (!code) {
            return res.status(400).json({
                success: false,
                message: "Coupon code is required",
            });
        }

        const coupon = await Coupon.findOne({
            code: code.toUpperCase(),
            isActive: true,
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Invalid coupon code",
            });
        }

        // Check dates
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        if (now < coupon.startDate || startOfToday > coupon.endDate) {
            return res.status(400).json({
                success: false,
                message: "Coupon has expired",
            });
        }

        // Check usage limits
        if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
            return res.status(400).json({
                success: false,
                message: "Coupon usage limit reached",
            });
        }

        // Check min order value
        if (coupon.minimumPurchase && orderTotal < coupon.minimumPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum order value of ₹${coupon.minimumPurchase} required`,
            });
        }

        // Determine discount amount
        let discountAmount = 0;
        if (coupon.discountType === "Percentage") {
            discountAmount = (orderTotal * coupon.discountValue) / 100;
            if (coupon.maximumDiscount && discountAmount > coupon.maximumDiscount) {
                discountAmount = coupon.maximumDiscount;
            }
        } else {
            discountAmount = coupon.discountValue;
        }

        return res.status(200).json({
            success: true,
            data: {
                isValid: true,
                coupon,
                discountAmount,
                finalTotal: Math.max(0, orderTotal - discountAmount),
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error validating coupon",
            error: error.message,
        });
    }
};
