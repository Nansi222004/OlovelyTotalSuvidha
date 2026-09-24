import { Request, Response } from "express";
import Product from "../../../models/Product";
import Seller from "../../../models/Seller";
import HeaderCategory from "../../../models/HeaderCategory";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Shop from "../../../models/Shop";
import { asyncHandler } from "../../../utils/asyncHandler";
import { resolveAuthorizedSellerChannel } from "../../../utils/sellerChannelHelper";
import {
  isProductTypeAllowedForCategory,
  validateProductChannelCompatibility,
  checkWholesaleEligibility,
  validateWholesalePrice,
} from "../../../utils/categoryChannelHelper";
import { validateBarcodeUniqueness } from "../../../utils/barcodeHelper";
import AppSettings from "../../../models/AppSettings";
import { mutateStock } from "../../../services/inventoryService";
import { parseSafeBoolean } from "./sellerAuthController";

/**
 * Validate that the seller is allowed to add products in the given header category.
 * Returns null if valid, or an error message string if invalid.
 */
async function validateSellerHeaderCategory(
  sellerId: string,
  headerCategoryId: string | undefined
): Promise<string | null> {
  if (!headerCategoryId) return null; // No header category provided, skip validation

  const seller = await Seller.findById(sellerId).select("categories");
  if (!seller) return "Seller not found";

  // If seller has no categories set (empty array), allow all (backward compatibility)
  if (!seller.categories || seller.categories.length === 0) return null;

  const headerCategory = await HeaderCategory.findById(headerCategoryId);
  if (!headerCategory) return "Header category not found";

  // Check if the header category name is in the seller's allowed categories list
  if (!seller.categories.includes(headerCategory.name)) {
    return `You are not authorized to add products in the "${headerCategory.name}" category. Your allowed categories are: ${seller.categories.join(", ")}`;
  }

  return null; // Valid
}

/**
 * Create a new product
 */
