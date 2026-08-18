import { Request, Response } from "express";
import mongoose from "mongoose";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Product from "../../../models/Product";
import HeaderCategory from "../../../models/HeaderCategory";
import Seller from "../../../models/Seller";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Helper to find category by either ObjectId, slug, or name
 */
const findCategoryByIdOrSlug = async (idOrSlug: string) => {
  if (!idOrSlug) return null;

  if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
    const cat = await Category.findById(idOrSlug);
    if (cat) return cat;
  }

  // Try exact slug or case-insensitive slug match
  let cat = await Category.findOne({
    slug: { $regex: new RegExp(`^${idOrSlug}$`, "i") },
  });
  if (cat) return cat;

  // Try name match (replace hyphens/underscores with space)
  const namePattern = idOrSlug.replace(/[-_]/g, " ");
  cat = await Category.findOne({
    name: { $regex: new RegExp(`^${namePattern}$`, "i") },
  });
  if (cat) return cat;

  if (idOrSlug.includes("and")) {
    const withAmpersand = idOrSlug.replace(/-and-/g, " & ").replace(/-/g, " ");
    cat = await Category.findOne({
      name: { $regex: new RegExp(`^${withAmpersand}$`, "i") },
    });
    if (cat) return cat;
  }

  return null;
};

/**
 * Get all categories (parent categories only by default)
 * Enforces seller allowed header category isolation when called by a seller.
 */
export const getCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { includeSubcategories, search, status } = req.query;

    // Build query - by default, get only parent categories (no parentId)
    const query: any = { parentId: null };

    // If includeSubcategories is true, get all categories
    if (includeSubcategories === "true") {
      delete query.parentId;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Search filter
    if (search) {
      query.name = { $regex: search as string, $options: "i" };
    }

    // Seller isolation check: If request comes from an authenticated seller, filter by allowed Header Categories
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (userId && (userRole === "Seller" || !userRole)) {
      const seller = await Seller.findById(userId).select("categories");
      if (seller && seller.categories && seller.categories.length > 0) {
        const allowedHeaderCats = await HeaderCategory.find({
          name: { $in: seller.categories },
          status: "Published",
        }).select("_id");
        const allowedHeaderIds = allowedHeaderCats.map((h) => h._id);
        query.headerCategoryId = { $in: allowedHeaderIds };
      }
    }

    const categories = await Category.find(query)
      .populate("headerCategoryId", "name slug")
      .sort({ name: 1 });

    // Get subcategory and product counts for each category (combining both Category parentId and SubCategory models)
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const catSubsCount = await Category.countDocuments({
          parentId: category._id,
        });

        const legacySubsCount = await SubCategory.countDocuments({
          category: category._id,
        });

        const subcategoryCount = catSubsCount + legacySubsCount;

        const productCount = await Product.countDocuments({
          category: category._id,
        });

        return {
          ...category.toObject(),
          totalSubcategory: subcategoryCount,
          totalProduct: productCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categoriesWithCounts,
    });
  }
);

/**
 * Get category by ID or slug
 */
export const getCategoryById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const category = await findCategoryByIdOrSlug(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get counts
    const subcategoryCount = await Category.countDocuments({
      parentId: category._id,
    });

    const productCount = await Product.countDocuments({
      category: category._id,
    });

    const categoryWithCounts = {
      ...category.toObject(),
      totalSubcategory: subcategoryCount,
      totalProduct: productCount,
    };

    return res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      data: categoryWithCounts,
    });
  }
);

/**
 * Get subcategories by parent category ID or slug
 * Supports both old SubCategory model and new Category model (with parentId)
 */
