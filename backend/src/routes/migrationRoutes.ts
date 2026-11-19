import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate, requireUserType } from "../middleware/auth";
import { runMigration } from "../scripts/migrateCloudinaryToLocal";

const router = Router();

// Explicit admin guard. These endpoints rewrite data across the whole database; they were only
// protected incidentally because adminRoutes (mounted first on "/admin") applies auth to every
// request passing through it. Re-ordering the mounts would have exposed them publicly.
router.use(authenticate, requireUserType("Admin"));

import { updateImageUrlsDomain } from "../scripts/fixImageDomain";

/**
 * GET /api/v1/admin/migrate-images
 * Trigger Cloudinary to Local Storage migration
 */
router.get(
  "/migrate-images",
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await runMigration();
    return res.status(200).json({
      success: true,
      message: "Image migration completed successfully",
      data: result,
    });
  })
);

/**
 * GET /api/v1/admin/fix-image-domain?domain=https://your-api-domain
 * Rewrites image URLs in the DB to the given domain. The domain is required: there is no default,
 * so the tool can never point images at a server you did not name explicitly.
 */
router.get(
  "/fix-image-domain",
  asyncHandler(async (req: Request, res: Response) => {
    const domain = String(req.query.domain || "").trim().replace(/\/+$/, "");
    if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(domain)) {
      return res.status(400).json({
        success: false,
        message: "Pass the target domain explicitly, e.g. ?domain=https://api.example.com",
      });
    }
    const result = await updateImageUrlsDomain(domain);
    return res.status(200).json({
      success: true,
      message: `Image URLs domain updated to ${domain}`,
      data: result,
    });
  })
);

export default router;