export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const productData = req.body;

    // Ensure sellerId matches authenticated seller
    if (productData.sellerId && productData.sellerId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: "You can only create products for your own account",
      });
    }

    // Validate seller is allowed to add products in the selected header category
    const categoryError = await validateSellerHeaderCategory(
      sellerId,
      productData.headerCategoryId
    );
    if (categoryError) {
      return res.status(403).json({
        success: false,
        message: categoryError,
      });
    }

    // Enforce Seller Channel & Product Type compatibility (Backend Enforcement)
    const seller = await Seller.findById(sellerId).select("categories vendorType");
    const sellerVendorType = seller?.vendorType || "QUICK_COMMERCE";
    let targetProductType = productData.productType;

    if (!targetProductType) {
      targetProductType = sellerVendorType === "ECOMMERCE" ? "ECOMMERCE" : "QUICK_COMMERCE";
    }

    // Validate Category & Subcategory hierarchy
    const targetCategoryId = productData.categoryId || productData.category;
    const targetSubcategoryId = productData.subcategoryId || productData.subcategory;

    if (targetCategoryId) {
      const categoryObj = await Category.findById(targetCategoryId);
      if (!categoryObj) {
        return res.status(400).json({
          success: false,
          message: "Invalid product category ID provided",
        });
      }

      // Enforce Unified Channel Compatibility Check
      const channelCheck = validateProductChannelCompatibility({
        sellerVendorType,
        productType: targetProductType,
        categoryChannels: categoryObj.commerceChannels,
        categoryName: categoryObj.name,
      });
      if (!channelCheck.valid) {
        return res.status(400).json({
          success: false,
          message: channelCheck.error,
        });
      }

      if (targetSubcategoryId) {
        const childInCat = await Category.findOne({ _id: targetSubcategoryId, parentId: targetCategoryId });
        const childInSub = await SubCategory.findOne({ _id: targetSubcategoryId, category: targetCategoryId });
        if (!childInCat && !childInSub) {
          return res.status(400).json({
            success: false,
            message: `Selected subcategory does not belong to category "${categoryObj.name}"`,
          });
        }
      }
    }

    // 2. Map fields to match Product model
    const newProductData: any = {
      ...productData,
      seller: sellerId, // Map sellerId to seller
      headerCategoryId: productData.headerCategoryId, // Map headerCategoryId
      category: productData.categoryId, // Map categoryId to category
      subcategory: productData.subcategoryId,
      brand: productData.brandId,
      mainImage: productData.mainImageUrl, // Map mainImageUrl to mainImage
      galleryImages: productData.galleryImageUrls,
      productType: targetProductType,
      productSource: productData.productSource || "LOCAL_VENDOR",
    };

    // Package details mapping and validation for Ecommerce
    if (targetProductType === "ECOMMERCE") {
      const rawWeight = productData.packageDetails?.weightKg ?? productData.weightKg;
      if (rawWeight === undefined || rawWeight === null || rawWeight === "") {
        return res.status(400).json({
          success: false,
          message: "Package weight (weightKg) is required for ECOMMERCE products",
        });
      }
      const parsedWeight = Number(rawWeight);
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        return res.status(400).json({
          success: false,
          message: "Package weight (weightKg) must be a positive number greater than 0",
        });
      }

      const rawDimensions = productData.packageDetails?.dimensionsCm || productData.dimensionsCm;
      let dimensionsCm: { length?: number; width?: number; height?: number } | undefined = undefined;

      const rawLen = rawDimensions?.length ?? productData.length;
      const rawWid = rawDimensions?.width ?? productData.width;
      const rawHgt = rawDimensions?.height ?? productData.height;

      if (rawLen !== undefined || rawWid !== undefined || rawHgt !== undefined) {
        const pLen = Number(rawLen);
        const pWid = Number(rawWid);
        const pHgt = Number(rawHgt);

        if (isNaN(pLen) || pLen <= 0 || isNaN(pWid) || pWid <= 0 || isNaN(pHgt) || pHgt <= 0) {
          return res.status(400).json({
            success: false,
            message: "Package dimensions (length, width, height) must all be positive numbers greater than 0",
          });
        }
        dimensionsCm = { length: pLen, width: pWid, height: pHgt };
      }

      newProductData.packageDetails = {
        weightKg: parsedWeight,
        ...(dimensionsCm && { dimensionsCm }),
        shippingClass: productData.packageDetails?.shippingClass || productData.shippingClass,
      };
    } else if (productData.packageDetails || productData.weightKg || productData.dimensionsCm) {
      newProductData.packageDetails = {
        weightKg: Number(productData.packageDetails?.weightKg ?? productData.weightKg) || undefined,
        dimensionsCm: {
          length: Number(productData.packageDetails?.dimensionsCm?.length ?? productData.dimensionsCm?.length ?? productData.length) || undefined,
          width: Number(productData.packageDetails?.dimensionsCm?.width ?? productData.dimensionsCm?.width ?? productData.width) || undefined,
          height: Number(productData.packageDetails?.dimensionsCm?.height ?? productData.dimensionsCm?.height ?? productData.height) || undefined,
        },
        shippingClass: productData.packageDetails?.shippingClass || productData.shippingClass,
      };
    }

    // Map variations: Ensure 'title' from frontend is mapped to 'value' (or name) expected by Schema
    if (newProductData.variations) {
      newProductData.variations = newProductData.variations.map((v: any) => ({
        ...v,
        value: v.value || v.title, // Map title to value
        name: v.name || "Variation", // Default name
        discPrice: v.discPrice || 0,
        status: v.status || "Available",
      }));
    }

    // 3. Set Price and Stock from Variations
    // The Product model requires a top-level price and stock
    if (newProductData.variations && newProductData.variations.length > 0) {
      // Use the price of the first variation as the base price
      newProductData.price = newProductData.variations[0].price;
      newProductData.discPrice = newProductData.variations[0].discPrice || 0;

      // Calculate total stock (sum of all variations)
      // Note: If any variation has stock 0 (unlimited), how should we handle top level?
      // For now, let's sum them up. If purely unlimited, logic might differ.
      newProductData.stock = newProductData.variations.reduce(
        (acc: number, curr: any) => acc + (parseInt(curr.stock) || 0),
        0
      );
    }

    // 4. Validate Price (Model requirement)
    if (newProductData.price === undefined || newProductData.price === null) {
      return res.status(400).json({
        success: false,
        message: "Product price is required (add at least one variation)",
      });
    }

    // 5. Clean up undefined fields
    if (!newProductData.headerCategoryId)
      delete newProductData.headerCategoryId;
    if (!newProductData.subcategory) delete newProductData.subcategory;
    if (!newProductData.brand) delete newProductData.brand;

    // Handle Tax: Frontend sends taxId, Model expects 'tax' (string) or something else?
    // Checking SellerAddProduct.tsx sending taxId -> formData.tax
    // Model Product.ts -> tax: { type: String }
    // Ideally we should store the Tax ID or Name. Since frontend sends ID, let's map it.
    if (productData.taxId) {
      newProductData.tax = productData.taxId;
    }

    // Validate variation prices if provided
    if (Array.isArray(productData.variations)) {
      for (const variation of productData.variations) {
        if (Number(variation.discPrice) > Number(variation.price)) {
          return res.status(400).json({
            success: false,
            message: `Discounted price (${variation.discPrice}) cannot be greater than price (${variation.price}) for variation ${variation.title || variation.name}`,
          });
        }
      }
    }

    // 6. Set product status - All products are published automatically without approval
    newProductData.publish = true;
    newProductData.status = "Active";
    newProductData.requiresApproval = false;

    // Set default values for other required fields if not provided
    // Handle Returnability
    if (productData.isReturnable !== undefined) {
      newProductData.isReturnable = productData.isReturnable === true || productData.isReturnable === "true";
    } else {
      newProductData.isReturnable = true; // Default to returnable unless specified false
    }
    if (productData.maxReturnDays !== undefined) {
      newProductData.maxReturnDays = Number(productData.maxReturnDays) || 0;
    }

    if (!newProductData.popular) newProductData.popular = false;
    if (!newProductData.dealOfDay) newProductData.dealOfDay = false;
    if (!newProductData.rating) newProductData.rating = 0;
    if (!newProductData.reviewsCount) newProductData.reviewsCount = 0;
    if (!newProductData.discount) newProductData.discount = 0;
    if (!newProductData.tags) newProductData.tags = [];

    // Handle Shop by Store fields
    if (productData.isShopByStoreOnly !== undefined) {
      newProductData.isShopByStoreOnly = productData.isShopByStoreOnly === true || productData.isShopByStoreOnly === "true";
    }
    if (productData.shopId) {
      newProductData.shopId = productData.shopId;
    } else if (newProductData.isShopByStoreOnly) {
      // If shop by store only is true but no shopId provided, set to null
      newProductData.shopId = null;
    }

    // ── WHOLESALE FIELD VALIDATION ───────────────────────────────────────────
    newProductData.wholesaleEnabled = parseSafeBoolean(newProductData.wholesaleEnabled, false);
    if (newProductData.wholesaleEnabled) {
      // Seller must have wholesale enabled on their account
      const sellerDoc = await Seller.findById(sellerId).select('wholesaleEnabled').lean();
      if (!sellerDoc?.wholesaleEnabled) {
        return res.status(403).json({
          success: false,
          message: 'Your seller account does not have wholesale capability enabled. Contact admin.',
        });
      }

      // Check global wholesale setting
      const appSettings = await AppSettings.findOne();
      const globalWholesaleEnabled = appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;

      // Category wholesale gate
      const targetCatDoc = targetCategoryId ? await Category.findById(targetCategoryId).select('wholesaleEnabled').lean() : null;

      const eligibility = checkWholesaleEligibility({
        globalWholesaleEnabled,
        sellerWholesaleEnabled: !!sellerDoc.wholesaleEnabled,
        categoryWholesaleEnabled: !!targetCatDoc?.wholesaleEnabled,
        productWholesaleEnabled: true,
      });
      if (!eligibility.eligible) {
        return res.status(400).json({ success: false, message: eligibility.reason });
      }

      // Validate wholesale price
      const wp = Number(newProductData.wholesalePrice);
      if (!wp || isNaN(wp) || wp <= 0) {
        return res.status(400).json({ success: false, message: 'Wholesale price must be greater than 0' });
      }
      const retailPrice = newProductData.price || newProductData.variations?.[0]?.price || 0;
      const priceCheck = validateWholesalePrice(wp, retailPrice);
      if (!priceCheck.valid) {
        return res.status(400).json({ success: false, message: priceCheck.error });
      }
      newProductData.wholesalePrice = wp;

      // Validate MOQ
      const moq = newProductData.wholesaleMinimumQuantity !== undefined
        ? Number(newProductData.wholesaleMinimumQuantity)
        : 1;
      if (isNaN(moq) || moq < 1) {
        return res.status(400).json({ success: false, message: 'Wholesale minimum quantity must be at least 1' });
      }
      newProductData.wholesaleMinimumQuantity = moq;
    }
    // ──────────────────────────────────────────────────────────────────────

    // ── BARCODE UNIQUENESS VALIDATION ───────────────────────────────────────
    const barcodesInPayload: { barcode: string; scopeLabel: string }[] = [];
    if (newProductData.barcode) {
      barcodesInPayload.push({ barcode: newProductData.barcode, scopeLabel: 'top-level barcode' });
    }
    if (newProductData.variations && Array.isArray(newProductData.variations)) {
      for (const [idx, v] of newProductData.variations.entries()) {
        if (v.barcode) {
          barcodesInPayload.push({ barcode: v.barcode, scopeLabel: `variation[${idx}] barcode` });
        }
      }
    }
    for (const { barcode, scopeLabel } of barcodesInPayload) {
      const barcodeCheck = await validateBarcodeUniqueness({ barcode, targetProductId: undefined });
      if (!barcodeCheck.valid) {
        return res.status(409).json({
          success: false,
          message: `Barcode "${barcode}" (${scopeLabel}) is already assigned to another product. Barcodes must be globally unique.`,
          field: scopeLabel,
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    const product = await Product.create(newProductData);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  }
);

/**
 * Get seller's products with filters
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const {
    search,
    category,
    status,
    stock,
    channel,
    page = "1",
    limit = "10",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Validate channel against seller vendorType
  const requestedChannel = (channel as string) || (req.headers["x-channel"] as string) || (req.headers["x-seller-channel"] as string);
  const resolution = await resolveAuthorizedSellerChannel(sellerId, requestedChannel);
  if (resolution.error) {
    return res.status(resolution.statusCode || 400).json({
      success: false,
      message: resolution.error,
    });
  }

  const { activeChannel } = resolution.data!;

  // Build query
  const query: any = { seller: sellerId };

  if (activeChannel) {
    query.productType = { $in: [activeChannel, "BOTH"] };
  }

  // Search filter
  if (search) {
    query.$or = [
      { productName: { $regex: search, $options: "i" } },
      { smallDescription: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search as string, "i")] } },
    ];
  }

  // Category filter
  if (category) {
    query.category = category;
  }

  // Status filter (publish, popular, dealOfDay)
  if (status) {
    if (status === "published") {
      query.publish = true;
    } else if (status === "unpublished") {
      query.publish = false;
    } else if (status === "popular") {
      query.popular = true;
    } else if (status === "dealOfDay") {
      query.dealOfDay = true;
    }
  }

  // Stock filter
  if (stock === "inStock") {
    query.stock = { $gt: 0 };
  } else if (stock === "outOfStock") {
    // Check for products where total stock is 0
    // This implies all variations are out of stock
    query.stock = 0;
  }

  // Pagination
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sort: any = {};
  sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

  const products = await Product.find(query)
    .populate("category", "name")
    .populate("subcategory", "name")
    .populate("brand", "name")
    .populate("tax", "name rate")
    .sort(sort)
    .skip(skip)
    .limit(limitNum);

  const total = await Product.countDocuments(query);

  return res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * Get product by ID
 */
export const getProductById = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    // Prevent reserved route names from being treated as product IDs
    const reservedRoutes = ["shops", "brands"];
    if (reservedRoutes.includes(id)) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = await Product.findOne({ _id: id, seller: sellerId })
      .populate("category", "name")
      .populate("subcategory", "name subcategoryName")
      .populate("headerCategoryId", "name slug")
      .populate("brand", "name")
      .populate("tax", "name rate");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product,
    });
  }
);

