import { Request, Response } from "express";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Product from "../../../models/Product";
import HeaderCategory from "../../../models/HeaderCategory";
import mongoose from "mongoose";
import { cache } from "../../../utils/cache";

// Get all categories (public) - with caching
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const channel = _req.query.channel as string;
    const cacheKey = channel ? `customer-categories-list-v2-${channel}` : "customer-categories-list-v2";

    // Try cache first
    let categories = cache.get(cacheKey);

    if (!categories) {
      const filter: any = {
        status: "Active", // Only return active categories
      };
      if (channel && (channel === "QUICK_COMMERCE" || channel === "ECOMMERCE")) {
        filter.commerceChannels = { $in: [channel] };
      }

      categories = await Category.find(filter)
        .sort({ order: 1 })
        .select("name image icon description color slug _id headerCategoryId order translations commerceChannels")
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
    const channel = _req.query.channel as string;
    const cacheKey = channel ? `customer-categories-tree-${channel}` : "customer-categories-tree";

    // Try cache first
    let categoriesWithSubs = cache.get(cacheKey);

    if (categoriesWithSubs) {
      return res.status(200).json({
        success: true,
        data: categoriesWithSubs,
      });
    }

    const filter: any = { status: "Active" };
    if (channel && (channel === "QUICK_COMMERCE" || channel === "ECOMMERCE")) {
      filter.commerceChannels = { $in: [channel] };
    }

    const categories = await Category.find(filter)
      .sort({ order: 1 })
      .lean();

    // Build product count maps to filter categories/subcategories that actually have products
    const isWholesaleMode =
      (_req.query.isWholesale as string)?.toLowerCase() === "true" ||
      (_req.query.wholesale as string)?.toLowerCase() === "true";

    const activeProductMatch: any = {
      status: "Active",
      publish: true,
      wholesaleEnabled: isWholesaleMode ? true : { $ne: true },
    };
    if (channel && (channel === "QUICK_COMMERCE" || channel === "ECOMMERCE")) {
      activeProductMatch.productType = channel;
    }

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

export const SLUG_ALIASES: Record<string, string> = {
  // Fruits & Vegetables
  "fruits-veg": "fruits-vegetables",
  "fruit-veg": "fruits-vegetables",
  "fruits-vegetable": "fruits-vegetables",
  "fruit-vegetables": "fruits-vegetables",
  "vegetables-fruits": "fruits-vegetables",
  "veg-fruits": "fruits-vegetables",
  "fruits": "fruits-vegetables",
  "vegetables": "fruits-vegetables",
  "fresh-arrivals": "fruits-vegetables",

  // Dairy
  "dairy-breakfast": "dairy-milk",
  "dairy": "dairy-milk",
  "milk": "dairy-milk",

  // Snacks & Drinks
  "snacks": "snacks-drinks",
  "drinks": "snacks-drinks",
  "cold-drinks": "chips-namkeen-and-cold-drinks",

  // Bakery & Biscuits
  "biscuits-bakery": "bakery-biscuits",
  "bakery": "bakery-biscuits",
  "biscuits": "bakery-biscuits",

  // Personal Care & Beauty
  "personal-care": "beauty",
  "beauty-personal-care": "beauty",

  // Grocery & Spices
  "grocery": "all-grocery-mart",
  "spices": "rani-masala-spices-all",
  "masala-oil": "oils-ghee",
  "atta-rice": "all-grocery-mart",

  // Specialty stores
  "health-pharma": "medical-health-pharma",
  "pharma": "medical-health-pharma",
  "pet": "pet-store-products",
  "toys": "toys-sports",
  "sports": "toys-sports",
  "hobby": "stationery-and-games-item",
  "spiritual": "puja-item",
  "egifts": "festival-item",
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
    let category: any = null;

    const normalizedId = (id || "").trim().toLowerCase();
    const slugCandidates = [id];
    const alias = SLUG_ALIASES[normalizedId];
    if (alias && !slugCandidates.includes(alias)) {
      slugCandidates.push(alias);
    }

    // Try to find by ObjectId first (only active categories for public endpoint)
    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findOne({
        _id: id,
        status: "Active",
      }).lean();
    }

    // If not found by ID, try by slug/alias candidates (case-insensitive, active)
    if (!category) {
      for (const cand of slugCandidates) {
        // Try exact slug match first
        category = await Category.findOne({
          slug: cand,
          status: "Active",
        }).lean();
        if (category) break;

        // Try case-insensitive slug match
        category = await Category.findOne({
          slug: { $regex: new RegExp(`^${cand}$`, "i") },
          status: "Active",
        }).lean();
        if (category) break;

        // Try name match as fallback (case-insensitive)
        let namePattern = cand.replace(/[-_]/g, " ");
        category = await Category.findOne({
          name: { $regex: new RegExp(`^${namePattern}$`, "i") },
          status: "Active",
        }).lean();
        if (category) break;

        // Try replacing " and " with " & "
        if (cand.includes("and")) {
          const withAmpersand = cand.replace(/-and-/g, " & ").replace(/-/g, " ");
          category = await Category.findOne({
            name: { $regex: new RegExp(`^${withAmpersand}$`, "i") },
            status: "Active",
          }).lean();
          if (category) break;
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

      // Check if it's a HeaderCategory
      let headerCat: any = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        headerCat = await HeaderCategory.findOne({
          _id: id,
          status: "Published",
        }).lean();
      }

      if (!headerCat) {
        for (const cand of slugCandidates) {
          headerCat = await HeaderCategory.findOne({
            slug: cand,
            status: "Published",
          }).lean();
          if (headerCat) break;

          headerCat = await HeaderCategory.findOne({
            slug: { $regex: new RegExp(`^${cand}$`, "i") },
            status: "Published",
          }).lean();
          if (headerCat) break;

          const namePattern = cand.replace(/[-_]/g, " ");
          headerCat = await HeaderCategory.findOne({
            name: { $regex: new RegExp(`^${namePattern}$`, "i") },
            status: "Published",
          }).lean();
          if (headerCat) break;

          if (cand.includes("and")) {
            const withAmpersand = cand.replace(/-and-/g, " & ").replace(/-/g, " ");
            headerCat = await HeaderCategory.findOne({
              name: { $regex: new RegExp(`^${withAmpersand}$`, "i") },
              status: "Published",
            }).lean();
            if (headerCat) break;
          }
        }
      }

      // Fuzzy keyword match fallback for HeaderCategory
      if (!headerCat) {
        const words = normalizedId.split(/[-_\s]+/).filter((w: string) => w.length >= 3);
        if (words.length > 0) {
          const allHeaderCats = await HeaderCategory.find({ status: "Published" }).lean();
          for (const hc of allHeaderCats) {
            const hcSlug = (hc.slug || "").toLowerCase();
            const hcName = (hc.name || "").toLowerCase();
            const allMatch = words.every((w: string) => {
              const stem = w.slice(0, 3);
              return hcSlug.includes(stem) || hcName.includes(stem);
            });
            if (allMatch) {
              headerCat = hc;
              break;
            }
          }
        }
      }

      // If still not found, check unpublished HeaderCategory with matching slug
      if (!headerCat) {
        for (const cand of slugCandidates) {
          headerCat = await HeaderCategory.findOne({
            slug: { $regex: new RegExp(`^${cand}$`, "i") },
          }).lean();
          if (headerCat) break;
        }
      }

      if (headerCat) {
        // Find child categories for this header category
        const childCategories = await Category.find({
          headerCategoryId: headerCat._id,
          status: "Active",
        })
          .select("name image order slug icon translations commerceChannels")
          .sort({ order: 1 })
          .lean();

        const data = {
          category: {
            _id: headerCat._id,
            id: headerCat._id,
            name: headerCat.name,
            slug: headerCat.slug,
            image: childCategories[0]?.image || "",
            icon: headerCat.iconName,
            isHeaderCategory: true,
            translations: headerCat.translations || {},
          },
          subcategories: childCategories,
        };

        cache.set(cacheKey, data, 10 * 60 * 1000);
        return res.status(200).json({
          success: true,
          data,
        });
      }

      // Also try fuzzy keyword fallback on Category if not a header category
      const words = normalizedId.split(/[-_\s]+/).filter((w: string) => w.length >= 3);
      if (words.length > 0) {
        const allCats = await Category.find({ status: "Active" }).lean();
        for (const c of allCats) {
          const cSlug = (c.slug || "").toLowerCase();
          const cName = (c.name || "").toLowerCase();
          const allMatch = words.every((w: string) => {
            const stem = w.slice(0, 3);
            return cSlug.includes(stem) || cName.includes(stem);
          });
          if (allMatch) {
            category = c;
            break;
          }
        }
      }

      if (!category) {
        console.log(`[getCategoryById] Category not found: ${id}`);
        return res.status(404).json({
          success: false,
          message: `Category not found: ${id}`,
        });
      }
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
          .select("name image order slug icon translations commerceChannels")
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
      .select("name image order slug icon translations commerceChannels")
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
