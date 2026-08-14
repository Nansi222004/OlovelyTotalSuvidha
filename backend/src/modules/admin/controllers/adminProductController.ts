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
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
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
    });

    // Invalidate category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);

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

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
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

    // Invalidate category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);

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

      // If seller is not provided, use/create default Admin Store
      if (!productData.seller) {
        try {
          // Check for existing admin seller by email OR mobile to avoid duplicate key errors
          let adminSeller = await Seller.findOne({
            $or: [
              { email: "admin-store@dhakadsnazzy.com" },
              { mobile: "9999999999" },
            ],
          });

          if (!adminSeller) {
            // Create default admin seller
            adminSeller = await Seller.create({
              sellerName: "Dhakad Snazzy Admin",
              storeName: "Dhakad Snazzy Admin Store",
              email: "admin-store@dhakadsnazzy.com",
              mobile: "9999999999",
              password: "AdminStore@123", // Should be hashed by pre-save hook
              address: "",
              city: "",
              category: "Admin",
              commission: 0,
              status: "Approved",
              requireProductApproval: false,
            });
          }
          productData.seller = adminSeller._id;
        } catch (sellerError: any) {
          console.error("Error handling default admin seller:", sellerError);
          throw new Error(
            "Failed to assign default seller: " + sellerError.message
          );
        }
      }

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

      // All products are published automatically without approval
      productData.status = "Active";
      productData.publish = true;
      productData.requiresApproval = false;

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
      .populate("category", "name")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate("seller", "sellerName storeName")
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

    // Update inventory if stock changed
    if (updateData.stock !== undefined) {
      await Inventory.findOneAndUpdate(
        { product: id },
        {
          currentStock: updateData.stock,
          availableStock: updateData.stock,
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
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
      approvedBy: req.user?.userId,
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

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (let i = 0; i < products.length; i++) {
      try {
        const productData = products[i];

        // Validate required fields
        if (
          !productData.productName ||
          !productData.category ||
          !productData.seller ||
          !productData.price
        ) {
          results.failed++;
          results.errors.push({
            index: i,
            error: "Missing required fields",
          });
          continue;
        }

        // Verify seller exists
        const seller = await Seller.findById(productData.seller);
        if (!seller) {
          results.failed++;
          results.errors.push({
            index: i,
            error: "Seller not found",
          });
          continue;
        }

        // All products are published automatically without approval
        productData.status = "Active";
        productData.publish = true;
        productData.requiresApproval = false;

        const product = await Product.create(productData);

        // Create inventory record
        await Inventory.create({
          product: product._id,
          seller: productData.seller,
          currentStock: productData.stock || 0,
          availableStock: productData.stock || 0,
        });

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          index: i,
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk import completed: ${results.success} succeeded, ${results.failed} failed`,
      data: results,
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
