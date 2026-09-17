import { Request, Response } from "express";
import Product from "../../../models/Product";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Shop from "../../../models/Shop";
import HeaderCategory from "../../../models/HeaderCategory";
import HomeSection from "../../../models/HomeSection";
import BestsellerCard from "../../../models/BestsellerCard";
import LowestPricesProduct from "../../../models/LowestPricesProduct";
import PromoStrip from "../../../models/PromoStrip";
import Seller from "../../../models/Seller";
import AppSettings from "../../../models/AppSettings";
import mongoose from "mongoose";
import { cache } from "../../../utils/cache";
import { findSellersWithinRange } from "../../../utils/locationHelper";

// Helper function to fetch data for a home section based on its configuration
async function fetchSectionData(
  section: any,
  nearbySellerIds?: mongoose.Types.ObjectId[],
  hasUserLocation?: boolean
): Promise<any[]> {
  try {
    const { categories, subCategories, displayType, limit } = section;
    const isBeautySection =
      section.slug === "beauty-personal-care" ||
      (typeof section.title === "string" && section.title.toLowerCase().includes("beauty"));

    const effectiveDisplayType = isBeautySection ? "products" : displayType;

    // If displayType is "subcategories", fetch subcategories
    if (effectiveDisplayType === "subcategories") {
      let subcategoryQuery: any = {};
      let specificIds: string[] = [];
      let results: any[] = [];
      let parentCategoryIds: string[] = [];

      // If specific subcategories are selected, use them
      if (subCategories && subCategories.length > 0) {
        specificIds = subCategories
          .map((sub: any) => (sub ? (sub._id ? sub._id.toString() : (typeof sub === 'string' ? sub : null)) : null))
          .filter(Boolean);

        if (specificIds.length > 0) {
          subcategoryQuery._id = { $in: specificIds };
        }
      }

      // If no specific subcategories selected, fallback to fetching by parent categories
      if (specificIds.length === 0 && categories && categories.length > 0) {
        parentCategoryIds = categories
          .map((cat: any) => (cat ? (cat._id ? cat._id.toString() : (typeof cat === 'string' ? cat : null)) : null))
          .filter(Boolean);

        if (parentCategoryIds.length > 0) {
          subcategoryQuery.category = { $in: parentCategoryIds };
        }
      }

      // 1. Fetch from SubCategory collection
      if (Object.keys(subcategoryQuery).length > 0) {
        const subcategories = await SubCategory.find(subcategoryQuery)
          .select("name image order category translations")
          .sort({ order: 1 })
          .limit(limit || 10)
          .lean();

        const mappedSubs = subcategories.map((sub: any) => ({
          id: sub._id ? sub._id.toString() : "",
          subcategoryId: sub._id ? sub._id.toString() : "",
          categoryId: sub.category ? (typeof sub.category === 'object' && sub.category !== null ? sub.category._id?.toString() || "" : sub.category.toString()) : "",
          name: sub.name || "",
          image: sub.image || "",
          slug: sub.name ? sub.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : (sub._id ? sub._id.toString() : ""),
          type: "subcategory",
          translations: sub.translations || {},
        }));

        results.push(...mappedSubs);
      }

      // 2. Fallback or Specific ID check in Category Collection
      // Case A: Specific IDs were provided but not found in SubCategory
      if (specificIds.length > 0) {
        const foundSubIds = results.map((r) => r.id);
        const missingIds = specificIds.filter(
          (id) => !foundSubIds.includes(id)
        );

        if (missingIds.length > 0) {
          const foundCategories = await Category.find({
            _id: { $in: missingIds },
            status: "Active",
          })
            .select("name image slug parentId translations")
            .lean();

          const mappedCats = foundCategories.map((c: any) => {
            const hasParent = c.parentId != null;
            return {
              id: c._id ? c._id.toString() : "",
              subcategoryId: hasParent ? (c._id ? c._id.toString() : "") : undefined,
              categoryId: hasParent
                ? (c.parentId ? (typeof c.parentId === 'object' ? c.parentId._id?.toString() : c.parentId.toString()) : "")
                : c.slug || (c._id ? c._id.toString() : ""),
              name: c.name || "",
              image: c.image || "",
              slug: c.slug || "",
              type: hasParent ? "subcategory" : "category",
              translations: c.translations || {},
            };
          });

          results.push(...mappedCats);
        }
      }
      // Case B: No specific IDs, so we relied on parentCategoryIds.
      // We found SubCategories (maybe), but we ALSO need to check for child Categories (self-referenced).
      else if (parentCategoryIds.length > 0) {
        // Search Category collection where parentId matches
        const childCategories = await Category.find({
          parentId: { $in: parentCategoryIds },
          status: "Active",
        })
          .select("name image slug parentId translations")
          .sort({ order: 1 })
          .limit(limit || 10)
          .lean();

        const mappedChildCats = childCategories.map((c: any) => ({
          id: c._id ? c._id.toString() : "",
          subcategoryId: c._id ? c._id.toString() : "",
          categoryId: c.parentId ? (typeof c.parentId === 'object' ? c.parentId._id?.toString() : c.parentId.toString()) : (c.slug || (c._id ? c._id.toString() : "")),
          name: c.name || "",
          image: c.image || "",
          slug: c.slug || "",
          type: "subcategory",
          translations: c.translations || {},
        }));

        results.push(...mappedChildCats);
      }

      return results;
    }

    // If displayType is "products", fetch products
    if (effectiveDisplayType === "products") {
      let categoryIds: any[] = [];
      if (categories && categories.length > 0) {
        categoryIds = categories
          .map((cat: any) => (cat ? cat._id || cat : null))
          .filter(Boolean);
      }

      // If Beauty section and no valid categories linked, dynamically resolve authoritative categories
      if (isBeautySection && categoryIds.length === 0) {
        const beautyCats = await Category.find({
          name: { $in: ["Cosmetics Item, Bath & Body", "Skins Face Hair", "Baby Care Products"] },
          status: "Active"
        }).select("_id").lean();
        categoryIds = beautyCats.map(c => c._id);
      }

      // Check global wholesale setting and seller/category eligibility
      const settings = await AppSettings.findOne().select("wholesaleSettings").lean();
      const globalWholesaleEnabled = settings?.wholesaleSettings?.wholesaleEnabled ?? false;

      let eligibleWholesaleSellerIds: any[] = [];
      let eligibleWholesaleCategoryIds: any[] = [];

      if (globalWholesaleEnabled) {
        const [eligibleSellers, eligibleCategories] = await Promise.all([
          Seller.find({ status: "Approved", wholesaleEnabled: true }, { _id: 1 }).lean(),
          Category.find({ status: "Active", wholesaleEnabled: true }, { _id: 1 }).lean()
        ]);
        eligibleWholesaleSellerIds = eligibleSellers.map((s: any) => s._id);
        eligibleWholesaleCategoryIds = eligibleCategories.map((c: any) => c._id);
      }

      const query: any = {
        status: "Active",
        publish: true,
        $and: [
          {
            $or: [
              { isShopByStoreOnly: { $ne: true } },
              { isShopByStoreOnly: { $exists: false } },
            ]
          }
        ]
      };

      // In All mode: allow eligible retail products OR eligible wholesale products
      if (globalWholesaleEnabled && eligibleWholesaleSellerIds.length > 0 && eligibleWholesaleCategoryIds.length > 0) {
        query.$and.push({
          $or: [
            { wholesaleEnabled: { $ne: true } },
            {
              wholesaleEnabled: true,
              seller: { $in: eligibleWholesaleSellerIds },
              category: { $in: eligibleWholesaleCategoryIds }
            }
          ]
        });
      } else {
        query.wholesaleEnabled = { $ne: true };
      }

      // If location is provided, QC items check nearby sellers, while Ecommerce items ship nationwide
      if (hasUserLocation && nearbySellerIds && nearbySellerIds.length > 0) {
        query.$and.push({
          $or: [
            { productType: "ECOMMERCE" },
            { seller: { $in: nearbySellerIds } }
          ]
        });
      }

      // Only filter by category if categories are explicitly selected or resolved
      if (categoryIds.length > 0) {
        query.category = { $in: categoryIds };
      }

      // Only filter by subcategory if subcategories are explicitly selected
      if (subCategories && subCategories.length > 0) {
        const subCategoryIds = subCategories
          .map((sub: any) => (sub ? sub._id || sub : null))
          .filter(Boolean);

        if (subCategoryIds.length > 0) {
          query.subcategory = { $in: subCategoryIds };
        }
      }

      const products = await Product.find(query)
        .sort({ createdAt: -1 }) // Show newest items first
        .limit(limit || 8)
        .select("productName mainImage price discPrice compareAtPrice mrp discount rating reviewsCount pack seller variations shopId translations productType packageDetails wholesaleEnabled wholesalePrice wholesaleMinimumQuantity")
        .populate("seller", "storeName sellerName viewCustomerDetails")
        .populate("shopId", "name")
        .lean();

      return products.map((p: any) => {
        const sellerIdStr = p.seller ? (typeof p.seller === 'object' && p.seller !== null ? p.seller._id?.toString() : p.seller.toString()) : null;
        const isAvailable = p.productType === 'ECOMMERCE'
          ? true
          : (nearbySellerIds && nearbySellerIds.length > 0 && sellerIdStr
              ? nearbySellerIds.some(id => id && id.toString() === sellerIdStr)
              : false);

        const sellerObj = typeof p.seller === 'object' && p.seller !== null ? p.seller : null;
        const shopObj = typeof p.shopId === 'object' && p.shopId !== null ? p.shopId : null;
        const isSellerVisible = sellerObj ? sellerObj.viewCustomerDetails !== false : true;
        const storeName = isSellerVisible ? (sellerObj?.storeName || sellerObj?.sellerName || null) : null;
        const shopName = shopObj?.name || storeName || null;

        return {
          id: p._id ? p._id.toString() : "",
          productId: p._id ? p._id.toString() : "",
          name: p.productName || "",
          productName: p.productName || "",
          image: p.mainImage || "",
          mainImage: p.mainImage || "",
          price: p.price,
          discPrice: p.discPrice || 0,
          compareAtPrice: p.compareAtPrice || 0,
          mrp: p.compareAtPrice || p.mrp || p.price || 0,
          variations: p.variations || [],
          discount:
            p.discount ||
            ((p.compareAtPrice || p.mrp) && p.price
              ? Math.round((((p.compareAtPrice || p.mrp) - p.price) / (p.compareAtPrice || p.mrp)) * 100)
              : 0),
          productImages: p.mainImage ? [p.mainImage] : [],
          rating: p.rating || 0,
          reviewsCount: p.reviewsCount || 0,
          reviews: p.reviewsCount || 0,
          pack: p.pack || "",
          type: "product",
          productType: p.productType || "QUICK_COMMERCE",
          packageDetails: p.packageDetails,
          wholesaleEnabled: Boolean(p.wholesaleEnabled),
          wholesalePrice: p.wholesalePrice,
          wholesaleMinimumQuantity: p.wholesaleMinimumQuantity,
          isAvailable,
          seller: p.seller,
          storeName,
          shopName,
          translations: p.translations || {},
        };
      });

    }

    // If displayType is "categories", fetch the selected categories themselves
    if (displayType === "categories") {
      // If categories are specified, fetch those specific categories
      if (categories && categories.length > 0) {
        const categoryIds = categories.map((cat: any) => (cat ? (cat._id || cat) : null)).filter(Boolean);

        const fetchedCategories = await Category.find({
          _id: { $in: categoryIds },
          status: "Active",
        })
          .select("name image slug translations")
          .sort({ order: 1 })
          .limit(limit || 8)
          .lean();

        return fetchedCategories.map((c: any) => ({
          id: c._id ? c._id.toString() : "",
          categoryId: c.slug || (c._id ? c._id.toString() : ""), // Use slug for SEO-friendly URLs, fallback to _id
          name: c.name || "",
          image: c.image || "",
          slug: c.slug || "",
          type: "category",
          translations: c.translations || {},
        }));
      } else {
        // If no categories specified, return empty array
        return [];
      }
    }

    return [];
  } catch (error) {
    console.error("Error fetching section data:", error);
    return [];
  }
}