/**
 * Update product
 */
export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const updateData = req.body;

    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG updateProduct: sellerId from token:", sellerId, "productId:", id);
    }

    // Remove sellerId from update data if present (cannot change owner)
    delete updateData.sellerId;

    // Validate seller is allowed to update products to the selected header category
    const headerCategoryIdToValidate = updateData.headerCategoryId;
    if (headerCategoryIdToValidate) {
      const categoryError = await validateSellerHeaderCategory(
        sellerId,
        headerCategoryIdToValidate
      );
      if (categoryError) {
        return res.status(403).json({
          success: false,
          message: categoryError,
        });
      }
    }

    // Map frontend field names to model field names (same as createProduct)
    if (updateData.headerCategoryId !== undefined) {
      // Allow null/empty to clear header category
      updateData.headerCategoryId = updateData.headerCategoryId || null;
    }
    if (updateData.categoryId) {
      updateData.category = updateData.categoryId;
      delete updateData.categoryId;
    }
    if (updateData.subcategoryId) {
      updateData.subcategory = updateData.subcategoryId;
      delete updateData.subcategoryId;
    }
    if (updateData.brandId) {
      updateData.brand = updateData.brandId;
      delete updateData.brandId;
    }
    if (updateData.taxId) {
      updateData.tax = updateData.taxId;
      delete updateData.taxId;
    }
    if (updateData.mainImageUrl) {
      updateData.mainImage = updateData.mainImageUrl;
      delete updateData.mainImageUrl;
    }
    if (updateData.galleryImageUrls) {
      updateData.galleryImages = updateData.galleryImageUrls;
      delete updateData.galleryImageUrls;
    }

    // Validate and enforce productType compatibility on update
    if (updateData.productType) {
      const seller = await Seller.findById(sellerId).select("vendorType");
      const sellerVendorType = seller?.vendorType || "QUICK_COMMERCE";
      if (sellerVendorType === "ECOMMERCE" && updateData.productType === "QUICK_COMMERCE") {
        return res.status(400).json({
          success: false,
          message: "ECOMMERCE-only seller cannot update product to QUICK_COMMERCE",
        });
      }
      if (sellerVendorType === "QUICK_COMMERCE" && updateData.productType === "ECOMMERCE") {
        return res.status(400).json({
          success: false,
          message: "QUICK_COMMERCE-only seller cannot update product to ECOMMERCE",
        });
      }
    }

    // Map and validate package details if provided
    if (updateData.packageDetails || updateData.weightKg !== undefined || updateData.dimensionsCm || updateData.length !== undefined) {
      const rawWeight = updateData.packageDetails?.weightKg ?? updateData.weightKg;
      let parsedWeight: number | undefined = undefined;
      if (rawWeight !== undefined && rawWeight !== null && rawWeight !== "") {
        parsedWeight = Number(rawWeight);
        if (isNaN(parsedWeight) || parsedWeight <= 0) {
          return res.status(400).json({
            success: false,
            message: "Package weight (weightKg) must be a positive number greater than 0",
          });
        }
      }

      const rawDimensions = updateData.packageDetails?.dimensionsCm || updateData.dimensionsCm;
      const rawLen = rawDimensions?.length ?? updateData.length;
      const rawWid = rawDimensions?.width ?? updateData.width;
      const rawHgt = rawDimensions?.height ?? updateData.height;

      let dimensionsCm: { length?: number; width?: number; height?: number } | undefined = undefined;
      if (rawLen !== undefined || rawWid !== undefined || rawHgt !== undefined) {
        const pLen = Number(rawLen);
        const pWid = Number(rawWid);
        const pHgt = Number(rawHgt);

        if (isNaN(pLen) || pLen <= 0 || isNaN(pWid) || pWid <= 0 || isNaN(pHgt) || pHgt <= 0) {
          return res.status(400).json({
            success: false,
            message: "Package dimensions (length, width, height) must all be positive numbers greater than 0",
          });
        }
        dimensionsCm = { length: pLen, width: pWid, height: pHgt };
      }

      updateData.packageDetails = {
        weightKg: parsedWeight,
        ...(dimensionsCm && { dimensionsCm }),
        shippingClass: updateData.packageDetails?.shippingClass || updateData.shippingClass,
      };
    }

    // Validate variations if provided
    if (updateData.variations) {
      if (updateData.variations.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Product must have at least one variation",
        });
      }

      // Map variations and validate prices
      updateData.variations = updateData.variations.map((v: any) => ({
        ...v,
        value: v.value || v.title,
        name: v.name || "Variation",
        discPrice: v.discPrice || 0,
        status: v.status || "Available",
      }));

      for (const variation of updateData.variations) {
        if (Number(variation.discPrice) > Number(variation.price)) {
          return res.status(400).json({
            success: false,
            message: `Discounted price cannot be greater than price for variation ${variation.title || variation.value
              }`,
          });
        }
      }

      // Sync top-level price and stock from variations (same as createProduct)
      updateData.price = updateData.variations[0].price;
      updateData.discPrice = updateData.variations[0].discPrice || 0;
      updateData.stock = updateData.variations.reduce(
        (acc: number, curr: any) => acc + (parseInt(curr.stock) || 0),
        0
      );
    }

    // Handle Shop by Store fields
    if (updateData.isShopByStoreOnly !== undefined) {
      updateData.isShopByStoreOnly = updateData.isShopByStoreOnly === true || updateData.isShopByStoreOnly === "true";
    }
    if (updateData.shopId !== undefined) {
      // Allow null to clear shopId
      updateData.shopId = updateData.shopId || null;
    } else if (updateData.isShopByStoreOnly === false) {
      // If shop by store only is false, clear shopId
      updateData.shopId = null;
    }

    // Use findOne and then save to trigger pre-save hooks
    const product = await Product.findOne({ _id: id, seller: sellerId });

    if (!product) {
      // Check if product exists at all
      const existingProduct = await Product.findById(id).select("seller");
      if (existingProduct) {
        console.log(
          "DEBUG updateProduct: product exists but owned by:",
          existingProduct.seller
        );
      }
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Enforce Category Commerce Channel Check on update
    const effectiveCategoryId = updateData.category || product.category;
    const effectiveProductType = updateData.productType || product.productType;

    if (effectiveCategoryId && effectiveProductType) {
      const categoryObj = await Category.findById(effectiveCategoryId);
      if (!categoryObj) {
        return res.status(400).json({
          success: false,
          message: "Invalid product category ID provided",
        });
      }

      const seller = await Seller.findById(sellerId).select("vendorType");
      const sellerVendorType = seller?.vendorType || "QUICK_COMMERCE";

      const channelCheck = validateProductChannelCompatibility({
        sellerVendorType,
        productType: effectiveProductType,
        categoryChannels: categoryObj.commerceChannels,
        categoryName: categoryObj.name,
      });
      if (!channelCheck.valid) {
        return res.status(400).json({
          success: false,
          message: channelCheck.error,
        });
      }

      const effectiveSubcategoryId =
        updateData.subcategory !== undefined
          ? updateData.subcategory
          : product.subcategory;
      if (effectiveSubcategoryId && updateData.category) {
        const childInCat = await Category.findOne({
          _id: effectiveSubcategoryId,
          parentId: effectiveCategoryId,
        });
        const childInSub = await SubCategory.findOne({
          _id: effectiveSubcategoryId,
          category: effectiveCategoryId,
        });
        if (!childInCat && !childInSub) {
          return res.status(400).json({
            success: false,
            message: `Selected subcategory does not belong to category "${categoryObj.name}"`,
          });
        }
      }
    }

    // Sanitize wholesaleEnabled if provided
    if (updateData.wholesaleEnabled !== undefined) {
      updateData.wholesaleEnabled = parseSafeBoolean(updateData.wholesaleEnabled, false);
    }

    // Apply updates
    Object.assign(product, updateData);

    // If variations were updated, mark as modified
    if (updateData.variations) {
      product.markModified("variations");
    }

    // == WHOLESALE FIELD VALIDATION ON UPDATE ==
    if ((product as any).wholesaleEnabled) {
      const sellerDoc = await Seller.findById(sellerId).select('wholesaleEnabled').lean();
      if (!sellerDoc?.wholesaleEnabled) {
        return res.status(403).json({
          success: false,
          message: 'Your seller account does not have wholesale capability enabled.',
        });
      }

      // Check global and category wholesale settings
      const appSettings = await AppSettings.findOne();
      const globalWholesaleEnabled = appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;
      const catId = product.category;
      const catDoc = catId ? await Category.findById(catId).select('wholesaleEnabled').lean() : null;

      const eligibility = checkWholesaleEligibility({
        globalWholesaleEnabled,
        sellerWholesaleEnabled: !!sellerDoc.wholesaleEnabled,
        categoryWholesaleEnabled: !!catDoc?.wholesaleEnabled,
        productWholesaleEnabled: true,
      });
      if (!eligibility.eligible) {
        return res.status(400).json({ success: false, message: eligibility.reason });
      }

      const wp = Number((product as any).wholesalePrice);
      if (!wp || isNaN(wp) || wp <= 0) {
        return res.status(400).json({ success: false, message: 'Wholesale price must be greater than 0' });
      }
      const retailPrice = (product as any).price || 0;
      const priceCheck = validateWholesalePrice(wp, retailPrice);
      if (!priceCheck.valid) {
        return res.status(400).json({ success: false, message: priceCheck.error });
      }

      if ((product as any).wholesaleMinimumQuantity !== undefined) {
        const moq = Number((product as any).wholesaleMinimumQuantity);
        if (isNaN(moq) || moq < 1) {
          return res.status(400).json({ success: false, message: 'Wholesale minimum quantity must be at least 1' });
        }
      }
    }

    // == BARCODE UNIQUENESS VALIDATION ON UPDATE ==
    const updateBarcodesInPayload: { barcode: string; scopeLabel: string }[] = [];

    if (updateData.barcode) {
      updateBarcodesInPayload.push({ barcode: updateData.barcode, scopeLabel: 'top-level barcode' });
    }
    if (updateData.variations && Array.isArray(updateData.variations)) {
      for (const [idx, v] of updateData.variations.entries()) {
        if (v.barcode) {
          updateBarcodesInPayload.push({ barcode: v.barcode, scopeLabel: `variation[${idx}] barcode` });
        }
      }
    }
    for (const { barcode, scopeLabel } of updateBarcodesInPayload) {
      const barcodeCheck = await validateBarcodeUniqueness({
        barcode,
        targetProductId: product._id.toString(),
      });
      if (!barcodeCheck.valid) {
        return res.status(409).json({
          success: false,
          message: `Barcode "${barcode}" (${scopeLabel}) is already assigned to another product.`,
          field: scopeLabel,
        });
      }
    }

    await product.save();

    // Re-populate for response
    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name")
      .populate("subcategory", "subcategoryName")
      .populate("headerCategoryId", "name slug")
      .populate("brand", "name")
      .populate("tax", "name rate");

    console.log("DEBUG updateProduct: product updated successfully");

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: populatedProduct,
    });
  }
);

