import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import PromoStrip from "../../../models/PromoStrip";
import { cache } from "../../../utils/cache";
import Category from "../../../models/Category";
import Product from "../../../models/Product";
import HeaderCategory from "../../../models/HeaderCategory";

/**
 * Create a new PromoStrip
 */
export const createPromoStrip = asyncHandler(async (req: Request, res: Response) => {
  const {
    headerCategorySlug,
    heading,
    saleText,
    startDate,
    endDate,
    categoryCards,
    featuredProducts,
    isActive = true,
    order = 0,
  } = req.body;

  // Validation
  if (!headerCategorySlug || !heading || !saleText || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: "Header category slug, heading, sale text, start date, and end date are required",
    });
  }

  // Validate header category exists (allow "all" as a special case)
  if (headerCategorySlug.toLowerCase() !== "all") {
    const headerCategory = await HeaderCategory.findOne({ slug: headerCategorySlug });
    if (!headerCategory) {
      return res.status(404).json({
        success: false,
        message: `Header category with slug "${headerCategorySlug}" not found`,
      });
    }
  }

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) {
    return res.status(400).json({
      success: false,
      message: "End date must be after start date",
    });
  }

  // Validate category cards
  if (categoryCards && Array.isArray(categoryCards)) {
    for (const card of categoryCards) {
      if (!card.categoryId) {
        return res.status(400).json({
          success: false,
          message: "Category ID is required for each category card",
        });
      }
      const category = await Category.findById(card.categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: `Category with ID "${card.categoryId}" not found`,
        });
      }
    }
  }

  // Validate featured products
  if (featuredProducts && Array.isArray(featuredProducts)) {
    for (const productId of featuredProducts) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product with ID "${productId}" not found`,
        });
      }
    }
  }

  const promoStrip = await PromoStrip.create({
    headerCategorySlug: headerCategorySlug.toLowerCase(),
    heading,
    saleText,
    startDate: start,
    endDate: end,
    categoryCards: categoryCards || [],
    featuredProducts: featuredProducts || [],
    isActive,
    order,
  });

  const populated = await PromoStrip.findById(promoStrip._id)
    .populate("categoryCards.categoryId", "name slug image")
    .populate("featuredProducts", "productName mainImage price mrp");

  // Invalidate cache for this header category slug
  cache.delete(`promoStrip-${headerCategorySlug.toLowerCase()}`);

  return res.status(201).json({
    success: true,
    message: "PromoStrip created successfully",
    data: populated,
  });
});

/**
 * Get all PromoStrips
 */
export const getAllPromoStrips = asyncHandler(async (req: Request, res: Response) => {
  const { headerCategorySlug, isActive, sortBy = "order", sortOrder = "asc" } = req.query;

  let query: any = {};

  if (headerCategorySlug) {
    query.headerCategorySlug = (headerCategorySlug as string).toLowerCase();
  }

  if (isActive !== undefined) {
    query.isActive = isActive === "true";
  }

  const sort: any = {};
  if (sortBy === "order") {
    sort.order = sortOrder === "desc" ? -1 : 1;
    sort.createdAt = -1;
  } else {
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;
  }

  const promoStrips = await PromoStrip.find(query)
    .populate("categoryCards.categoryId", "name slug image")
    .populate("featuredProducts", "productName mainImage price mrp")
    .sort(sort);

  return res.status(200).json({
    success: true,
    message: "PromoStrips fetched successfully",
    data: promoStrips,
  });
});

/**
 * Get PromoStrip by ID
 */
export const getPromoStripById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const promoStrip = await PromoStrip.findById(id)
    .populate("categoryCards.categoryId", "name slug image")
    .populate("featuredProducts", "productName mainImage price mrp");

  if (!promoStrip) {
    return res.status(404).json({
      success: false,
      message: "PromoStrip not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "PromoStrip fetched successfully",
    data: promoStrip,
  });
});

/**
 * Update PromoStrip
 */
export const updatePromoStrip = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    headerCategorySlug,
    heading,
    saleText,
    startDate,
    endDate,
    categoryCards,
    featuredProducts,
    isActive,
    order,
  } = req.body;

  const promoStrip = await PromoStrip.findById(id);
  if (!promoStrip) {
    return res.status(404).json({
      success: false,
      message: "PromoStrip not found",
    });
  }

  // Validate header category if provided (allow "all" as a special case)
  if (headerCategorySlug) {
    if (headerCategorySlug.toLowerCase() !== "all") {
      const headerCategory = await HeaderCategory.findOne({ slug: headerCategorySlug });
      if (!headerCategory) {
        return res.status(404).json({
          success: false,
          message: `Header category with slug "${headerCategorySlug}" not found`,
        });
      }
    }
    promoStrip.headerCategorySlug = headerCategorySlug.toLowerCase();
  }

  // Validate dates if provided
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : promoStrip.startDate;
    const end = endDate ? new Date(endDate) : promoStrip.endDate;
    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }
    if (startDate) promoStrip.startDate = start;
    if (endDate) promoStrip.endDate = end;
  }

  // Validate category cards if provided
  if (categoryCards && Array.isArray(categoryCards)) {
    for (const card of categoryCards) {
      if (card.categoryId) {
        const category = await Category.findById(card.categoryId);
        if (!category) {
          return res.status(404).json({
            success: false,
            message: `Category with ID "${card.categoryId}" not found`,
          });
        }
      }
    }
    promoStrip.categoryCards = categoryCards;
  }

  // Validate featured products if provided
  if (featuredProducts && Array.isArray(featuredProducts)) {
    for (const productId of featuredProducts) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product with ID "${productId}" not found`,
        });
      }
    }
    promoStrip.featuredProducts = featuredProducts;
  }

  if (heading !== undefined) promoStrip.heading = heading;
  if (saleText !== undefined) promoStrip.saleText = saleText;
  if (isActive !== undefined) promoStrip.isActive = isActive;
  if (order !== undefined) promoStrip.order = order;

  await promoStrip.save();

  const populated = await PromoStrip.findById(promoStrip._id)
    .populate("categoryCards.categoryId", "name slug image")
    .populate("featuredProducts", "productName mainImage price mrp");

  // Invalidate cache for this header category slug
  cache.delete(`promoStrip-${promoStrip.headerCategorySlug.toLowerCase()}`);

  return res.status(200).json({
    success: true,
    message: "PromoStrip updated successfully",
    data: populated,
  });
});

/**
 * Delete PromoStrip
 */
export const deletePromoStrip = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const promoStrip = await PromoStrip.findByIdAndDelete(id);
  if (!promoStrip) {
    return res.status(404).json({
      success: false,
      message: "PromoStrip not found",
    });
  }

  // Invalidate cache for this header category slug
  cache.delete(`promoStrip-${promoStrip.headerCategorySlug.toLowerCase()}`);

  return res.status(200).json({
    success: true,
    message: "PromoStrip deleted successfully",
  });
});

