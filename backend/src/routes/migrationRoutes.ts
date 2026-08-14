import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { runMigration } from "../scripts/migrateCloudinaryToLocal";

const router = Router();

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
 * GET /api/v1/admin/fix-image-domain
 * Update image URLs in DB to target domain (default: https://api.dhakadsnazzy.com)
 */
router.get(
  "/fix-image-domain",
  asyncHandler(async (req: Request, res: Response) => {
    const domain = (req.query.domain as string) || "https://api.dhakadsnazzy.com";
    const result = await updateImageUrlsDomain(domain);
    return res.status(200).json({
      success: true,
      message: `Image URLs domain updated to ${domain}`,
      data: result,
    });
  })
);

export default router;
