/**
 * adminBannerController.ts
 *
 * Admin CRUD for dynamic home promotional banners.
 *
 * Banners are:
 * - Admin-managed (create, update, activate/deactivate, delete)
 * - Section-targeted: QUICK_COMMERCE | ECOMMERCE | WHOLESALE | ALL
 * - Priority-ordered: { priority: -1, createdAt: -1 }
 * - Schedulable: startDate / endDate filters on customer queries
 * - Fallback-enabled: if no active banners for a section, default fallback is returned
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import Banner from '../../../models/Banner';

// Default fallback banners per section (shown when no active banners exist)
const SECTION_FALLBACKS: Record<string, object> = {
  QUICK_COMMERCE: {
    _id: 'fallback-qc',
    title: 'Quick Commerce',
    subtitle: 'Everyday essentials delivered quickly',
    commerceSection: 'QUICK_COMMERCE',
    isFallback: true,
    ctaText: 'Shop Quick Commerce',
    targetType: 'NONE',
  },
  ECOMMERCE: {
    _id: 'fallback-ec',
    title: 'Ecommerce',
    subtitle: 'Shop electronics, fashion, lifestyle & more',
    commerceSection: 'ECOMMERCE',
    isFallback: true,
    ctaText: 'Explore Ecommerce',
    targetType: 'NONE',
  },
  WHOLESALE: {
    _id: 'fallback-ws',
    title: 'Wholesale',
    subtitle: 'Bulk shopping with special wholesale pricing',
    commerceSection: 'WHOLESALE',
    isFallback: true,
    ctaText: 'Shop Wholesale',
    targetType: 'NONE',
  },
  ALL: {
    _id: 'fallback-all',
    title: 'Welcome to Olovely Total Suvidha',
    subtitle: 'Your one-stop shop for groceries, electronics & more',
    commerceSection: 'ALL',
    isFallback: true,
    ctaText: 'Shop Now',
    targetType: 'NONE',
  },
};

// ---------------------------------------------------------------------------
// GET /admin/banners?section=...&page=1&limit=50
// ---------------------------------------------------------------------------
export const getBanners = asyncHandler(async (req: Request, res: Response) => {
  const { section, page = '1', limit = '50', isActive } = req.query as Record<string, string>;

  const query: Record<string, any> = {};
  if (section) query.commerceSection = section;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [banners, total] = await Promise.all([
    Banner.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Banner.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: banners,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
});

// ---------------------------------------------------------------------------
// POST /admin/banners
// ---------------------------------------------------------------------------
export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  const {
    title,
    subtitle,
    imageUrl,
    mobileImageUrl,
    commerceSection,
    targetType,
    targetId,
    ctaText,
    isActive,
    startDate,
    endDate,
    priority,
  } = req.body;

  if (!title) {
    res.status(400).json({ success: false, message: 'Banner title is required' });
  }

  const banner = await Banner.create({
    title,
    subtitle,
    imageUrl,
    mobileImageUrl,
    commerceSection: commerceSection || 'ALL',
    targetType: targetType || 'NONE',
    targetId,
    ctaText,
    isActive: isActive !== undefined ? isActive : true,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    priority: priority ?? 0,
  });

  res.status(201).json({ success: true, data: banner });
});

// ---------------------------------------------------------------------------
// PUT /admin/banners/:id
// ---------------------------------------------------------------------------
export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const banner = await Banner.findById(id);
  if (!banner) {
    res.status(404).json({ success: false, message: 'Banner not found' });
    return;
  }

  const allowedFields = [
    'title', 'subtitle', 'imageUrl', 'mobileImageUrl', 'commerceSection',
    'targetType', 'targetId', 'ctaText', 'isActive', 'startDate', 'endDate', 'priority',
  ];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      (banner as any)[field] = req.body[field];
    }
  }

  await banner.save();
  res.json({ success: true, data: banner });
});

// ---------------------------------------------------------------------------
// PATCH /admin/banners/:id/toggle
// Toggles isActive
// ---------------------------------------------------------------------------
export const toggleBanner = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const banner = await Banner.findById(id);
  if (!banner) {
    res.status(404).json({ success: false, message: 'Banner not found' });
    return;
  }

  banner.isActive = !banner.isActive;
  await banner.save();

  res.json({ success: true, data: banner, message: `Banner ${banner.isActive ? 'activated' : 'deactivated'}` });
});

// ---------------------------------------------------------------------------
// DELETE /admin/banners/:id
// ---------------------------------------------------------------------------
export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const banner = await Banner.findByIdAndDelete(id);
  if (!banner) {
    res.status(404).json({ success: false, message: 'Banner not found' });
    return;
  }

  res.json({ success: true, message: 'Banner deleted successfully' });
});

// ---------------------------------------------------------------------------
// GET /customer/banners?section=QUICK_COMMERCE
// Public endpoint — returns active banners for the requested section.
// Falls back to section default if no active banners exist.
// ---------------------------------------------------------------------------
export const getActiveBanners = asyncHandler(async (req: Request, res: Response) => {
  const { section = 'ALL' } = req.query as Record<string, string>;

  const now = new Date();
  const scheduleFilter = [
    { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
    { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
  ];

  // 1. Query for section-specific active banners first
  let activeBanners = await Banner.find({
    commerceSection: section,
    isActive: true,
    $and: scheduleFilter,
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  // 2. For non-WHOLESALE sections, if no section-specific banners found, check for 'ALL' banners
  if (activeBanners.length === 0 && section !== 'ALL' && section !== 'WHOLESALE') {
    activeBanners = await Banner.find({
      commerceSection: 'ALL',
      isActive: true,
      $and: scheduleFilter,
    })
      .sort({ priority: -1, createdAt: -1 })
      .lean();
  }

  // 3. If no active banners found, return the section-appropriate deterministic fallback
  if (activeBanners.length === 0) {
    const fallback = SECTION_FALLBACKS[section] || SECTION_FALLBACKS['ALL'];
    return res.json({ success: true, data: [fallback], isFallback: true });
  }

  return res.json({ success: true, data: activeBanners, isFallback: false });
});
