import cloudinary, { CLOUDINARY_FOLDERS } from "../config/cloudinary";
import { UploadApiErrorResponse } from "cloudinary";

export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface UploadOptions {
  folder?: string;
  resourceType?: "image" | "raw" | "video" | "auto";
  transformation?: any[];
  overwrite?: boolean;
  invalidate?: boolean;
}

/**
 * Upload a single image to Cloudinary
 */
export async function uploadImage(
  filePath: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const uploadOptions = {
      folder: options.folder || CLOUDINARY_FOLDERS.PRODUCTS,
      resource_type: options.resourceType || "auto",
      transformation: options.transformation,
      overwrite: options.overwrite || false,
      invalidate: options.invalidate || true,
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    return {
      url: result.url,
      publicId: result.public_id,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    const uploadError = error as UploadApiErrorResponse;
    throw new Error(
      `Cloudinary upload failed: ${uploadError.message || "Unknown error"}`
    );
  }
}

/**
 * Upload multiple images to Cloudinary
 */
export async function uploadMultipleImages(
  filePaths: string[],
  options: UploadOptions = {}
): Promise<UploadResult[]> {
  try {
    const uploadPromises = filePaths.map((filePath) =>
      uploadImage(filePath, options)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    throw new Error(`Failed to upload multiple images: ${error}`);
  }
}

/**
 * Upload a document (PDF, image, etc.) to Cloudinary
 */
export async function uploadDocument(
  filePath: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const uploadOptions = {
      folder: options.folder || CLOUDINARY_FOLDERS.SELLER_DOCUMENTS,
      resource_type: options.resourceType || "auto",
      overwrite: options.overwrite || false,
      invalidate: options.invalidate || true,
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    return {
      url: result.url,
      publicId: result.public_id,
      secureUrl: result.secure_url,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    const uploadError = error as UploadApiErrorResponse;
    throw new Error(
      `Cloudinary document upload failed: ${uploadError.message || "Unknown error"
      }`
    );
  }
}

/**
 * Upload image from buffer (for multer)
 */
export async function uploadImageFromBuffer(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || CLOUDINARY_FOLDERS.PRODUCTS,
      resource_type: options.resourceType || "auto",
      transformation: options.transformation,
      overwrite: options.overwrite || false,
      invalidate: options.invalidate || true,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error: any, result: any) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (result) {
          resolve({
            url: result.url,
            publicId: result.public_id,
            secureUrl: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        } else {
          reject(new Error("Cloudinary upload returned no result"));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Upload document from buffer (for multer)
 */
export async function uploadDocumentFromBuffer(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || CLOUDINARY_FOLDERS.SELLER_DOCUMENTS,
      resource_type: options.resourceType || "auto",
      overwrite: options.overwrite || false,
      invalidate: options.invalidate || true,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error: any, result: any) => {
        if (error) {
          reject(
            new Error(`Cloudinary document upload failed: ${error.message}`)
          );
        } else if (result) {
          resolve({
            url: result.url,
            publicId: result.public_id,
            secureUrl: result.secure_url,
            format: result.format,
            bytes: result.bytes,
          });
        } else {
          reject(new Error("Cloudinary document upload returned no result"));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete an image from Cloudinary by public_id
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    const deleteError = error as UploadApiErrorResponse;
    throw new Error(
      `Failed to delete image: ${deleteError.message || "Unknown error"}`
    );
  }
}

/**
 * Delete multiple images from Cloudinary
 */
export async function deleteMultipleImages(publicIds: string[]): Promise<void> {
  try {
    await cloudinary.api.delete_resources(publicIds);
  } catch (error) {
    throw new Error(`Failed to delete multiple images: ${error}`);
  }
}
