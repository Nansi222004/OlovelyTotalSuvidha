import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Brand from "../../../models/Brand";
import Product from "../../../models/Product";
import Inventory from "../../../models/Inventory";
import Seller from "../../../models/Seller";
import HeaderCategory from "../../../models/HeaderCategory";
import { cache } from "../../../utils/cache";
import AppSettings from "../../../models/AppSettings";
import { validateBarcodeUniqueness } from "../../../utils/barcodeHelper";
import {
  validateAndNormalizeCommerceChannels,
  isProductTypeAllowedForCategory,
  validateProductChannelCompatibility,
  checkWholesaleEligibility,
  validateWholesalePrice,
} from "../../../utils/categoryChannelHelper";
import { getCanonicalAdminSeller, resolveInventoryOwner } from "../../../utils/inventoryHelper";
import { getCommerceChannels } from "../../../services/commerceChannelService";


// ==================== Category Controllers ====================

/**
 * Create a new category
 */
export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      image,
      order,
      isBestseller,
      hasWarning,
      groupCategory,
      parentId,
      headerCategoryId,
      status = "Active",
      commerceChannels,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    let finalCommerceChannels: ("QUICK_COMMERCE" | "ECOMMERCE")[] = [
      "QUICK_COMMERCE",
      "ECOMMERCE",
    ];
    if (commerceChannels !== undefined) {
      const channelValidation = validateAndNormalizeCommerceChannels(commerceChannels);
      if (!channelValidation.valid) {
        return res.status(400).json({
          success: false,
          message: channelValidation.error,
        });
      }
      finalCommerceChannels = channelValidation.normalized!;
    }

    let finalHeaderCategoryId = headerCategoryId;

    // Validate parent if provided
    if (parentId) {
      // Cannot set parent to self
      if (parentId === req.body._id) {
        return res.status(400).json({
          success: false,
          message: "Cannot set category as its own parent",
        });
      }

      const parent = await Category.findById(parentId);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }

      if (parent.status !== "Active") {
        return res.status(400).json({
          success: false,
          message: "Parent category must be active",
        });
      }

      // Inherit headerCategoryId from parent if not explicitly provided
      if (!finalHeaderCategoryId && parent.headerCategoryId) {
        finalHeaderCategoryId = parent.headerCategoryId.toString();
      }

      // If parent doesn't have headerCategoryId, subcategory cannot be created
      if (!finalHeaderCategoryId) {
        return res.status(400).json({
          success: false,
          message:
            "Parent category does not have a header category assigned. Please assign a header category to the parent category first.",
        });
      }
    }

    // Validate headerCategoryId (required for root categories)
    if (!finalHeaderCategoryId && !parentId) {
      return res.status(400).json({
        success: false,
        message: "Header category is required for root categories",
      });
    }

    // Validate headerCategory exists and is Published
    if (finalHeaderCategoryId) {
      const headerCategory = await HeaderCategory.findById(
        finalHeaderCategoryId
      );
      if (!headerCategory) {
        return res.status(400).json({
          success: false,
          message: "Header category not found",
        });
      }

      if (headerCategory.status !== "Published") {
        return res.status(400).json({
          success: false,
          message: "Header category must be Published",
        });
      }
    }

    // Auto-calculate order if not provided
    let finalOrder = order;
    if (finalOrder === undefined || finalOrder === null) {
      const lastCategory = await Category.findOne({
        parentId: parentId || null,
      })
        .sort({ order: -1 })
        .limit(1);
      finalOrder = lastCategory ? (lastCategory.order || 0) + 1 : 0;
    }

    const category = await Category.create({
      name,
      image,
      order: finalOrder,
      isBestseller: isBestseller || false,
      hasWarning: hasWarning || false,
      groupCategory,
      parentId: parentId || null,
      headerCategoryId: finalHeaderCategoryId || null,
      commissionRate: req.body.commissionRate || 0,
      status,
      commerceChannels: finalCommerceChannels,
    });

    // Invalidate category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-list-v2");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-categor/);
    cache.invalidatePattern(/^categories/);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  }
);

/**
 * Get all categories
 */
