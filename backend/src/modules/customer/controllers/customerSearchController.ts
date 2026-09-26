import { Request, Response } from "express";
import mongoose from "mongoose";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Product from "../../../models/Product";
import Brand from "../../../models/Brand";
import Seller from "../../../models/Seller";
import AppSettings from "../../../models/AppSettings";
import { getCommerceChannels } from "../../../services/commerceChannelService";

/**
 * Builds a flexible regex that allows optional spaces/hyphens between characters.
 * This dynamically matches compound words (e.g. "footwear" matches "Foot Wear", "icecream" matches "Ice cream")
 * without requiring any hardcoded vocabulary or mappings.
 */
function buildFlexibleRegex(query: string): RegExp {
  const clean = query.trim();
  const escapedChars = Array.from(clean).map((ch) => {
    if (/\s/.test(ch)) return "\\s+";
    return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });

  let pattern = "";
  for (let i = 0; i < escapedChars.length; i++) {
    pattern += escapedChars[i];
    if (
      i < escapedChars.length - 1 &&
      escapedChars[i] !== "\\s+" &&
      escapedChars[i + 1] !== "\\s+"
    ) {
      pattern += "[\\s\\-]*";
    }
  }
  return new RegExp(pattern, "i");
}

export const getSearchSuggestions = async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    const targetChannel = (
      ((req.query.channel || req.query.productType) as string) || ""
    ).toUpperCase();
    const isWholesaleMode =
      (req.query.isWholesale as string)?.toLowerCase() === "true" ||
      (req.query.wholesale as string)?.toLowerCase() === "true" ||
      targetChannel === "WHOLESALE";

    // Fast return if query is less than 2 characters
    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        data: {
          categories: [],
          subcategories: [],
          products: [],
          brands: [],
        },
      });
    }

    const channelAvailability = await getCommerceChannels();

    // If a channel is requested but globally disabled, return empty suggestions
    if (
      targetChannel === "QUICK_COMMERCE" &&
      !channelAvailability.quickCommerceEnabled
    ) {
      return res.status(200).json({
        success: true,
        data: {
          categories: [],
          subcategories: [],
          products: [],
          brands: [],
        },
      });
    }

    if (
      targetChannel === "ECOMMERCE" &&
      !channelAvailability.ecommerceEnabled
    ) {
      return res.status(200).json({
        success: true,
        data: {
          categories: [],
          subcategories: [],
          products: [],
          brands: [],
        },
      });
    }

    const rx = buildFlexibleRegex(q);
    const prefixRx = new RegExp(`^${rx.source}`, "i");

    // ─────────────────────────────────────────────────────────────
    // 1. CATEGORIES
    // ─────────────────────────────────────────────────────────────
    const catQuery: any = {
      status: "Active",
      name: rx,
    };

    // Filter categories based on global commerce channels and requested channel
    if (targetChannel === "QUICK_COMMERCE") {
      catQuery.commerceChannels = "QUICK_COMMERCE";
    } else if (targetChannel === "ECOMMERCE") {
      catQuery.commerceChannels = "ECOMMERCE";
    } else {
      // Global channel constraints when no specific channel is requested
      if (
        !channelAvailability.ecommerceEnabled &&
        channelAvailability.quickCommerceEnabled
      ) {
        catQuery.commerceChannels = "QUICK_COMMERCE";
      } else if (
        !channelAvailability.quickCommerceEnabled &&
        channelAvailability.ecommerceEnabled
      ) {
        catQuery.commerceChannels = "ECOMMERCE";
      }
    }

    const rawCategories = await Category.find(catQuery)
      .select("_id name slug image icon commerceChannels")
      .limit(10)
      .lean();

    // Sort categories: prefix match first, then alphabetical
    rawCategories.sort((a, b) => {
      const aPrefix = prefixRx.test(a.name) ? 0 : 1;
      const bPrefix = prefixRx.test(b.name) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.name.localeCompare(b.name);
    });

    const categories = rawCategories.slice(0, 5).map((c: any) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      image: c.image || null,
      icon: c.icon || null,
    }));

    const matchedCategoryIds = rawCategories.map((c) => c._id);

    // ─────────────────────────────────────────────────────────────
    // 2. SUBCATEGORIES
    // ─────────────────────────────────────────────────────────────
    // Find subcategories matching the query whose parent category is active and channel-eligible
    const eligibleCategoriesForSubs = await Category.find(catQuery)
      .select("_id")
      .lean();
    const eligibleCatIds = eligibleCategoriesForSubs.map((c) => c._id);

    let subcategories: any[] = [];
    if (eligibleCatIds.length > 0) {
      const rawSubcategories = await SubCategory.find({
        name: rx,
        category: { $in: eligibleCatIds },
      })
        .populate("category", "name slug")
        .select("_id name category image")
        .limit(10)
        .lean();

      rawSubcategories.sort((a, b) => {
        const aPrefix = prefixRx.test(a.name) ? 0 : 1;
        const bPrefix = prefixRx.test(b.name) ? 0 : 1;
        if (aPrefix !== bPrefix) return aPrefix - bPrefix;
        return a.name.localeCompare(b.name);
      });

      subcategories = rawSubcategories.slice(0, 5).map((s: any) => ({
        _id: s._id,
        name: s.name,
        category: s.category?._id || s.category,
        categorySlug: s.category?.slug || null,
        categoryName: s.category?.name || null,
        image: s.image || null,
      }));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. PRODUCTS
    // ─────────────────────────────────────────────────────────────
    const prodQuery: any = {
      status: "Active",
      publish: true,
      $or: [
        { isShopByStoreOnly: { $ne: true } },
        { isShopByStoreOnly: { $exists: false } },
      ],
    };

    // Channel constraint for products
    if (targetChannel === "QUICK_COMMERCE") {
      prodQuery.productType = "QUICK_COMMERCE";
    } else if (targetChannel === "ECOMMERCE") {
      prodQuery.productType = "ECOMMERCE";
    } else {
      if (
        !channelAvailability.ecommerceEnabled &&
        channelAvailability.quickCommerceEnabled
      ) {
        prodQuery.productType = "QUICK_COMMERCE";
      } else if (
        !channelAvailability.quickCommerceEnabled &&
        channelAvailability.ecommerceEnabled
      ) {
        prodQuery.productType = "ECOMMERCE";
      }
    }

    // Wholesale logic preservation
    if (isWholesaleMode) {
      const appSettings = await AppSettings.findOne()
        .select("wholesaleSettings")
        .lean();
      const globalWholesaleEnabled =
        appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;

      if (!globalWholesaleEnabled) {
        // Wholesale disabled globally
        prodQuery._id = new mongoose.Types.ObjectId(); // Non-matching dummy ID
      } else {
        const [eligibleWholesaleSellers, eligibleWholesaleCategories] =
          await Promise.all([
            Seller.find(
              { status: "Approved", wholesaleEnabled: true },
              { _id: 1 }
            ).lean(),
            Category.find(
              { status: "Active", wholesaleEnabled: true },
              { _id: 1 }
            ).lean(),
          ]);

        const sellerIds = eligibleWholesaleSellers.map((s) => s._id);
        const catIds = eligibleWholesaleCategories.map((c) => c._id);

        if (sellerIds.length === 0 || catIds.length === 0) {
          prodQuery._id = new mongoose.Types.ObjectId();
        } else {
          prodQuery.wholesaleEnabled = true;
          prodQuery.seller = { $in: sellerIds };
          prodQuery.category = { $in: catIds };
        }
      }
    } else if (
      targetChannel === "QUICK_COMMERCE" ||
      targetChannel === "ECOMMERCE"
    ) {
      // Individual retail mode excludes wholesale products
      prodQuery.wholesaleEnabled = { $ne: true };
    } else {
      // ALL / default browsing: retail products + eligible wholesale products
      const appSettings = await AppSettings.findOne()
        .select("wholesaleSettings")
        .lean();
      const globalWholesaleEnabled =
        appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;

      if (globalWholesaleEnabled) {
        const [eligibleWholesaleSellers, eligibleWholesaleCategories] =
          await Promise.all([
            Seller.find(
              { status: "Approved", wholesaleEnabled: true },
              { _id: 1 }
            ).lean(),
            Category.find(
              { status: "Active", wholesaleEnabled: true },
              { _id: 1 }
            ).lean(),
          ]);
        const sellerIds = eligibleWholesaleSellers.map((s) => s._id);
        const catIds = eligibleWholesaleCategories.map((c) => c._id);

        if (sellerIds.length > 0 && catIds.length > 0) {
          prodQuery.$and = prodQuery.$and || [];
          prodQuery.$and.push({
            $or: [
              { wholesaleEnabled: { $ne: true } },
              {
                wholesaleEnabled: true,
                seller: { $in: sellerIds },
                category: { $in: catIds },
              },
            ],
          });
        } else {
          prodQuery.wholesaleEnabled = { $ne: true };
        }
      } else {
        prodQuery.wholesaleEnabled = { $ne: true };
      }
    }

    // Product search conditions: matching name, tags, smallDescription, or matching category
    const searchConditions: any[] = [
      { productName: rx },
      { tags: rx },
      { smallDescription: rx },
    ];
    if (matchedCategoryIds.length > 0) {
      searchConditions.push({ category: { $in: matchedCategoryIds } });
    }

    prodQuery.$and = prodQuery.$and || [];
    prodQuery.$and.push({ $or: searchConditions });

    const rawProducts = await Product.find(prodQuery)
      .select(
        "_id productName mainImage price discPrice productType category wholesaleEnabled wholesalePrice wholesaleMinQty"
      )
      .populate("category", "name slug")
      .limit(16)
      .lean();

    // Rank products:
    // 1. Prefix match on productName
    // 2. Contains match on productName
    // 3. Other matches (tags, category)
    rawProducts.sort((a, b) => {
      const aNamePrefix = prefixRx.test(a.productName) ? 0 : 1;
      const bNamePrefix = prefixRx.test(b.productName) ? 0 : 1;
      if (aNamePrefix !== bNamePrefix) return aNamePrefix - bNamePrefix;

      const aNameContains = rx.test(a.productName) ? 0 : 1;
      const bNameContains = rx.test(b.productName) ? 0 : 1;
      if (aNameContains !== bNameContains) return aNameContains - bNameContains;

      return a.productName.localeCompare(b.productName);
    });

    const products = rawProducts.slice(0, 8).map((p: any) => ({
      _id: p._id,
      productName: p.productName,
      mainImage: p.mainImage || null,
      price: p.price,
      discPrice: p.discPrice || p.price,
      productType: p.productType || "QUICK_COMMERCE",
      categoryName: p.category?.name || null,
      categorySlug: p.category?.slug || null,
      wholesaleEnabled: !!p.wholesaleEnabled,
      wholesalePrice: p.wholesalePrice || null,
      wholesaleMinQty: p.wholesaleMinQty || null,
    }));

    // ─────────────────────────────────────────────────────────────
    // 4. BRANDS
    // ─────────────────────────────────────────────────────────────
    const rawBrands = await Brand.find({ name: rx })
      .select("_id name image")
      .limit(10)
      .lean();

    rawBrands.sort((a, b) => {
      const aPrefix = prefixRx.test(a.name) ? 0 : 1;
      const bPrefix = prefixRx.test(b.name) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.name.localeCompare(b.name);
    });

    const brands = rawBrands.slice(0, 5).map((b) => ({
      _id: b._id,
      name: b.name,
      image: b.image || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        categories,
        subcategories,
        products,
        brands,
      },
    });
  } catch (error: any) {
    console.error("Error fetching search suggestions:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching search suggestions",
      error: error.message,
    });
  }
};
