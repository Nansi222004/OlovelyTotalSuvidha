import { Request, Response } from "express";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Product from "../../../models/Product";
import mongoose from "mongoose";
import { cache } from "../../../utils/cache";

// Get all categories (public) - with caching
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const cacheKey = "customer-categories-list-v2";

    // Try cache first
    let categories = cache.get(cacheKey);

    if (!categories) {
      categories = await Category.find({
        status: "Active", // Only return active categories
      })
        .sort({ order: 1 })
        .select("name image icon description color slug _id headerCategoryId order")
        .lean(); // Use lean() for better performance

      // Cache for 10 minutes
      cache.set(cacheKey, categories, 10 * 60 * 1000);
    }

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

// Get all categories with their subcategories (for menu/sidebar) - with caching
export const getCategoriesWithSubs = async (_req: Request, res: Response) => {
  try {
    const cacheKey = "customer-categories-tree";

    // Try cache first
    let categoriesWithSubs = cache.get(cacheKey);

    if (categoriesWithSubs) {
      return res.status(200).json({
        success: true,
        data: categoriesWithSubs,
      });
    }

    const categories = await Category.find({ status: "Active" })
      .sort({ order: 1 })
      .lean();

    // Build product count maps to filter categories/subcategories that actually have products
    const activeProductMatch = { status: "Active", publish: true };

    const [categoryCounts, subcategoryCounts] = await Promise.all([
      Product.aggregate([
        { $match: activeProductMatch },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      Product.aggregate([
        { $match: activeProductMatch },
        { $group: { _id: "$subcategory", count: { $sum: 1 } } },
      ]),
    ]);

    const categoryCountMap = new Map<string, number>();
    categoryCounts.forEach((item) => {
      if (item._id) {
        categoryCountMap.set(item._id.toString(), item.count);
      }
    });

    const subcategoryCountMap = new Map<string, number>();
    subcategoryCounts.forEach((item) => {
      if (item._id) {
        subcategoryCountMap.set(item._id.toString(), item.count);
      }
    });

    categoriesWithSubs = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await SubCategory.find({
          category: category._id,
        })
          .sort({ order: 1 })
          .select("name image order");

        // Keep only subcategories that have at least one product
        const filteredSubs = subcategories.filter((sub) =>
          subcategoryCountMap.has(sub._id.toString())
        );

        const directCategoryCount =
          categoryCountMap.get(category._id.toString()) || 0;
        const subsProductCount = filteredSubs.reduce(
          (total, sub) =>
            total + (subcategoryCountMap.get(sub._id.toString()) || 0),
          0
        );
        const totalProducts = directCategoryCount + subsProductCount;

        // Exclude category if no products in category or its subcategories
        if (totalProducts === 0) {
          return null;
        }

        return {
          ...category,
          subcategories: filteredSubs,
          totalProducts,
        };
      })
    ).then((list) => list.filter(Boolean));

    // Cache for 10 minutes
    cache.set(cacheKey, categoriesWithSubs, 10 * 60 * 1000);

    return res.status(200).json({
      success: true,
      data: categoriesWithSubs,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching categories tree",
      error: error.message,
    });
  }
};

// Get single category details with subcategories - with caching
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cacheKey = `customer-category-${id}`;

    // Try cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
      });
    }

    console.log(`[getCategoryById] Looking for category with id/slug: ${id}`);
    let category;

    // Try to find by ObjectId first (only active categories for public endpoint)
    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findOne({
        _id: id,
        status: "Active",
      }).lean();
    }

    // If not found by ID, try by slug (case-insensitive, only active categories)
    if (!category) {
      // Try exact slug match first
      category = await Category.findOne({
        slug: id,
        status: "Active",
      }).lean();

      // Try case-insensitive slug match
      if (!category) {
        category = await Category.findOne({
          slug: { $regex: new RegExp(`^${id}$`, "i") },
          status: "Active",
        }).lean();
      }

      // Try name match as fallback (case-insensitive)
      if (!category) {
        // First try standard replacement
        let namePattern = id.replace(/[-_]/g, " ");
        category = await Category.findOne({
          name: { $regex: new RegExp(`^${namePattern}$`, "i") },
          status: "Active",
        }).lean();

        // If not found, try replacing " and " with " & " specifically for categories like "Vegetables & Fruits"
        if (!category && id.includes("and")) {
          const withAmpersand = id.replace(/-and-/g, " & ").replace(/-/g, " ");
          category = await Category.findOne({
            name: { $regex: new RegExp(`^${withAmpersand}$`, "i") },
            status: "Active",
          }).lean();
        }
      }
    }

    if (!category) {
      // Check if it's a subcategory
      if (mongoose.Types.ObjectId.isValid(id)) {
        const subcategory = await SubCategory.findById(id).lean();
        if (subcategory) {
          // Find the parent category
          category = await Category.findById(subcategory.category).lean();
          if (category) {
            // Return both for the frontend to decide
            const subcategories = await SubCategory.find({
              category: category._id,
            })
              .select("name image order category")
              .sort({
                order: 1,
              });
            return res.status(200).json({
              success: true,
              data: {
                category,
                subcategories,
                currentSubcategory: subcategory,
              },
            });
          }
        }
      }

      console.log(`[getCategoryById] Category not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: `Category not found: ${id}`,
      });
    }

    console.log(
      `[getCategoryById] Found category: ${category.name} (${category._id})`
    );

    // Check if this category is actually a subcategory (has a parentId)
    if (category.parentId) {
      console.log(
        `[getCategoryById] Category ${category.name} is a subcategory. Fetching parent category...`
      );
      const parentCategory = await Category.findOne({
        _id: category.parentId,
        status: "Active",
      }).lean();

      if (parentCategory) {
        let parentCatId = parentCategory._id;
        if (typeof parentCatId === "string") {
          try {
            parentCatId = new mongoose.Types.ObjectId(parentCatId);
          } catch (e) {
            console.error("Failed to cast parent category ID to ObjectId:", e);
          }
        }

        const subcategories = await Category.find({
          parentId: { $in: [parentCatId, parentCatId.toString()] },
          status: "Active",
        })
          .select("name image order slug icon")
          .sort({
            order: 1,
          });

        console.log(
          `[getCategoryById] Found ${subcategories.length} sibling subcategories for parent ${parentCategory.name}`
        );

        const responseData = {
          category: parentCategory,
          subcategories,
          currentSubcategory: category,
        };

        // Cache for 10 minutes
        cache.set(cacheKey, responseData, 10 * 60 * 1000);

        return res.status(200).json({
          success: true,
          data: responseData,
        });
      }
    }

    // Ensure category._id is treated as ObjectId for the query
    let catId = category._id;
    if (typeof catId === "string") {
      try {
        catId = new mongoose.Types.ObjectId(catId);
      } catch (e) {
        console.error("Failed to cast category ID to ObjectId:", e);
      }
    }

    // Query for BOTH ObjectId and String representation to be safe against legacy data references
    // Use Category model to find subcategories (children) instead of separate SubCategory model
    // Using parentId to find children
    const subcategories = await Category.find({
      parentId: { $in: [catId, catId.toString()] },
      status: "Active",
    })
      .select("name image order slug icon")
      .sort({
        order: 1,
      });

    console.log(
      `[getCategoryById] Found ${subcategories.length} subcategories for ${category.name}`
    );

    const responseData = {
      category,
      subcategories,
      currentSubcategory: null,
    };

    // Cache for 10 minutes
    cache.set(cacheKey, responseData, 10 * 60 * 1000);

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching category details",
      error: error.message,
    });
  }
};