export const getCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      search,
      sortBy = "order",
      sortOrder = "asc",
      parentId,
      includeChildren = "false",
      status,
      headerCategoryId,
      channel,
    } = req.query;

    const query: any = {};
    if (search) {
      query.name = { $regex: search as string, $options: "i" };
    }
    if (parentId !== undefined) {
      if (parentId === "null" || parentId === null || parentId === "") {
        query.parentId = null;
      } else {
        query.parentId = parentId;
      }
    }
    if (status) {
      query.status = status;
    }
    if (headerCategoryId) {
      query.headerCategoryId = headerCategoryId;
    }
    if (channel && (channel === "QUICK_COMMERCE" || channel === "ECOMMERCE")) {
      query.commerceChannels = { $in: [channel] };
    }

    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    const categories = await Category.find(query)
      .populate("parentId", "name")
      .populate("headerCategoryId", "name status")
      .sort(sort);

    // Count child categories for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const childrenCount = await Category.countDocuments({
          parentId: category._id,
        });
        // Also count old SubCategory model for backward compatibility
        const subcategoryCount = await SubCategory.countDocuments({
          category: category._id,
        });
        return {
          ...category.toObject(),
          childrenCount,
          totalSubcategories: childrenCount + subcategoryCount,
        };
      })
    );

    // If includeChildren is true, build hierarchical structure
    if (includeChildren === "true") {
      const buildTree = (parentId: any = null): any[] => {
        return categoriesWithCounts
          .filter((cat) => {
            const catParentId = cat.parentId
              ? cat.parentId._id || cat.parentId
              : null;
            const parentIdStr = parentId ? parentId.toString() : null;
            const catParentIdStr = catParentId ? catParentId.toString() : null;
            return catParentIdStr === parentIdStr;
          })
          .map((cat) => ({
            ...cat,
            children: buildTree(cat._id),
          }));
      };

      const tree = buildTree();
      return res.status(200).json({
        success: true,
        message: "Categories fetched successfully",
        data: tree,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categoriesWithCounts,
    });
  }
);

/**
 * Update category
 */
export const updateCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.commerceChannels !== undefined) {
      const channelValidation = validateAndNormalizeCommerceChannels(updateData.commerceChannels);
      if (!channelValidation.valid) {
        return res.status(400).json({
          success: false,
          message: channelValidation.error,
        });
      }
      updateData.commerceChannels = channelValidation.normalized!;
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Category Update Safety Check:
    // If commerceChannels is being changed, verify existing products in this category
    if (updateData.commerceChannels !== undefined) {
      const targetChannels = updateData.commerceChannels;
      const existingProducts = await Product.find({
        $or: [{ category: id }, { categoryId: id }],
      })
        .select("_id productName name productType")
        .lean();

      let legacyCount = 0;
      const incompatibleProducts: any[] = [];

      for (const p of existingProducts) {
        if (!p.productType) {
          legacyCount++;
          continue; // Ignore legacy products with null/missing productType for compatibility purposes
        }

        const allowedCheck = isProductTypeAllowedForCategory(
          targetChannels,
          p.productType as any
        );
        if (!allowedCheck.allowed) {
          incompatibleProducts.push({
            id: p._id,
            name: (p as any).productName || (p as any).name,
            productType: p.productType,
          });
        }
      }

      if (incompatibleProducts.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot update category commerce channels. ${incompatibleProducts.length} existing product(s) would become incompatible with the requested channels.`,
          categoryId: id,
          requestedChannels: targetChannels,
          currentChannels: category.commerceChannels,
          incompatibleProductCount: incompatibleProducts.length,
          legacyProductCount: legacyCount,
          affectedProductsSample: incompatibleProducts.slice(0, 5),
        });
      }
    }

    // Validate parent change if parentId is being updated
    if (updateData.parentId !== undefined) {
      const validation = await Category.validateParentChange(
        id,
        updateData.parentId
      );
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }

      // If parent is being set, inherit headerCategoryId from parent if not explicitly provided
      if (updateData.parentId && !updateData.headerCategoryId) {
        const parent = await Category.findById(updateData.parentId);
        if (parent && parent.headerCategoryId) {
          updateData.headerCategoryId = parent.headerCategoryId;
        }
      }
    }

    // Validate headerCategoryId if being updated
    if (updateData.headerCategoryId !== undefined) {
      // If category has children, they should inherit the same header category
      // But we allow the change - children will keep their current headerCategoryId
      // unless explicitly updated

      // Validate headerCategory exists and is Published
      if (updateData.headerCategoryId) {
        const headerCategory = await HeaderCategory.findById(
          updateData.headerCategoryId
        );
        if (!headerCategory) {
          return res.status(400).json({
            success: false,
            message: "Header category not found",
          });
        }

        if (headerCategory.status !== "Published") {
          return res.status(400).json({
            success: false,
            message: "Header category must be Published",
          });
        }
      } else {
        // If headerCategoryId is being set to null/empty, check if category has children
        const childrenCount = await Category.countDocuments({ parentId: id });
        if (childrenCount > 0) {
          return res.status(400).json({
            success: false,
            message:
              "Cannot remove header category from a category that has subcategories",
          });
        }
      }
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("parentId", "name")
      .populate("headerCategoryId", "name status");

    // Invalidate all category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-list-v2");
    cache.delete("customer-categories-tree");
    cache.delete("customer-categories-list-v2-QUICK_COMMERCE");
    cache.delete("customer-categories-list-v2-ECOMMERCE");
    cache.delete("customer-categories-tree-QUICK_COMMERCE");
    cache.delete("customer-categories-tree-ECOMMERCE");
    cache.delete(`customer-category-${id}`);
    cache.invalidatePattern(/^customer-categor/);
    cache.invalidatePattern(/^categories/);

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  }
);

/**
 * Delete category
 */
export const deleteCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Check if category has child categories (using parentId)
    const childrenCount = await Category.countDocuments({ parentId: id });
    if (childrenCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with subcategories. Please delete or move subcategories first.",
      });
    }

    // Check if category has old-style subcategories (backward compatibility)
    const subcategoryCount = await SubCategory.countDocuments({ category: id });
    if (subcategoryCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with subcategories. Please delete or move subcategories first.",
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with products",
      });
    }

    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Invalidate category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  }
);

/**
 * Update category order
 */
export const updateCategoryOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { categories } = req.body; // Array of { id, order }

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: "Categories array is required",
      });
    }

    const updatePromises = categories.map(
      ({ id, order }: { id: string; order: number }) =>
        Category.findByIdAndUpdate(
          id,
          { order, updatedAt: new Date() },
          { new: true }
        )
    );

    await Promise.all(updatePromises);

    return res.status(200).json({
      success: true,
      message: "Category order updated successfully",
    });
  }
);

/**
 * Toggle category status
 */
export const toggleCategoryStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, cascadeToChildren } = req.body;

    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Active or Inactive",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Update category status
    category.status = status;
    await category.save();

    // Optionally cascade to children
    if (cascadeToChildren === true) {
      await Category.updateMany(
        { parentId: id },
        { status, updatedAt: new Date() }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Category status updated to ${status}`,
      data: category,
    });
  }
);

