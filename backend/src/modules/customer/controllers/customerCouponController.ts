import { Request, Response } from "express";
import Coupon from "../../../models/Coupon";
import Product from "../../../models/Product";
import { hasReachedPerUserCouponLimit, computeCouponDiscount, ICouponLine } from "../../../services/couponService";

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

        // Per-customer usage limit (same rule the checkout enforces)
        const userId = (req as any).user?.userId;
        if (userId && await hasReachedPerUserCouponLimit(coupon as any, userId)) {
            return res.status(400).json({
                success: false,
                message: "You have already used this coupon the maximum number of times",
            });
        }

        // Check min order value
        if (coupon.minimumPurchase && orderTotal < coupon.minimumPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum order value of ₹${coupon.minimumPurchase} required`,
            });
        }

        // Determine discount amount with the SAME rule checkout charges (scope + round2).
        // When cart lines are sent, category/seller are resolved server-side from Product.
        let discountAmount = 0;
        const rawLines = Array.isArray(req.body.items) ? req.body.items : null;
        if (rawLines && rawLines.length > 0) {
            const ids = rawLines.map((l: any) => String(l?.productId || "")).filter(Boolean);
            const products = await Product.find({ _id: { $in: ids } }).select("category seller").lean();
            const byId = new Map(products.map((p: any) => [String(p._id), p]));
            const lines: ICouponLine[] = rawLines.map((l: any) => {
                const p: any = byId.get(String(l?.productId));
                return {
                    productId: String(l?.productId || ""),
                    categoryId: p?.category ? String(p.category) : undefined,
                    sellerId: p?.seller ? String(p.seller) : undefined,
                    total: Math.max(0, Number(l?.total) || 0),
                };
            });
            const evalResult = computeCouponDiscount(coupon as any, lines);
            if (evalResult.discount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: evalResult.reason || "Coupon is not applicable to items in your cart",
                });
            }
            discountAmount = evalResult.discount;
        } else {
            // Legacy callers (no lines): whole-cart preview, rounded like checkout
            discountAmount = computeCouponDiscount(coupon as any, [{ total: Number(orderTotal) || 0 } as ICouponLine]).discount;
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