export const getSubcategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      search,
      page = "1",
      limit = "10",
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    // Verify parent category exists (supports both ObjectId and slug/name)
    const parentCategory = await findCategoryByIdOrSlug(id);
    if (!parentCategory) {
      return res.status(200).json({
        success: true,
        message: "No subcategories found",
        data: [],
        pagination: {
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 10,
          total: 0,
          pages: 0,
        },
      });
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    const sortField =
      sortBy === "subcategoryName" ? "name" : (sortBy as string);
    sort[sortField] = sortOrder === "asc" ? 1 : -1;

    // Build search query
    const searchQuery = search
      ? { $regex: search as string, $options: "i" }
      : undefined;

    // 1. Get subcategories from new Category model (where parentId = category id)
    const categorySubcategoriesQuery: any = {
      parentId: parentCategory._id,
    };

    // Apply status filter if provided (e.g., status=Active)
    if (req.query.status) {
      categorySubcategoriesQuery.status = req.query.status;
    }
    if (searchQuery) {
      categorySubcategoriesQuery.name = searchQuery;
    }

    const categorySubcategories = await Category.find(
      categorySubcategoriesQuery
    )
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // 2. Get subcategories from old SubCategory model (for backward compatibility)
    const oldSubcategoryQuery: any = { category: parentCategory._id };
    if (searchQuery) {
      oldSubcategoryQuery.name = searchQuery;
    }

    const oldSubcategories = await SubCategory.find(oldSubcategoryQuery)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Combine both results
    const allSubcategories = [
      ...categorySubcategories.map((cat) => ({
        _id: cat._id,
        name: cat.name,
        subcategoryName: cat.name, // Map name to subcategoryName for frontend compatibility
        categoryName: parentCategory.name,
        image: cat.image,
        subcategoryImage: cat.image,
        order: cat.order || 0,
        totalProduct: 0, // Will be calculated below
        isNewModel: true, // Flag to identify new model
      })),
      ...oldSubcategories.map((sub) => ({
        _id: sub._id,
        name: sub.name,
        subcategoryName: sub.name,
        categoryName: parentCategory.name,
        image: sub.image,
        subcategoryImage: sub.image,
        order: sub.order || 0,
        totalProduct: 0, // Will be calculated below
        isNewModel: false, // Flag to identify old model
      })),
    ];

    // Remove duplicates (in case same subcategory exists in both models)
    const uniqueSubcategories = Array.from(
      new Map(
        allSubcategories.map((item: any) => [item._id.toString(), item])
      ).values()
    );

    // Sort combined results
    uniqueSubcategories.sort((a, b) => {
      const aValue = (a as any)[sortField] || "";
      const bValue = (b as any)[sortField] || "";
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination to combined results
    const paginatedSubcategories = uniqueSubcategories.slice(
      skip,
      skip + limitNum
    );

    // Get product counts for each subcategory
    const subcategoriesWithCounts = await Promise.all(
      paginatedSubcategories.map(async (subcategory) => {
        // Count products - check both old and new models
        const productCountOld = await Product.countDocuments({
          subcategory: subcategory._id,
        });

        // For new model, products might reference category directly
        const productCountNew = await Product.countDocuments({
          category: subcategory._id,
        });

        const totalProduct = productCountOld + productCountNew;

        return {
          ...subcategory,
          totalProduct,
        };
      })
    );

    // Get total count for pagination
    const totalCategorySubs = await Category.countDocuments(
      categorySubcategoriesQuery
    );
    const totalOldSubs = await SubCategory.countDocuments(oldSubcategoryQuery);
    const total = totalCategorySubs + totalOldSubs;

    return res.status(200).json({
      success: true,
      message: "Subcategories fetched successfully",
      data: subcategoriesWithCounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get all categories with their subcategories nested
 */
export const getAllCategoriesWithSubcategories = asyncHandler(
  async (_req: Request, res: Response) => {
    // Get all parent categories
    const parentCategories = await Category.find({ parentId: null }).sort({
      name: 1,
    });

    // Get all subcategories grouped by parent
    const categoriesWithSubcategories = await Promise.all(
      parentCategories.map(async (category) => {
        const subcategories = await SubCategory.find({
          category: category._id,
        }).sort({ name: 1 });

        // Get product counts
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

        const subcategoryCount = subcategories.length;
        const productCount = await Product.countDocuments({
          category: category._id,
        });

        return {
          ...category.toObject(),
          totalSubcategory: subcategoryCount,
          totalProduct: productCount,
          subcategories: subcategoriesWithCounts,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Categories with subcategories fetched successfully",
      data: categoriesWithSubcategories,
    });
  }
);

/**
 * Get all subcategories (across all categories)
 * Enforces seller allowed header category isolation when called by a seller.
 * Combines subcategories from both Category (parentId != null) and SubCategory models.
 */
export const getAllSubcategories = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      search,
      page = "1",
      limit = "10",
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Seller isolation check
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    let allowedParentCategoryIds: any[] | null = null;

    if (userId && (userRole === "Seller" || !userRole)) {
      const seller = await Seller.findById(userId).select("categories");
      if (seller && seller.categories && seller.categories.length > 0) {
        const allowedHeaderCats = await HeaderCategory.find({
          name: { $in: seller.categories },
          status: "Published",
        }).select("_id");
        const allowedHeaderIds = allowedHeaderCats.map((h) => h._id);

        const allowedParents = await Category.find({
          headerCategoryId: { $in: allowedHeaderIds },
          parentId: null,
        }).select("_id");

        allowedParentCategoryIds = allowedParents.map((p) => p._id);
      }
    }

    // 1. Fetch child categories from Category model (parentId != null)
    const categorySubQuery: any = { parentId: { $ne: null } };
    if (allowedParentCategoryIds !== null) {
      categorySubQuery.parentId = { $in: allowedParentCategoryIds };
    }
    if (search) {
      categorySubQuery.name = { $regex: search as string, $options: "i" };
    }

    const categorySubs = await Category.find(categorySubQuery)
      .populate("parentId", "name")
      .lean();

    // 2. Fetch subcategories from SubCategory model
    const legacySubQuery: any = {};
    if (allowedParentCategoryIds !== null) {
      legacySubQuery.category = { $in: allowedParentCategoryIds };
    }
    if (search) {
      legacySubQuery.name = { $regex: search as string, $options: "i" };
    }

    const legacySubs = await SubCategory.find(legacySubQuery)
      .populate("category", "name")
      .lean();

    // Combine and format results
    const combined = [
      ...categorySubs.map((sub: any) => ({
        id: sub._id.toString(),
        _id: sub._id.toString(),
        categoryName: sub.parentId?.name || "Category",
        subcategoryName: sub.name,
        subcategoryImage: sub.image || "",
        createdAt: sub.createdAt,
      })),
      ...legacySubs.map((sub: any) => ({
        id: sub._id.toString(),
        _id: sub._id.toString(),
        categoryName: sub.category?.name || "Category",
        subcategoryName: sub.name,
        subcategoryImage: sub.image || "",
        createdAt: sub.createdAt,
      })),
    ];

    // Remove duplicates
    const uniqueMap = new Map();
    combined.forEach((item) => uniqueMap.set(item.id, item));
    const uniqueSubs = Array.from(uniqueMap.values());

    // Sort combined list
    uniqueSubs.sort((a: any, b: any) => {
      const fieldA = a.subcategoryName?.toLowerCase() || "";
      const fieldB = b.subcategoryName?.toLowerCase() || "";
      return sortOrder === "asc"
        ? fieldA.localeCompare(fieldB)
        : fieldB.localeCompare(fieldA);
    });

    // Calculate product counts and paginate
    const total = uniqueSubs.length;
    const paginatedSubs = uniqueSubs.slice(skip, skip + limitNum);

    const dataWithCounts = await Promise.all(
      paginatedSubs.map(async (sub) => {
        const prodCountSub = await Product.countDocuments({
          subcategory: sub.id,
        });
        const prodCountCat = await Product.countDocuments({
          category: sub.id,
        });
        return {
          ...sub,
          totalProduct: prodCountSub + prodCountCat,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Subcategories fetched successfully",
      data: dataWithCounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  }
);

/**
 * Get sub-subcategories by subcategory ID
 */
export const getSubSubCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { subCategoryId } = req.params;
    const { search, isActive } = req.query;

    const subCategory = await findCategoryByIdOrSlug(subCategoryId);
    const targetParentId = subCategory ? subCategory._id : subCategoryId;

    // Query Category model where parentId is the subcategory ID
    const query: any = { parentId: targetParentId };

    if (isActive === "true") {
      query.status = "Active";
    }

    if (search) {
      query.name = { $regex: search as string, $options: "i" };
    }

    const subSubCategories = await Category.find(query)
      .sort({ order: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Sub-subcategories fetched successfully",
      data: subSubCategories,
    });
  }
);