/**
 * Bulk delete categories
 */
export const bulkDeleteCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Category IDs array is required",
      });
    }

    const results = {
      deleted: [] as string[],
      failed: [] as Array<{ id: string; reason: string }>,
    };

    for (const categoryId of categoryIds) {
      try {
        // Check for child categories
        const childrenCount = await Category.countDocuments({
          parentId: categoryId,
        });
        if (childrenCount > 0) {
          results.failed.push({
            id: categoryId,
            reason: "Category has child categories",
          });
          continue;
        }

        // Check for old-style subcategories
        const subcategoryCount = await SubCategory.countDocuments({
          category: categoryId,
        });
        if (subcategoryCount > 0) {
          results.failed.push({
            id: categoryId,
            reason: "Category has subcategories",
          });
          continue;
        }

        // Check for products
        const productCount = await Product.countDocuments({
          category: categoryId,
        });
        if (productCount > 0) {
          results.failed.push({
            id: categoryId,
            reason: "Category has associated products",
          });
          continue;
        }

        // Delete category
        const category = await Category.findByIdAndDelete(categoryId);
        if (category) {
          results.deleted.push(categoryId);
        } else {
          results.failed.push({
            id: categoryId,
            reason: "Category not found",
          });
        }
      } catch (error: any) {
        results.failed.push({
          id: categoryId,
          reason: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk delete completed: ${results.deleted.length} deleted, ${results.failed.length} failed`,
      data: results,
    });
  }
);

// ==================== SubCategory Controllers ====================

/**
 * Create a new subcategory
 */
export const createSubCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, category, image, order } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: "Subcategory name and category are required",
      });
    }

    const subcategory = await SubCategory.create({
      name,
      category,
      image,
      order: order || 0,
      commissionRate: req.body.commissionRate || 0,
    });

    // Update category subcategory count
    await Category.findByIdAndUpdate(category, {
      $inc: { totalSubcategories: 1 },
    });

    return res.status(201).json({
      success: true,
      message: "Subcategory created successfully",
      data: subcategory,
    });
  }
);

/**
 * Get all subcategories
 */
export const getSubCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { category, search, sortBy = "order", sortOrder = "asc" } = req.query;

    const query: any = {};
    if (category) {
      query.category = category;
    }
    if (search) {
      query.name = { $regex: search as string, $options: "i" };
    }

    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    const subcategories = await SubCategory.find(query)
      .populate("category", "name")
      .sort(sort);

    // Get product counts for each subcategory
    const subcategoriesWithCounts = await Promise.all(
      subcategories.map(async (subcategory) => {
        const productCount = await Product.countDocuments({
          subcategory: subcategory._id,
        });

        return {
          ...subcategory.toObject(),
          totalProduct: productCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Subcategories fetched successfully",
      data: subcategoriesWithCounts,
    });
  }
);

/**
 * Update subcategory
 */
export const updateSubCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const subcategory = await SubCategory.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("category", "name");

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subcategory updated successfully",
      data: subcategory,
    });
  }
);

/**
 * Delete subcategory
 */
export const deleteSubCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Check if subcategory has products
    const productCount = await Product.countDocuments({ subcategory: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete subcategory with products",
      });
    }

    const subcategory = await SubCategory.findByIdAndDelete(id);

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    // Update category subcategory count
    await Category.findByIdAndUpdate(subcategory.category, {
      $inc: { totalSubcategories: -1 },
    });

    return res.status(200).json({
      success: true,
      message: "Subcategory deleted successfully",
    });
  }
);

// ==================== Brand Controllers ====================

/**
 * Create a new brand
 */
export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const { name, image } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Brand name is required",
    });
  }

  const brand = await Brand.create({ name, image });

  return res.status(201).json({
    success: true,
    message: "Brand created successfully",
    data: brand,
  });
});

/**
 * Get all brands
 */
export const getBrands = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query;

  const query: any = {};
  if (search) {
    query.name = { $regex: search as string, $options: "i" };
  }

  const brands = await Brand.find(query).sort({ name: 1 });

  return res.status(200).json({
    success: true,
    message: "Brands fetched successfully",
    data: brands,
  });
});

/**
 * Update brand
 */
export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const brand = await Brand.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!brand) {
    return res.status(404).json({
      success: false,
      message: "Brand not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Brand updated successfully",
    data: brand,
  });
});

/**
 * Delete brand
 */
export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if brand has products
  const productCount = await Product.countDocuments({ brand: id });
  if (productCount > 0) {
    return res.status(400).json({
      success: false,
      message: "Cannot delete brand with products",
    });
  }

  const brand = await Brand.findByIdAndDelete(id);

  if (!brand) {
    return res.status(404).json({
      success: false,
      message: "Brand not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Brand deleted successfully",
  });
});

// ==================== Product Controllers ====================

/**
 * Create a new product
 */
export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const productData = req.body;

      // If seller is not provided, assign canonical Admin Seller and mark as PLATFORM
      const rawSeller = productData.seller || productData.sellerId;
      if (!rawSeller || rawSeller === "admin") {
        try {
          const adminSeller = await getCanonicalAdminSeller();
          productData.seller = adminSeller._id;
          productData.ownerType = 'PLATFORM';
        } catch (sellerError: any) {
          console.error("Error handling default admin seller:", sellerError);
          throw new Error(
            "Failed to assign default seller: " + sellerError.message
          );
        }
      } else {
        // Seller was explicitly provided by Admin: inspect whether assigned to platform or vendor
        const assignedSeller = await Seller.findById(rawSeller);
        if (!assignedSeller) {
          return res.status(404).json({
            success: false,
            message: "Assigned seller not found",
          });
        }
        const resolved = resolveInventoryOwner(assignedSeller);
        productData.seller = assignedSeller._id;
        productData.ownerType = resolved.ownerType;
      }
      delete productData.sellerId;

      if (
        !productData.productName ||
        !productData.category ||
        !productData.price
      ) {
        return res.status(400).json({
          success: false,
          message: "Product name, category, and price are required",
        });
      }

      // Verify seller exists (if passed explicitly or set above)
      const seller = await Seller.findById(productData.seller);
      if (!seller) {
        return res.status(404).json({
          success: false,
          message: "Seller not found",
        });
      }

      // Verify category exists and channel compatibility
      const category = await Category.findById(productData.category);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }

      const targetProductType = productData.productType || "QUICK_COMMERCE";
      const channelCompat = validateProductChannelCompatibility({
        sellerVendorType: seller.vendorType,
        productType: targetProductType,
        categoryChannels: category.commerceChannels,
        categoryName: category.name,
        channelAvailability: await getCommerceChannels(),
      });

      if (!channelCompat.valid) {
        return res.status(400).json({
          success: false,
          message: channelCompat.error,
        });
      }
      productData.productType = targetProductType;

      // ── BARCODE NORMALIZATION & INTRA-PAYLOAD VALIDATION ──────────────────────
      const payloadBarcodes: { barcode: string; scopeLabel: string }[] = [];
      if (productData.barcode !== undefined && productData.barcode !== null) {
        productData.barcode = String(productData.barcode).trim();
        if (productData.barcode) {
          payloadBarcodes.push({ barcode: productData.barcode, scopeLabel: "top-level barcode" });
        } else {
          delete productData.barcode;
        }
      }

      if (productData.variations && Array.isArray(productData.variations)) {
        for (const [idx, v] of productData.variations.entries()) {
          if (v.barcode !== undefined && v.barcode !== null) {
            v.barcode = String(v.barcode).trim();
            if (v.barcode) {
              payloadBarcodes.push({ barcode: v.barcode, scopeLabel: `variation[${idx}] barcode` });
            } else {
              delete v.barcode;
            }
          }
        }
      }

      // Check for duplicates within the same payload (top-level vs variation, variation vs variation)
      const seenBarcodes = new Map<string, string>();
      for (const { barcode, scopeLabel } of payloadBarcodes) {
        if (seenBarcodes.has(barcode)) {
          const priorScope = seenBarcodes.get(barcode);
          return res.status(409).json({
            success: false,
            message: `Duplicate barcode "${barcode}" found within the same product payload (${priorScope} and ${scopeLabel}). Barcodes must be unique.`,
            field: scopeLabel,
          });
        }
        seenBarcodes.set(barcode, scopeLabel);
      }

      // Cross-product DB uniqueness checks (product-level and variation-level across all products)
      for (const { barcode, scopeLabel } of payloadBarcodes) {
        const barcodeCheck = await validateBarcodeUniqueness({ barcode, targetProductId: undefined });
        if (!barcodeCheck.valid) {
          return res.status(409).json({
            success: false,
            message: `Barcode "${barcode}" (${scopeLabel}) is already assigned to another product. Barcodes must be globally unique.`,
            field: scopeLabel,
            error: barcodeCheck.error,
          });
        }
      }

      // ── WHOLESALE SERVER-SIDE VALIDATION ────────────────────────────────────
      if (productData.wholesaleEnabled) {
        const appSettings = await AppSettings.findOne();
        const globalWholesaleEnabled = appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;

        const wholesaleCheck = checkWholesaleEligibility({
          globalWholesaleEnabled,
          sellerWholesaleEnabled: !!seller.wholesaleEnabled,
          categoryWholesaleEnabled: !!category.wholesaleEnabled,
          productWholesaleEnabled: true,
        });

        if (!wholesaleCheck.eligible) {
          return res.status(400).json({
            success: false,
            message: wholesaleCheck.reason || "Product is not eligible for wholesale",
          });
        }

        const retailPrice = Number(productData.price) || Number(productData.variations?.[0]?.price) || 0;
        const wholesalePrice = Number(productData.wholesalePrice);
        const priceValidation = validateWholesalePrice(wholesalePrice, retailPrice);
        if (!priceValidation.valid) {
          return res.status(400).json({
            success: false,
            message: priceValidation.error,
          });
        }

        const moq = Number(productData.wholesaleMinimumQuantity);
        if (isNaN(moq) || moq < 1 || !Number.isInteger(moq)) {
          return res.status(400).json({
            success: false,
            message: "Wholesale minimum quantity must be a valid integer >= 1",
          });
        }
      }

      const product = await Product.create(productData);

      // Create inventory record
      try {
        await Inventory.create({
          product: product._id,
          seller: productData.seller,
          currentStock: Number(productData.stock) || 0,
          availableStock: Number(productData.stock) || 0,
        });
      } catch (invError) {
        // If inventory creation fails, delete the product to maintain consistency
        await Product.findByIdAndDelete(product._id);
        throw new Error(
          "Failed to create inventory: " + (invError as Error).message
        );
      }

      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error: any) {
      // Handle Mongoose validation errors
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map(
          (val: any) => val.message
        );
        return res.status(400).json({
          success: false,
          message: messages.join(", "),
        });
      }
      // Handle CastError (invalid ObjectId, etc)
      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: `Invalid value for ${error.path}: ${error.value}`,
        });
      }

      // Re-throw other errors to be handled by global error handler (will result in 500)
      // But we can return 400 if we suspect bad data
      return res.status(500).json({
        success: false,
        message: "Error creating product: " + error.message,
      });
    }
  }
);

/**
 * Get all products
 * Returns all products regardless of status (no approval workflow)
 * Use status query param to filter by specific status if needed
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search,
    category,
    subcategory,
    brand,
    seller,
    status,
    publish,
  } = req.query;

  const query: any = {};

  if (search) {
    query.$or = [
      { productName: { $regex: search as string, $options: "i" } },
      { sku: { $regex: search as string, $options: "i" } },
    ];
  }
  if (category) query.category = category;
  if (subcategory) query.subcategory = subcategory;
  if (brand) query.brand = brand;
  if (seller) query.seller = seller;

  // Only filter by status if explicitly provided
  // All products show by default (no approval workflow)
  if (status) {
    query.status = status;
  }

  if (publish !== undefined) query.publish = publish === "true";

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("category", "name")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate("seller", "sellerName storeName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string)),
    Product.countDocuments(query),
  ]);

  return res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: products,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

/**
 * Get product by ID
 */
export const getProductById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate("category", "name headerCategoryId")
      .populate("subcategory", "name subcategoryName")
      .populate("subSubCategory", "name")
      .populate("headerCategoryId", "name slug")
      .populate("brand", "name")
      .populate("tax", "name percentage")
      .populate("seller", "sellerName storeName")
      .populate("shopId", "name storeId image")
      .populate("approvedBy", "firstName lastName");

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
    const { id } = req.params;
    const updateData = req.body;

    // Map frontend field names to model field names and sanitize empty strings to null
    if (updateData.headerCategoryId !== undefined) {
      updateData.headerCategoryId = updateData.headerCategoryId || null;
    }
    if (updateData.categoryId !== undefined) {
      updateData.category = updateData.categoryId || null;
      delete updateData.categoryId;
    }
    if (updateData.category !== undefined) {
      updateData.category = updateData.category || null;
    }
    if (updateData.subcategoryId !== undefined) {
      updateData.subcategory = updateData.subcategoryId || null;
      delete updateData.subcategoryId;
    }
    if (updateData.subcategory !== undefined) {
      updateData.subcategory = updateData.subcategory || null;
    }
    if (updateData.subSubCategoryId !== undefined) {
      updateData.subSubCategory = updateData.subSubCategoryId || null;
      delete updateData.subSubCategoryId;
    }
    if (updateData.subSubCategory !== undefined) {
      updateData.subSubCategory = updateData.subSubCategory || null;
    }
    if (updateData.brandId !== undefined) {
      updateData.brand = updateData.brandId || null;
      delete updateData.brandId;
    }
    if (updateData.brand !== undefined) {
      updateData.brand = updateData.brand || null;
    }
    if (updateData.taxId !== undefined) {
      updateData.tax = updateData.taxId || null;
      delete updateData.taxId;
    }
    if (updateData.tax !== undefined) {
      updateData.tax = updateData.tax || null;
    }
    if (updateData.mainImageUrl !== undefined) {
      updateData.mainImage = updateData.mainImageUrl;
      delete updateData.mainImageUrl;
    }
    if (updateData.galleryImageUrls !== undefined) {
      updateData.galleryImages = updateData.galleryImageUrls;
      delete updateData.galleryImageUrls;
    }

    // Process variations
    if (updateData.variations) {
      if (updateData.variations.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Product must have at least one variation",
        });
      }

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
            message: `Discounted price (${variation.discPrice}) cannot be greater than price (${variation.price}) for variation ${
              variation.title || variation.value
            }`,
          });
        }
      }

      updateData.price = updateData.variations[0].price;
      updateData.discPrice = updateData.variations[0].discPrice || 0;
      updateData.stock = updateData.variations.reduce(
        (acc: number, curr: any) => acc + (parseInt(curr.stock) || 0),
        0
      );
    }

    // Handle Shop by Store fields
    if (updateData.isShopByStoreOnly !== undefined) {
      updateData.isShopByStoreOnly =
        updateData.isShopByStoreOnly === true ||
        updateData.isShopByStoreOnly === "true";
    }
    if (updateData.shopId !== undefined) {
      updateData.shopId = updateData.shopId || null;
    } else if (updateData.isShopByStoreOnly === false) {
      updateData.shopId = null;
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Category Commerce Channel Validation on update
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

      const isChannelChanging = updateData.productType !== undefined && updateData.productType !== product.productType;
      const seller = await Seller.findById(product.seller).select("vendorType");
      const channelCompat = validateProductChannelCompatibility({
        sellerVendorType: seller?.vendorType,
        productType: effectiveProductType,
        categoryChannels: categoryObj.commerceChannels,
        categoryName: categoryObj.name,
        channelAvailability: await getCommerceChannels(),
        isExistingProductMaintenance: !isChannelChanging,
      });

      if (!channelCompat.valid) {
        return res.status(400).json({
          success: false,
          message: channelCompat.error,
        });
      }
    }

    // ── LEGACY PRODUCT TYPE PRESERVATION ──────────────────────────────────
    // Do not mutate legacy products' unset productType unless explicitly provided
    if (product.productType === undefined && updateData.productType === undefined) {
      delete updateData.productType;
    }

    // ── BARCODE NORMALIZATION & COLLISION VALIDATION ON UPDATE ──────────────
    const updatePayloadBarcodes: { barcode: string; scopeLabel: string }[] = [];
    if (updateData.barcode !== undefined && updateData.barcode !== null) {
      updateData.barcode = String(updateData.barcode).trim();
      if (updateData.barcode) {
        updatePayloadBarcodes.push({ barcode: updateData.barcode, scopeLabel: "top-level barcode" });
      } else {
        updateData.barcode = null;
      }
    }

    if (updateData.variations && Array.isArray(updateData.variations)) {
      for (const [idx, v] of updateData.variations.entries()) {
        if (v.barcode !== undefined && v.barcode !== null) {
          v.barcode = String(v.barcode).trim();
          if (v.barcode) {
            updatePayloadBarcodes.push({ barcode: v.barcode, scopeLabel: `variation[${idx}] barcode` });
          } else {
            delete v.barcode;
          }
        }
      }
    }

    // 1. Check intra-payload duplicates
    const updateSeenBarcodes = new Map<string, string>();
    for (const { barcode, scopeLabel } of updatePayloadBarcodes) {
      if (updateSeenBarcodes.has(barcode)) {
        const priorScope = updateSeenBarcodes.get(barcode);
        return res.status(409).json({
          success: false,
          message: `Duplicate barcode "${barcode}" found within the same product payload (${priorScope} and ${scopeLabel}).`,
          field: scopeLabel,
        });
      }
      updateSeenBarcodes.set(barcode, scopeLabel);
    }

    // 2. Intra-product cross-scope check with existing variations/top-level if not replaced in payload
    if (updateData.barcode && !updateData.variations && product.variations?.length) {
      const collisionVar = product.variations.find((v: any) => v.barcode && v.barcode === updateData.barcode);
      if (collisionVar) {
        return res.status(409).json({
          success: false,
          message: `Top-level barcode "${updateData.barcode}" collides with existing variation "${(collisionVar as any).title || collisionVar.name || collisionVar.value}" on the same product.`,
          field: "barcode",
        });
      }
    }
    if (updateData.variations && !updateData.barcode && product.barcode) {
      const collisionVar = updateData.variations.find((v: any) => v.barcode && v.barcode === product.barcode);
      if (collisionVar) {
        return res.status(409).json({
          success: false,
          message: `Variation barcode "${collisionVar.barcode}" collides with top-level barcode on the same product.`,
          field: "variations",
        });
      }
    }

    // 3. Cross-product DB uniqueness checks (product-level and variation-level)
    for (const { barcode, scopeLabel } of updatePayloadBarcodes) {
      const barcodeCheck = await validateBarcodeUniqueness({
        barcode,
        targetProductId: product._id.toString(),
      });
      if (!barcodeCheck.valid) {
        return res.status(409).json({
          success: false,
          message: `Barcode "${barcode}" (${scopeLabel}) is already assigned to another product.`,
          field: scopeLabel,
          error: barcodeCheck.error,
        });
      }
    }

    // ── WHOLESALE SERVER-SIDE VALIDATION ON UPDATE ──────────────────────────
    const effectiveWholesaleEnabled = updateData.wholesaleEnabled !== undefined ? updateData.wholesaleEnabled : product.wholesaleEnabled;
    if (effectiveWholesaleEnabled) {
      const appSettings = await AppSettings.findOne();
      const globalWholesaleEnabled = appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;

      const sellerDoc = await Seller.findById(product.seller).select("wholesaleEnabled");
      const categoryDoc = await Category.findById(effectiveCategoryId).select("wholesaleEnabled");

      const wholesaleCheck = checkWholesaleEligibility({
        globalWholesaleEnabled,
        sellerWholesaleEnabled: !!sellerDoc?.wholesaleEnabled,
        categoryWholesaleEnabled: !!categoryDoc?.wholesaleEnabled,
        productWholesaleEnabled: true,
      });

      if (!wholesaleCheck.eligible) {
        return res.status(400).json({
          success: false,
          message: wholesaleCheck.reason || "Product is not eligible for wholesale",
        });
      }

      const effectiveWholesalePrice = updateData.wholesalePrice !== undefined
        ? Number(updateData.wholesalePrice)
        : Number(product.wholesalePrice);
      const effectiveRetailPrice = updateData.price !== undefined
        ? Number(updateData.price)
        : (updateData.variations?.[0]?.price !== undefined
          ? Number(updateData.variations[0].price)
          : (Number(product.price) || Number(product.variations?.[0]?.price) || 0));

      const priceValidation = validateWholesalePrice(effectiveWholesalePrice, effectiveRetailPrice);
      if (!priceValidation.valid) {
        return res.status(400).json({
          success: false,
          message: priceValidation.error,
        });
      }

      const effectiveMoq = updateData.wholesaleMinimumQuantity !== undefined
        ? Number(updateData.wholesaleMinimumQuantity)
        : Number(product.wholesaleMinimumQuantity);
      if (isNaN(effectiveMoq) || effectiveMoq < 1 || !Number.isInteger(effectiveMoq)) {
        return res.status(400).json({
          success: false,
          message: "Wholesale minimum quantity must be a valid integer >= 1",
        });
      }
    }

    // Handle seller / ownership update or preservation
    if (updateData.sellerId !== undefined || updateData.seller !== undefined) {
      const rawSeller = updateData.sellerId || updateData.seller;
      if (!rawSeller || rawSeller === "admin") {
        const adminSeller = await getCanonicalAdminSeller();
        product.seller = adminSeller._id as any;
        product.ownerType = 'PLATFORM';
      } else {
        const assignedSeller = await Seller.findById(rawSeller);
        if (!assignedSeller) {
          return res.status(404).json({
            success: false,
            message: "Assigned seller not found",
          });
        }
        const resolved = resolveInventoryOwner(assignedSeller);
        product.seller = assignedSeller._id as any;
        product.ownerType = resolved.ownerType;
      }
      delete updateData.sellerId;
      delete updateData.seller;
    }
    delete updateData.ownerType;

    Object.assign(product, updateData);

    if (updateData.variations) {
      product.markModified("variations");
    }

    await product.save();

    // Update inventory if stock changed
    if (product.stock !== undefined) {
      await Inventory.findOneAndUpdate(
        { product: id },
        {
          seller: product.seller,
          currentStock: product.stock,
          availableStock: product.stock,
        },
        { upsert: true }
      );
    }

    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name headerCategoryId")
      .populate("subcategory", "name subcategoryName")
      .populate("subSubCategory", "name")
      .populate("headerCategoryId", "name slug")
      .populate("brand", "name")
      .populate("tax", "name percentage")
      .populate("seller", "sellerName storeName")
      .populate("shopId", "name storeId image");

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
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete inventory record
    await Inventory.findOneAndDelete({ product: id });

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  }
);

/**
 * Approve/reject product request
 */
export const approveProductRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["Active", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Active or Rejected",
      });
    }

    const updateData: any = {
      status,
      approvedBy: (req as any).user?.userId,
      approvedAt: new Date(),
    };

    if (status === "Rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("category", "name")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate("seller", "sellerName storeName");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Product ${status === "Active" ? "approved" : "rejected"
        } successfully`,
      data: product,
    });
  }
);

