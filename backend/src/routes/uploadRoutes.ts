import { Router, Request, Response } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadDocument,
  uploadMultipleDocuments,
  handleUploadError,
} from "../middleware/upload";
import {
  uploadImageFromBuffer,
  uploadDocumentFromBuffer,
  deleteImage,
} from "../services/localStorageService";
import { CLOUDINARY_FOLDERS } from "../config/cloudinary";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// All upload routes require authentication
// All upload routes require authentication - REMOVED to allow public document upload for registration
// router.use(authenticate);

/**
 * POST /api/v1/upload/image
 * Upload a single image
 */
router.post(
  "/image",
  authenticate,
  requireUserType("Admin", "Seller"),
  uploadSingleImage.single("image"),
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const folder = (req.body.folder as string) || CLOUDINARY_FOLDERS.PRODUCTS;
    const result = await uploadImageFromBuffer((req as any).file.buffer, {
      folder,
      resourceType: "image",
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/upload/images
 * Upload multiple images
 */
router.post(
  "/images",
  authenticate, // Added manual auth check
  requireUserType("Admin", "Seller"),
  uploadMultipleImages.array("images", 10), // Max 10 images
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).files || ((req as any).files as any[]).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No image files provided",
      });
    }

    const folder = (req.body.folder as string) || CLOUDINARY_FOLDERS.PRODUCTS;
    const files = (req as any).files as any[];

    const uploadPromises = files.map((file) =>
      uploadImageFromBuffer(file.buffer, {
        folder,
        resourceType: "image",
      })
    );

    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      data: results,
    });
  })
);

/**
 * POST /api/v1/upload/document
 * Upload a document (image or PDF)
 */
router.post(
  "/document",
  // authenticate, // Removed to allow unauthenticated uploads for registration
  uploadDocument.single("document"),
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).file) {
      return res.status(400).json({
        success: false,
        message: "No document file provided",
      });
    }

    // Determine folder based on user type or request body
    let folder: string = CLOUDINARY_FOLDERS.SELLER_DOCUMENTS;
    const user = (req as any).user;

    if (user) {
      if (user.userType === "Delivery") {
        folder = CLOUDINARY_FOLDERS.DELIVERY_DOCUMENTS;
      } else if (user.userType === "Seller") {
        folder = CLOUDINARY_FOLDERS.SELLER_DOCUMENTS;
      }
    } else {
      // Allow valid folders from body if not authenticated (for registration)
      const bodyFolder = req.body.folder;
      if (
        bodyFolder &&
        Object.values(CLOUDINARY_FOLDERS).includes(bodyFolder)
      ) {
        folder = bodyFolder;
      }
    }

    // Check if it's an image or PDF
    const isImage = (req as any).file.mimetype.startsWith("image/");
    const resourceType = isImage ? "image" : "raw";

    const result = await uploadDocumentFromBuffer((req as any).file.buffer, {
      folder,
      resourceType,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/upload/documents
 * Upload multiple documents
 */
router.post(
  "/documents",
  // authenticate, // Removed
  uploadMultipleDocuments.array("documents", 5), // Max 5 documents
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).files || ((req as any).files as any[]).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No document files provided",
      });
    }

    // Determine folder based on user type or request body
    let folder: string = CLOUDINARY_FOLDERS.SELLER_DOCUMENTS;
    const user = (req as any).user;

    if (user) {
      if (user.userType === "Delivery") {
        folder = CLOUDINARY_FOLDERS.DELIVERY_DOCUMENTS;
      } else if (user.userType === "Seller") {
        folder = CLOUDINARY_FOLDERS.SELLER_DOCUMENTS;
      }
    } else {
      // Allow valid folders from body if not authenticated (for registration)
      const bodyFolder = req.body.folder;
      if (
        bodyFolder &&
        Object.values(CLOUDINARY_FOLDERS).includes(bodyFolder)
      ) {
        folder = bodyFolder;
      }
    }

    const files = (req as any).files as any[];

    const uploadPromises = files.map((file) => {
      const isImage = file.mimetype.startsWith("image/");
      const resourceType = isImage ? "image" : "raw";
      return uploadDocumentFromBuffer(file.buffer, {
        folder,
        resourceType,
      });
    });

    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      data: results,
    });
  })
);

/**
 * DELETE /api/v1/upload/:publicId
 * Delete an image from Cloudinary
 */
router.delete(
  "/:publicId",
  authenticate, // Manually added auth
  requireUserType("Admin", "Seller"),
  asyncHandler(async (req: Request, res: Response) => {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
    }

    await deleteImage(publicId);

    return res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  })
);

export default router;