/**
 * Delete product
 */
export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG deleteProduct: sellerId from token:", sellerId, "productId:", id);
    }

    const product = await Product.findOneAndDelete({
      _id: id,
      seller: sellerId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  }
);

/**
 * Update stock for a product variation
 */
export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const { id, variationId } = req.params;
  const { stock, status } = req.body;

  const product = await Product.findOne({ _id: id, seller: sellerId });

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const variation: any = product.variations?.find(
    (v: any) => v._id?.toString() === variationId
  );
  if (!variation) {
    return res.status(404).json({
      success: false,
      message: "Variation not found",
    });
  }

  if (stock !== undefined) {
    const targetStock = Number(stock);
    const currentStock = Number(variation.stock) || 0;
    const delta = targetStock - currentStock;

    if (delta !== 0) {
      await mutateStock({
        productId: id,
        variationId,
        quantity: delta,
        type: "ADJUSTMENT",
        referenceType: "ADJUSTMENT",
        performedBy: sellerId,
        performedByRole: "SELLER",
        note: "Seller variation stock update",
      });
    }

    // Automatically update status based on stock if needed
    const statusUpdate: any = {};
    if (targetStock === 0) {
      statusUpdate["variations.$.status"] = "Sold out";
    } else if (targetStock > 0 && variation.status === "Sold out") {
      statusUpdate["variations.$.status"] = "Available";
    }
    if (status) {
      statusUpdate["variations.$.status"] = status;
    }

    if (Object.keys(statusUpdate).length > 0) {
      await Product.updateOne(
        { _id: id, "variations._id": variationId },
        { $set: statusUpdate }
      );
    }
  } else if (status) {
    await Product.updateOne(
      { _id: id, "variations._id": variationId },
      { $set: { "variations.$.status": status } }
    );
  }

  const updatedProduct = await Product.findById(id);

  return res.status(200).json({
    success: true,
    message: "Stock updated successfully",
    data: updatedProduct,
  });
});