/**
 * Bulk import products
 */
export const bulkImportProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { products } = req.body; // Array of product objects

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Products array is required",
      });
    }

    const validationErrors: Array<{ index: number; error: string }> = [];
    const validatedItems: Array<{ productData: any; seller: any; category: any }> = [];

    // Phase 1: Validate entire batch first
    for (let i = 0; i < products.length; i++) {
      const productData = products[i];

      if (
        !productData.productName ||
        !productData.category ||
        !productData.seller ||
        !productData.price
      ) {
        validationErrors.push({
          index: i,
          error: "Missing required fields (productName, category, seller, price)",
        });
        continue;
      }

      const seller = await Seller.findById(productData.seller);
      if (!seller) {
        validationErrors.push({
          index: i,
          error: "Seller not found",
        });
        continue;
      }

      const category = await Category.findById(productData.category);
      if (!category) {
        validationErrors.push({
          index: i,
          error: "Category not found",
        });
        continue;
      }

      const targetProductType = productData.productType || "QUICK_COMMERCE";
      const channelCompat = validateProductChannelCompatibility({
        sellerVendorType: seller.vendorType,
        productType: targetProductType,
        categoryChannels: category.commerceChannels,
        categoryName: category.name,
        channelAvailability: await getCommerceChannels(),
      });

      if (!channelCompat.valid) {
        validationErrors.push({
          index: i,
          error: channelCompat.error || "Channel compatibility validation failed",
        });
        continue;
      }

      productData.productType = targetProductType;
      validatedItems.push({ productData, seller, category });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bulk import validation failed: ${validationErrors.length} product(s) invalid. No products were imported.`,
        errors: validationErrors,
      });
    }

    // Phase 2: All items valid, write batch to database
    const createdProducts = [];
    for (const item of validatedItems) {
      const productData = item.productData;
      productData.status = "Active";
      productData.publish = true;
      productData.requiresApproval = false;

      const product = await Product.create(productData);
      await Inventory.create({
        product: product._id,
        seller: productData.seller,
        currentStock: productData.stock || 0,
        availableStock: productData.stock || 0,
      });
      createdProducts.push(product);
    }

    return res.status(201).json({
      success: true,
      message: `Bulk import completed: ${createdProducts.length} products imported successfully`,
      data: {
        success: createdProducts.length,
        failed: 0,
        errors: [],
      },
    });
  }
);

/**
 * Bulk update products
 */
export const bulkUpdateProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { productIds, updateData } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs array is required",
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Update data is required",
      });
    }

    // If updateData changes category or productType, validate channel compatibility for every affected product first
    if (updateData.category !== undefined || updateData.productType !== undefined) {
      const affectedProducts = await Product.find({ _id: { $in: productIds } });
      for (const p of affectedProducts) {
        const effectiveCatId = updateData.category || p.category;
        const effectiveType = updateData.productType || p.productType;

        if (effectiveCatId && effectiveType) {
          const categoryObj = await Category.findById(effectiveCatId);
          if (!categoryObj) {
            return res.status(400).json({
              success: false,
              message: `Invalid category ID for product ${p._id}`,
            });
          }
          const isChannelChanging = updateData.productType !== undefined && updateData.productType !== p.productType;
          const seller = await Seller.findById(p.seller).select("vendorType");
          const compat = validateProductChannelCompatibility({
            sellerVendorType: seller?.vendorType,
            productType: effectiveType,
            categoryChannels: categoryObj.commerceChannels,
            categoryName: categoryObj.name,
            channelAvailability: await getCommerceChannels(),
            isExistingProductMaintenance: !isChannelChanging,
          });
          if (!compat.valid) {
            return res.status(400).json({
              success: false,
              message: `Bulk update rejected: Product "${(p as any).productName || (p as any).name}" (${p._id}) would become incompatible. ${compat.error}`,
            });
          }
        }
      }
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: updateData }
    );

    // Update inventory if stock is being updated
    if (updateData.stock !== undefined) {
      await Inventory.updateMany(
        { product: { $in: productIds } },
        {
          currentStock: updateData.stock,
          availableStock: updateData.stock,
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} products updated successfully`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  }
);

/**
 * Update product display order (for featured lists etc)
 */
export const updateProductOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { products } = req.body; // Array of { id, order }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Products array is required",
      });
    }

    const updates = products.map(({ id, order }) =>
      Product.findByIdAndUpdate(id, { order })
    );

    await Promise.all(updates);

    return res.status(200).json({
      success: true,
      message: "Product order updated successfully",
    });
  }
);