// Get Home Page Content
export const getHomeContent = async (req: Request, res: Response) => {
  const { headerCategorySlug, latitude, longitude } = req.query; // Get header category slug and location from query params

  try {
    // Find sellers within user's location range
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;

    const hasUserLocation =
      userLat !== null &&
      userLng !== null &&
      !isNaN(userLat) &&
      !isNaN(userLng);

    let nearbySellerIds: mongoose.Types.ObjectId[] = [];
    if (hasUserLocation) {
      nearbySellerIds = await findSellersWithinRange(userLat, userLng);
    } else {
      // If no location provided, return empty sellers list to enforce filtering
      nearbySellerIds = [];
    }

    // 1. Featured / Bestsellers - Get bestseller cards from admin configuration
    const bestsellerCards = await BestsellerCard.find({
      isActive: true,
    })
      .populate("category", "name slug image translations")
      .sort({ order: 1 })
      .limit(6)
      .lean();

    // For each bestseller card, get 4 products from the associated category
    const bestsellers = await Promise.all(
      bestsellerCards
        .filter((card: any) => card && card.category)
        .map(async (card: any) => {
          const categoryId = card.category?._id || card.category;
          if (!categoryId) return null;

          // Get category and any child subcategories
          const childCats = await Category.find({ parentId: categoryId }).select("_id").lean();
          const allCategoryIds = [categoryId, ...childCats.map((c: any) => c._id)];

          // Build product query for images
          const productQuery: any = {
            $or: [
              { category: { $in: allCategoryIds } },
              { subcategory: { $in: allCategoryIds } }
            ],
            status: "Active",
            publish: true,
          };

          // When location is known and sellers are in range, prefer preview images for in-range sellers.
          if (hasUserLocation && nearbySellerIds.length > 0) {
            productQuery.seller = { $in: nearbySellerIds };
          }

          // Fetch 4 active products from the category for preview images
          const categoryProducts = await Product.find(productQuery)
            .select("productName mainImage galleryImages translations")
            .sort({ createdAt: -1 })
            .limit(4)
            .lean();

          // Extract exactly 4 product images (prefer mainImage, fallback to galleryImages[0])
          const productImages: string[] = [];
          categoryProducts.forEach((product: any) => {
            if (productImages.length < 4 && product.mainImage) {
              productImages.push(product.mainImage);
            }
          });

          // If we have less than 4 products, try to use gallery images
          if (productImages.length < 4) {
            categoryProducts.forEach((product: any) => {
              if (
                productImages.length < 4 &&
                product.galleryImages &&
                product.galleryImages.length > 0
              ) {
                productImages.push(product.galleryImages[0]);
              }
            });
          }

          // Ensure we have exactly 4 images (pad with first image if needed)
          while (productImages.length < 4 && productImages[0]) {
            productImages.push(productImages[0]);
          }

          return {
            id: card._id ? card._id.toString() : "",
            categoryId: categoryId ? (typeof categoryId === 'object' && categoryId !== null ? categoryId._id?.toString() || "" : categoryId.toString()) : "",
            name: card.name || "",
            productImages: productImages.slice(0, 4),
            productCount: categoryProducts.length,
            translations: card.translations || {},
          };
        })
    );

    const validBestsellers = bestsellers.filter(Boolean);
    const visibleBestsellers = validBestsellers;

    // 2. Lowest Prices Products - Get admin-selected products
    // We fetch these irrespective of location radius to show preview on home page
    const lowestPricesProductsQuery: any = {
      isActive: true,
    };

    const lowestPricesProducts = await LowestPricesProduct.find(
      lowestPricesProductsQuery
    )
      .populate({
        path: "product",
        select:
          "productName mainImage price discPrice compareAtPrice mrp discount status publish category subcategory seller variations shopId translations productType packageDetails wholesaleEnabled wholesalePrice wholesaleMinimumQuantity",
        populate: [
          { path: "seller", select: "storeName sellerName" },
          { path: "shopId", select: "name" },
        ],
        match: {
          status: "Active",
          publish: true,
        },
      })
      .sort({ order: 1 })
      .lean();

    // Filter out any products that were null (due to match condition or deletion)
    const validLowestPricesProducts = lowestPricesProducts
      .filter((item: any) => item && item.product)
      .map((item: any) => {
        const product = item.product;
        const sellerIdStr = product.seller ? (typeof product.seller === 'object' && product.seller !== null ? product.seller._id?.toString() : product.seller.toString()) : null;
        // Check if the product's seller is within range (Ecommerce ships nationwide)
        const isAvailable = product.productType === 'ECOMMERCE'
          ? true
          : (nearbySellerIds && nearbySellerIds.length > 0 && sellerIdStr
              ? nearbySellerIds.some(id => id && id.toString() === sellerIdStr)
              : false);

        const sellerObj = typeof product.seller === 'object' && product.seller !== null ? product.seller : null;
        const shopObj = typeof product.shopId === 'object' && product.shopId !== null ? product.shopId : null;
        const storeName = sellerObj?.storeName || sellerObj?.sellerName || null;
        const shopName = shopObj?.name || storeName || null;

        return {
          id: product._id ? product._id.toString() : "",
          _id: product._id ? product._id.toString() : "",
          productName: product.productName || "",
          name: product.productName || "",
          mainImage: product.mainImage || "",
          imageUrl: product.mainImage || "",
          price: product.price,
          discPrice: product.discPrice || 0,
          compareAtPrice: product.compareAtPrice || product.mrp || product.price,
          mrp: product.mrp || product.compareAtPrice || product.price,
          discount: product.discount || (product.mrp && product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0),
          variations: product.variations || [],
          categoryId: product.category ? (typeof product.category === 'object' && product.category !== null ? product.category._id?.toString() || "" : product.category.toString()) : "",
          subcategory: product.subcategory ? (typeof product.subcategory === 'object' && product.subcategory !== null ? product.subcategory._id?.toString() || "" : product.subcategory.toString()) : "",
          status: product.status,
          publish: product.publish,
          productType: product.productType || "QUICK_COMMERCE",
          packageDetails: product.packageDetails,
          wholesaleEnabled: Boolean(product.wholesaleEnabled),
          wholesalePrice: product.wholesalePrice,
          wholesaleMinimumQuantity: product.wholesaleMinimumQuantity,
          isAvailable,
          seller: product.seller,
          storeName,
          shopName,
          translations: product.translations || {},
        };
      })
      // Show in-range products when sellers exist; when no sellers in range or no location, show preview products
      .filter((p: any) => {
        if (hasUserLocation && nearbySellerIds.length > 0) {
          return p.isAvailable === true;
        }
        return true;
      });

    // 3. Categories for Tiles (Grocery, Snacks, etc)
    const categories = await Category.find({
      status: "Active",
    })
      .select("name image icon color slug translations")
      .sort({ order: 1 });

    // 4. Shop By Store - Fetch real approved, open sellers from database
    const sellerQuery: any = {
      status: "Approved",
      isShopOpen: { $ne: false },
    };

    // Location filtering if user coordinates provided:
    // Ecommerce/Hybrid sellers ship nationwide; Quick Commerce sellers check radius if user location provided
    if (hasUserLocation && nearbySellerIds && nearbySellerIds.length > 0) {
      sellerQuery.$or = [
        { vendorType: { $in: ["ECOMMERCE", "HYBRID"] } },
        { _id: { $in: nearbySellerIds } },
      ];
    }

    const allApprovedSellers = await Seller.find(sellerQuery)
      .select("_id storeName sellerName logo profile storeBanner city vendorType wholesaleEnabled storeDescription category createdAt")
      .lean();

    // Aggregate active products count and preview images per seller
    const sellerProductsAgg = await Product.aggregate([
      {
        $match: {
          status: "Active",
          publish: true,
          seller: { $in: allApprovedSellers.map((s: any) => s._id) },
        },
      },
      {
        $group: {
          _id: "$seller",
          count: { $sum: 1 },
          images: { $push: "$mainImage" },
        },
      },
    ]);

    const productCountMap = new Map<string, number>();
    const previewImagesMap = new Map<string, string[]>();

    sellerProductsAgg.forEach((item: any) => {
      if (item._id) {
        const idStr = item._id.toString();
        productCountMap.set(idStr, item.count || 0);
        const validImgs = (item.images || []).filter((img: string) => img && typeof img === 'string' && img.trim() !== "");
        previewImagesMap.set(idStr, validImgs.slice(0, 4));
      }
    });

    // Map sellers to shop card format
    const realStoreCards = allApprovedSellers.map((seller: any) => {
      const sellerIdStr = seller._id.toString();
      const storeName = seller.storeName || seller.sellerName || "Store";
      const count = productCountMap.get(sellerIdStr) || 0;
      const previewImages = previewImagesMap.get(sellerIdStr) || [];
      const image = seller.logo || seller.profile || seller.storeBanner || (previewImages.length > 0 ? previewImages[0] : "");

      return {
        id: sellerIdStr,
        _id: sellerIdStr,
        name: storeName,
        storeName,
        image,
        logo: seller.logo || seller.profile || "",
        storeBanner: seller.storeBanner || "",
        productImages: previewImages,
        slug: sellerIdStr,
        vendorType: seller.vendorType || "QUICK_COMMERCE",
        wholesaleEnabled: Boolean(seller.wholesaleEnabled),
        city: seller.city || "",
        description: seller.storeDescription || seller.category || "",
        productCount: count,
        bgColor: "bg-neutral-50",
        translations: {},
      };
    });

    // Sort: stores with active products first, then by createdAt desc
    realStoreCards.sort((a: any, b: any) => {
      if (b.productCount !== a.productCount) {
        return b.productCount - a.productCount;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    // Take top 12 for the Home page preview
    const visibleShops = realStoreCards.slice(0, 12);

    // 5. Trending Items (Fetch some popular categories or products)
    const trendingCategories = await Category.find({
      status: "Active",
    })
      .limit(5)
      .select("name image slug translations");

    const trending = trendingCategories.map((c: any) => ({
      id: c._id ? c._id.toString() : "",
      name: c.name || "",
      image: c.image || `/assets/categories/${c.slug}.jpg`,
      type: "category",
      translations: c.translations || {},
    }));

    // 6. Personal Care Subcategories - Now handled by dynamic sections

    // 7. Cooking Ideas (Fetch some products from 'Food' or 'Grocery' categories)
    // We fetch these irrespective of location radius to show preview images
    const foodProductsQuery: any = {
      status: "Active",
      publish: true,
    };

    // When location is known and sellers are in range, prefer preview images for in-range sellers.
    if (hasUserLocation && nearbySellerIds.length > 0) {
      foodProductsQuery.seller = { $in: nearbySellerIds };
    }

    const foodProducts = await Product.find(foodProductsQuery)
      .limit(3)
      .select("productName mainImage translations");

    const cookingIdeas = foodProducts.map((p: any) => ({
      id: p._id ? p._id.toString() : "",
      title: p.productName || "",
      image: p.mainImage || "",
      productId: p._id ? p._id.toString() : "",
      translations: p.translations || {},
    }));

    // 8. Promo Cards (Dynamic - Categories with headerCategoryId)
    // Fetch root categories (parentId: null) that have a headerCategoryId assigned and are Active
    // If headerCategorySlug is provided, filter by that specific header category
    // Include their child categories (subcategories) with images

    // Build query for categories
    const categoryQuery: any = {
      headerCategoryId: { $exists: true, $ne: null },
      status: "Active",
      parentId: null, // Only root categories (not subcategories themselves)
    };

    // If headerCategorySlug is provided, find the header category and filter by it
    if (headerCategorySlug && headerCategorySlug !== "all") {
      const headerCategory = await HeaderCategory.findOne({
        slug: headerCategorySlug,
        status: "Published",
      }).lean();

      if (headerCategory) {
        categoryQuery.headerCategoryId = headerCategory._id;
      }
    }

    const categoriesWithHeaderCategory = await Category.find(categoryQuery)
      .populate("headerCategoryId", "name status translations")
      .sort({ order: 1 })
      .limit(4) // Limit to 4 promo cards
      .lean();

    const promoCards = await Promise.all(
      categoriesWithHeaderCategory.map(async (category: any) => {
        // 1. Get child categories (subcategories) for this category
        const childCategories = await Category.find({
          parentId: category._id,
          status: "Active",
        })
          .select("name image _id translations")
          .sort({ order: 1 })
          .limit(4)
          .lean();

        let subcategoryImages = childCategories
          .map((child: any) => child.image)
          .filter((img: string) => img && img.trim() !== "");

        // 2. Fallback to SubCategory collection
        if (subcategoryImages.length === 0) {
          const legacySubs = await SubCategory.find({ category: category._id })
            .select("image subcategoryImage")
            .limit(4)
            .lean();
          subcategoryImages = legacySubs
            .map((s: any) => s.subcategoryImage || s.image)
            .filter((img: any) => img && typeof img === "string" && img.trim() !== "");
        }

        // 3. Fallback: Fetch actual product images belonging to this category
        if (subcategoryImages.length === 0) {
          const categoryProducts = await Product.find({
            category: category._id,
            status: "Active",
            publish: true,
            mainImage: { $exists: true, $ne: null, $nin: ["", "/placeholder.png"] },
          })
            .select("mainImage")
            .limit(4)
            .lean();

          subcategoryImages = categoryProducts
            .map((p: any) => p.mainImage)
            .filter((img: any) => img && typeof img === "string" && img.trim() !== "");
        }

        // 4. Fallback: Category's own image if available
        if (subcategoryImages.length === 0 && category.image && category.image.trim() !== "") {
          subcategoryImages = [category.image];
        }

        return {
          id: category._id ? category._id.toString() : "",
          badge: "Up to 55% OFF",
          title: category.name || "",
          categoryId: category._id ? category._id.toString() : "",
          slug: category.slug || (category._id ? category._id.toString() : ""),
          bgColor: "bg-yellow-50",
          subcategoryImages: subcategoryImages.slice(0, 4),
          translations: category.translations || {},
        };
      })
    );

    // Fallback to hardcoded cards if no categories with headerCategoryId exist
    const finalPromoCards =
      promoCards.length > 0
        ? promoCards
        : [
          {
            id: "self-care",
            badge: "Up to 55% OFF",
            title: "Self Care & Wellness",
            categoryId: "personal-care",
            bgColor: "bg-yellow-50",
            subcategoryImages: [],
          },
          {
            id: "hot-meals",
            badge: "Up to 55% OFF",
            title: "Hot Meals & Drinks",
            categoryId: "breakfast-instant",
            bgColor: "bg-yellow-50",
            subcategoryImages: [],
          },
          {
            id: "kitchen-essentials",
            badge: "Up to 55% OFF",
            title: "Kitchen Essentials",
            categoryId: "atta-rice",
            bgColor: "bg-yellow-50",
            subcategoryImages: [],
          },
          {
            id: "cleaning-home",
            badge: "Up to 75% OFF",
            title: "Cleaning & Home Needs",
            categoryId: "household",
            bgColor: "bg-yellow-50",
            subcategoryImages: [],
          },
        ];

    // 9. Dynamic Home Sections - Fetch from database
    let homeSectionQuery: any = { isActive: true };

    if (headerCategorySlug && headerCategorySlug !== "all") {
      const headerCategoryForSection = await HeaderCategory.findOne({
        slug: headerCategorySlug,
        status: "Published",
      }).select("_id");

      if (headerCategoryForSection) {
        homeSectionQuery.pageLocation = "Header Category Page";
        homeSectionQuery.targetHeaderCategory = headerCategoryForSection._id;
      } else {
        // If header category not found, return empty sections
        homeSectionQuery = { _id: { $exists: false } };
      }
    } else {
      homeSectionQuery.$or = [
        { pageLocation: "Home Page" },
        { pageLocation: { $exists: false } },
      ];
    }

    const homeSections = await HomeSection.find(homeSectionQuery)
      .populate("categories", "name slug image translations")
      .sort({ order: 1 })
      .lean();

    // Fetch data for each section
    const dynamicSections = await Promise.all(
      homeSections.map(async (section: any) => {
        const sectionData = await fetchSectionData(
          section,
          nearbySellerIds,
          hasUserLocation
        );
        
        return {
          id: section._id ? section._id.toString() : "",
          title: section.title || "",
          slug: section.slug || "",
          displayType: section.displayType,
          columns: section.columns,
          data: sectionData || [],
          translations: section.translations || {},
        };
      })
    );

    // 10. Fetch PromoStrip and Featured Products for the current header category (with caching)
    const currentHeaderCategorySlug = (headerCategorySlug as string) || "all";
    const promoStripCacheKey = `rawPromoStrip-${currentHeaderCategorySlug.toLowerCase()}`;

    // Try to get raw un-mutated doc from cache first
    let rawPromoStrip = cache.get(promoStripCacheKey) as any;

    if (!rawPromoStrip) {
      const now = new Date();
      const promoStripDoc = await PromoStrip.findOne({
        headerCategorySlug: currentHeaderCategorySlug.toLowerCase(),
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
        .populate("categoryCards.categoryId", "name slug image translations")
        .populate({
          path: "featuredProducts",
          select: "productName mainImage mainImageUrl galleryImageUrls galleryImages price discPrice mrp compareAtPrice discount rating reviewsCount seller category subcategory variations translations productType packageDetails wholesaleEnabled wholesalePrice wholesaleMinimumQuantity status publish isShopByStoreOnly stock",
          populate: { path: "seller", select: "storeName sellerName vendorType wholesaleEnabled viewCustomerDetails" },
        })
        .sort({ order: 1 })
        .lean();

      rawPromoStrip = promoStripDoc || null;
      // Cache raw doc for 3 minutes
      cache.set(promoStripCacheKey, rawPromoStrip, 3 * 60 * 1000);
    }

    let promoStrip = null;
    let featuredThisWeekProducts: any[] = [];

    if (rawPromoStrip) {
      // Clone to avoid mutating cached object across different user locations
      promoStrip = JSON.parse(JSON.stringify(rawPromoStrip));

      if (promoStrip.featuredProducts && Array.isArray(promoStrip.featuredProducts)) {
        featuredThisWeekProducts = promoStrip.featuredProducts
          .filter((p: any) => p && typeof p === 'object' && p.status === 'Active' && p.publish !== false)
          .map((p: any) => {
            const sellerObj = typeof p.seller === 'object' && p.seller !== null ? p.seller : null;
            const sellerIdStr = sellerObj?._id ? sellerObj._id.toString() : (p.seller ? p.seller.toString() : null);
            const isAvailable = p.productType === 'ECOMMERCE'
              ? true
              : (nearbySellerIds && nearbySellerIds.length > 0 && sellerIdStr
                  ? nearbySellerIds.some(id => id && id.toString() === sellerIdStr)
                  : false);
            const storeName = sellerObj?.storeName || sellerObj?.sellerName || null;

            return {
              id: p._id ? p._id.toString() : "",
              _id: p._id ? p._id.toString() : "",
              productName: p.productName || "",
              name: p.productName || "",
              mainImage: p.mainImage || p.mainImageUrl || (p.galleryImageUrls && p.galleryImageUrls[0]) || "",
              imageUrl: p.mainImage || p.mainImageUrl || (p.galleryImageUrls && p.galleryImageUrls[0]) || "",
              price: p.price,
              discPrice: p.discPrice || 0,
              compareAtPrice: p.compareAtPrice || p.mrp || p.price,
              mrp: p.mrp || p.compareAtPrice || p.price,
              discount: p.discount || (p.mrp && p.price && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0),
              variations: p.variations || [],
              categoryId: p.category ? (typeof p.category === 'object' && p.category !== null ? p.category._id?.toString() || "" : p.category.toString()) : "",
              subcategory: p.subcategory ? (typeof p.subcategory === 'object' && p.subcategory !== null ? p.subcategory._id?.toString() || "" : p.subcategory.toString()) : "",
              status: p.status,
              publish: p.publish,
              productType: p.productType || "QUICK_COMMERCE",
              packageDetails: p.packageDetails,
              wholesaleEnabled: Boolean(p.wholesaleEnabled),
              wholesalePrice: p.wholesalePrice,
              wholesaleMinimumQuantity: p.wholesaleMinimumQuantity,
              stock: p.stock !== undefined ? p.stock : 999,
              isAvailable,
              seller: p.seller,
              storeName,
              translations: p.translations || {},
            };
          })
          // When sellers are in range, prefer in-range products; otherwise show preview products
          .filter((p: any) => {
            if (hasUserLocation && nearbySellerIds.length > 0) {
              return p.isAvailable === true;
            }
            return true;
          });

        promoStrip.featuredProducts = featuredThisWeekProducts;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        bestsellers: visibleBestsellers,
        lowestPrices: validLowestPricesProducts, // Admin-selected products for LowestPricesEver section
        categories,
        // Dynamic sections created by admin
        homeSections: dynamicSections,
        shops: visibleShops,
        promoBanners: [
          {
            id: 1,
            image:
              "https://img.freepik.com/free-vector/horizontal-banner-template-grocery-sales_23-2149432421.jpg",
            link: "/category/grocery",
          },
          {
            id: 2,
            image:
              "https://img.freepik.com/free-vector/flat-supermarket-social-media-cover-template_23-2149363385.jpg",
            link: "/category/snacks",
          },
        ],
        trending,
        cookingIdeas,
        promoCards: finalPromoCards, // Return dynamic or fallback cards
        promoStrip: promoStrip || null, // PromoStrip data for the current header category
        featuredThisWeek: featuredThisWeekProducts, // Explicit dynamic featured products for FeaturedThisWeek section
      },
    });
  } catch (error: any) {
    console.error("Error in getHomeContent:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching home content",
      error: error.message,
    });
  }
};

// Get All Stores / Vendors (Public with pagination, search, and channel filtering)
export const getAllStores = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 12));
    const search = (req.query.search as string)?.trim();
    const channel = (req.query.channel as string)?.toUpperCase() || "ALL";
    const { latitude, longitude } = req.query;

    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;
    const hasUserLocation = Boolean(userLat && userLng && !isNaN(userLat) && !isNaN(userLng));

    let nearbySellerIds: mongoose.Types.ObjectId[] = [];
    if (hasUserLocation) {
      nearbySellerIds = await findSellersWithinRange(userLat!, userLng!);
    }

    const sellerQuery: any = {
      status: "Approved",
      isShopOpen: { $ne: false },
    };

    // Channel filtering according to existing architecture
    if (channel === "QUICK_COMMERCE") {
      sellerQuery.vendorType = { $in: ["QUICK_COMMERCE", "HYBRID"] };
    } else if (channel === "ECOMMERCE") {
      sellerQuery.vendorType = { $in: ["ECOMMERCE", "HYBRID"] };
    } else if (channel === "WHOLESALE") {
      sellerQuery.wholesaleEnabled = true;
    }

    // Location filtering if user provided coordinates:
    // Ecommerce/Hybrid sellers ship nationwide; QC sellers check radius
    if (hasUserLocation && nearbySellerIds.length > 0) {
      sellerQuery.$or = [
        { vendorType: { $in: ["ECOMMERCE", "HYBRID"] } },
        { _id: { $in: nearbySellerIds } },
      ];
    }

    // Search query
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const searchConditions: any[] = [
        { storeName: searchRegex },
        { sellerName: searchRegex },
        { city: searchRegex },
        { category: searchRegex },
        { storeDescription: searchRegex },
      ];
      if (sellerQuery.$or) {
        sellerQuery.$and = [
          { $or: sellerQuery.$or },
          { $or: searchConditions }
        ];
        delete sellerQuery.$or;
      } else {
        sellerQuery.$or = searchConditions;
      }
    }

    // Fetch all eligible sellers matching query
    const allMatchingSellers = await Seller.find(sellerQuery)
      .select("_id storeName sellerName logo profile storeBanner city vendorType wholesaleEnabled storeDescription category createdAt")
      .lean();

    // Aggregate product counts and preview images
    const sellerIds = allMatchingSellers.map((s: any) => s._id);
    const productAgg = await Product.aggregate([
      {
        $match: {
          status: "Active",
          publish: true,
          seller: { $in: sellerIds },
        },
      },
      {
        $group: {
          _id: "$seller",
          count: { $sum: 1 },
          images: { $push: "$mainImage" },
        },
      },
    ]);

    const countMap = new Map<string, number>();
    const previewMap = new Map<string, string[]>();

    productAgg.forEach((item: any) => {
      if (item._id) {
        const idStr = item._id.toString();
        countMap.set(idStr, item.count || 0);
        const validImgs = (item.images || []).filter((img: string) => img && typeof img === 'string' && img.trim() !== "");
        previewMap.set(idStr, validImgs.slice(0, 4));
      }
    });

    // Format seller cards
    const mappedSellers = allMatchingSellers.map((seller: any) => {
      const sellerIdStr = seller._id.toString();
      const storeName = seller.storeName || seller.sellerName || "Store";
      const productCount = countMap.get(sellerIdStr) || 0;
      const previewImages = previewMap.get(sellerIdStr) || [];
      const image = seller.logo || seller.profile || seller.storeBanner || (previewImages.length > 0 ? previewImages[0] : "");

      return {
        id: sellerIdStr,
        _id: sellerIdStr,
        name: storeName,
        storeName,
        image,
        logo: seller.logo || seller.profile || "",
        storeBanner: seller.storeBanner || "",
        description: seller.storeDescription || seller.category || "",
        vendorType: seller.vendorType || "QUICK_COMMERCE",
        wholesaleEnabled: Boolean(seller.wholesaleEnabled),
        city: seller.city || "",
        productCount,
        productImages: previewImages,
        slug: sellerIdStr,
        createdAt: seller.createdAt,
      };
    });

    // Sort: stores with active products first, then by createdAt desc
    mappedSellers.sort((a: any, b: any) => {
      if (b.productCount !== a.productCount) {
        return b.productCount - a.productCount;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    const total = mappedSellers.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedStores = mappedSellers.slice(startIndex, startIndex + limit);

    return res.status(200).json({
      success: true,
      data: paginatedStores,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Error in getAllStores:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching stores",
      error: error.message,
    });
  }
};

// Get Products for a specific "Store" (Campaign/Collection/Seller)
// Fetch products based on store configuration from database
export const getStoreProducts = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { latitude, longitude } = req.query;
    const isWholesaleMode =
      (req.query.isWholesale as string)?.toLowerCase() === "true" ||
      (req.query.wholesale as string)?.toLowerCase() === "true";

    let query: any = {
      status: "Active",
      publish: true,
      ...(isWholesaleMode ? { wholesaleEnabled: true } : { wholesaleEnabled: { $ne: true } }),
    };

    console.log(`[getStoreProducts] Looking for store with storeId: ${storeId}`);

    let shopData: any = null;

    // 1. Primary Lookup: Direct Seller match by ObjectId, exact storeName, or slug
    const sellerOrConditions: any[] = [];
    if (mongoose.Types.ObjectId.isValid(storeId)) {
      sellerOrConditions.push({ _id: new mongoose.Types.ObjectId(storeId) });
    }
    const cleanSlug = storeId.replace(/-/g, " ").trim();
    sellerOrConditions.push(
      { storeName: new RegExp(`^${cleanSlug}$`, "i") },
      { storeName: new RegExp(`^${storeId.trim()}$`, "i") }
    );

    const directSeller = await Seller.findOne({
      status: "Approved",
      isShopOpen: { $ne: false },
      $or: sellerOrConditions,
    }).lean();

    if (directSeller) {
      console.log(`[getStoreProducts] Direct seller found: ${directSeller.storeName} (${directSeller._id})`);
      shopData = {
        id: directSeller._id.toString(),
        _id: directSeller._id.toString(),
        name: directSeller.storeName || directSeller.sellerName || "Store",
        image: directSeller.storeBanner || directSeller.logo || directSeller.profile || '',
        logo: directSeller.logo || directSeller.profile || '',
        storeBanner: directSeller.storeBanner || '',
        description: directSeller.storeDescription || directSeller.category || '',
        category: directSeller.category ? { name: directSeller.category } : null,
        vendorType: directSeller.vendorType || "QUICK_COMMERCE",
        wholesaleEnabled: Boolean(directSeller.wholesaleEnabled),
        city: directSeller.city || '',
      };
      query.seller = directSeller._id;
    } else {
      // 2. Secondary Lookup: Legacy Shop document
      const shopQuery: any = { isActive: true };
      if (mongoose.Types.ObjectId.isValid(storeId)) {
        shopQuery.$or = [
          { storeId: storeId.toLowerCase() },
          { _id: new mongoose.Types.ObjectId(storeId) }
        ];
      } else {
        shopQuery.storeId = storeId.toLowerCase();
      }

      const shop = await Shop.findOne(shopQuery)
        .populate("category", "_id name slug image")
        .populate("subCategory", "_id name")
        .lean();

      console.log(`[getStoreProducts] Legacy Shop found:`, shop ? { name: shop.name, productsCount: shop.products?.length || 0 } : 'NOT FOUND');

      if (shop) {
        shopData = {
          name: shop.name,
          image: shop.image,
          description: shop.description || '',
          category: shop.category,
        };

        let productIds: mongoose.Types.ObjectId[] = [];
        if (shop.products && shop.products.length > 0) {
          productIds = shop.products.map((p: any) => {
            if (mongoose.Types.ObjectId.isValid(p)) {
              return typeof p === 'string' ? new mongoose.Types.ObjectId(p) : p;
            }
            return p._id ? (typeof p._id === 'string' ? new mongoose.Types.ObjectId(p._id) : p._id) : p;
          }).filter(Boolean);
        }

        const shopId = (shop as any)._id;

        const matchingSeller = await Seller.findOne({
          $or: [
            { storeName: new RegExp(`^${(shop.name || "").trim()}$`, "i") },
            { storeName: new RegExp(`^${storeId.replace(/-/g, " ").trim()}$`, "i") },
            { storeName: new RegExp((shop.name || "").trim().replace(/\s+/g, ".*"), "i") },
          ]
        }).select("_id");

        if (matchingSeller) {
          if (productIds.length > 0) {
            query.$or = [
              { _id: { $in: productIds } },
              { seller: matchingSeller._id }
            ];
          } else {
            query.seller = matchingSeller._id;
          }
        } else if (productIds.length > 0) {
          query._id = { $in: productIds };
        } else {
          const orConditions: any[] = [
            { shopId: shopId },
            { isShopByStoreOnly: true }
          ];

          if (shop.category) {
            const categoryId = (shop.category as any)._id || (shop.category as any);
            orConditions.push({ category: categoryId });

            if (shop.subCategory) {
              const subCategoryId = (shop.subCategory as any)._id || (shop.subCategory as any);
              orConditions.push({ subcategory: subCategoryId });
            }
          }
          query.$or = orConditions;
        }
      } else {
        // Fallback: try to match by category name (legacy support)
      const categoryId = await getCategoryIdByName(storeId);
      if (categoryId) {
        query.category = categoryId;
        // Try to get category details for shop data
        const category = await Category.findById(categoryId).select("name slug image").lean();
        if (category) {
          shopData = {
            name: category.name,
            image: category.image || '',
            description: '',
            category: category,
          };
        }
      } else {
        // No matching shop or category found
        return res.status(200).json({
          success: true,
          data: [],
          shop: null,
          message: "Store not found"
        });
      }
    }
  }

    // Location-based filtering: Only show products from sellers within user's range
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;

    console.log(`[getStoreProducts] User location: lat=${userLat}, lng=${userLng}`);

    let nearbySellerIds: mongoose.Types.ObjectId[] = [];
    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      nearbySellerIds = await findSellersWithinRange(userLat, userLng);
      console.log(`[getStoreProducts] Found ${nearbySellerIds.length} sellers within range`);

      if (nearbySellerIds.length > 0) {
        // Filter products by sellers within range
        query.seller = { $in: nearbySellerIds };
        console.log(`[getStoreProducts] Added seller filter to query`);
      }
    }

    console.log(`[getStoreProducts] Final query:`, JSON.stringify(query, null, 2));

    const products = await Product.find(query)
      .populate("category", "name icon image slug")
      .populate("subcategory", "name")
      .populate("seller", "storeName sellerName vendorType wholesaleEnabled")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean({ virtuals: true });

    const total = await Product.countDocuments(query);

    console.log(`[getStoreProducts] Found ${total} products matching query, returning ${products.length}`);

    return res.status(200).json({
      success: true,
      data: products.map((p: any) => {
        const seller = p.seller;
        const sellerIdStr = seller ? (typeof seller === 'object' && seller !== null ? seller._id?.toString() : String(seller)) : null;
        const isAvailable = nearbySellerIds && nearbySellerIds.length > 0 && sellerIdStr
          ? nearbySellerIds.some((id: any) => id && id.toString() === sellerIdStr)
          : false;
        return { ...p, isAvailable };
      }),
      shop: shopData,
      pagination: {
        page: 1,
        limit: 50,
        total,
        pages: Math.ceil(total / 50),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching store products",
      error: error.message,
    });
  }
};

// Helper
async function getCategoryIdByName(name: string) {
  try {
    const category = await Category.findOne({
      name: { $regex: new RegExp(name, "i") },
      status: "Active"
    }).select("_id");
    return category ? category._id : null;
  } catch (error) {
    console.error("Error finding category by name:", error);
    return null;
  }
}

/**
 * Check if service is available at the given location
 */
export const checkServiceability = async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
        isServiceAvailable: false
      });
    }

    const userLat = parseFloat(latitude as string);
    const userLng = parseFloat(longitude as string);

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates",
        isServiceAvailable: false
      });
    }

    const nearbySellerIds = await findSellersWithinRange(userLat, userLng);

    return res.status(200).json({
      success: true,
      isServiceAvailable: nearbySellerIds.length > 0,
      nearbySellersCount: nearbySellerIds.length
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error checking serviceability",
      error: error.message,
      isServiceAvailable: false
    });
  }
};