/**
 * Update product status (publish, popular, dealOfDay)
 */
export const updateProductStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const { publish, popular, dealOfDay } = req.body;

    const updateData: any = {};
    if (publish !== undefined) updateData.publish = publish;
    if (popular !== undefined) updateData.popular = popular;
    if (dealOfDay !== undefined) updateData.dealOfDay = dealOfDay;

    const product = await Product.findOneAndUpdate(
      { _id: id, seller: sellerId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      data: product,
    });
  }
);

/**
 * Bulk update stock for multiple products/variations
 */
export const bulkUpdateStock = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { updates } = req.body; // Array of { productId, variationId, stock }

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Updates must be an array",
      });
    }

    const results = [];
    for (const update of updates) {
      const { productId, variationId, stock } = update;

      const product = await Product.findOne({
        _id: productId,
        seller: sellerId,
      });
      if (product) {
        const variation: any = product.variations?.find(
          (v: any) => v._id?.toString() === variationId
        );
        if (variation) {
          const targetStock = Number(stock);
          const currentStock = Number(variation.stock) || 0;
          const delta = targetStock - currentStock;

          if (delta !== 0) {
            try {
              await mutateStock({
                productId,
                variationId,
                quantity: delta,
                type: "ADJUSTMENT",
                referenceType: "ADJUSTMENT",
                performedBy: sellerId,
                performedByRole: "SELLER",
                note: "Seller bulk variation stock update",
              });
              variation.stock = targetStock;
            } catch (err: any) {
              results.push({ productId, variationId, success: false, message: err.message });
              continue;
            }
          }

          if (targetStock === 0) {
            await Product.updateOne(
              { _id: productId, "variations._id": variationId },
              { $set: { "variations.$.status": "Sold out" } }
            );
          } else if (targetStock > 0 && variation.status === "Sold out") {
            await Product.updateOne(
              { _id: productId, "variations._id": variationId },
              { $set: { "variations.$.status": "In stock" } }
            );
          }

          results.push({ productId, variationId, success: true });
        } else {
          results.push({
            productId,
            variationId,
            success: false,
            message: "Variation not found",
          });
        }
      } else {
        results.push({
          productId,
          variationId,
          success: false,
          message: "Product not found",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk stock update processed",
      data: results,
    });
  }
);

/**
 * Get all active shops (for seller to select when creating shop-by-store-only products)
 */
export const getShops = asyncHandler(async (_req: Request, res: Response) => {
  const shops = await Shop.find({ isActive: true })
    .select("_id name storeId image")
    .sort({ order: 1, name: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    message: "Shops fetched successfully",
    data: shops || [],
  });
});

/**
 * Get header categories that the seller is allowed to sell in
 * (based on categories selected during registration)
 */
export const getAllowedHeaderCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;

    const seller = await Seller.findById(sellerId).select("categories");
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    // If seller has no categories set, return all published header categories (backward compat)
    let query: any = { status: "Published" };
    if (seller.categories && seller.categories.length > 0) {
      query.name = { $in: seller.categories };
    }

    const headerCategories = await HeaderCategory.find(query)
      .sort({ order: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Allowed header categories fetched successfully",
      data: headerCategories,
    });
  }
);
