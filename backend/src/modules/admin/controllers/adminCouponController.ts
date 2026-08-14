import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Coupon from "../../../models/Coupon";

/**
 * Create a new coupon
 */
export const createCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      code,
      description,
      discountType,
      discountValue,
      minimumPurchase,
      maximumDiscount,
      startDate,
      endDate,
      usageLimit,
      usageLimitPerUser,
      applicableTo,
      applicableIds,
    } = req.body;

    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "Code, discount type, discount value, start date, and end date are required",
      });
    }

    if (!["Percentage", "Fixed"].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: "Discount type must be Percentage or Fixed",
      });
    }

    if (discountType === "Percentage" && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount cannot exceed 100%",
      });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minimumPurchase,
      maximumDiscount,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      usageLimit,
      usageLimitPerUser,
      applicableTo: applicableTo || "All",
      applicableIds,
      createdBy: req.user?.userId,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  }
);

/**
 * Get all coupons
 */
export const getCoupons = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    isActive,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query: any = {};

  if (isActive !== undefined) query.isActive = isActive === "true";
  if (search) {
    query.$or = [
      { code: { $regex: search as string, $options: "i" } },
      { description: { $regex: search as string, $options: "i" } },
    ];
  }

  const sort: any = {};
  sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [coupons, total] = await Promise.all([
    Coupon.find(query)
      .populate("createdBy", "firstName lastName")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit as string)),
    Coupon.countDocuments(query),
  ]);

  return res.status(200).json({
    success: true,
    message: "Coupons fetched successfully",
    data: coupons,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

/**
 * Get coupon by ID
 */
export const getCouponById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const coupon = await Coupon.findById(id).populate(
      "createdBy",
      "firstName lastName"
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Coupon fetched successfully",
      data: coupon,
    });
  }
);

/**
 * Update coupon
 */
export const updateCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    // Convert code to uppercase if provided
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
    }

    // Convert dates if provided
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    const coupon = await Coupon.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("createdBy", "firstName lastName");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  }
);

/**
 * Delete coupon
 */
export const deleteCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
    });
  }
);

/**
 * Validate coupon
 */
export const validateCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, amount, userId: _userId } = req.body;

    if (!code || !amount) {
      return res.status(400).json({
        success: false,
        message: "Coupon code and amount are required",
      });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code",
      });
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({
        success: false,
        message: "Coupon is not active",
      });
    }

    // Check date validity
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      return res.status(400).json({
        success: false,
        message: "Coupon is not valid at this time",
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit exceeded",
      });
    }

    // Check minimum purchase
    if (coupon.minimumPurchase && amount < coupon.minimumPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minimumPurchase} required`,
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "Percentage") {
      discount = (amount * coupon.discountValue) / 100;
      if (coupon.maximumDiscount && discount > coupon.maximumDiscount) {
        discount = coupon.maximumDiscount;
      }
    } else {
      discount = coupon.discountValue;
    }

    return res.status(200).json({
      success: true,
      message: "Coupon is valid",
      data: {
        coupon: coupon.toObject(),
        discount,
        finalAmount: amount - discount,
      },
    });
  }
);
