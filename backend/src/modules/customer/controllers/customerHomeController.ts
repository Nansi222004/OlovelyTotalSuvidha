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

    // If displayType is "subcategories", fetch subcategories
    // If displayType is "subcategories", fetch subcategories
    // If displayType is "subcategories", fetch subcategories
    if (displayType === "subcategories") {
      let subcategoryQuery: any = {};
      let specificIds: string[] = [];
      let results: any[] = [];
      let parentCategoryIds: string[] = [];

      // If specific subcategories are selected, use them
      if (subCategories && subCategories.length > 0) {
        specificIds = subCategories
          .map((sub: any) => (sub ? (sub._id || sub).toString() : null))
          .filter((id: any) => id);

        if (specificIds.length > 0) {
          subcategoryQuery._id = { $in: specificIds };
        }
      }

      // If no specific subcategories selected, fallback to fetching by parent categories
      if (specificIds.length === 0 && categories && categories.length > 0) {
        parentCategoryIds = categories
          .map((cat: any) => (cat ? (cat._id || cat).toString() : null))
          .filter((id: any) => id);

        if (parentCategoryIds.length > 0) {
          subcategoryQuery.category = { $in: parentCategoryIds };
        }
      }

      // 1. Fetch from SubCategory collection
      if (Object.keys(subcategoryQuery).length > 0) {
        const subcategories = await SubCategory.find(subcategoryQuery)
          .select("name image order category")
          .sort({ order: 1 })
          .limit(limit || 10)
          .lean();

        const mappedSubs = subcategories.map((sub: any) => ({
          id: sub._id.toString(),
          subcategoryId: sub._id.toString(),
          categoryId: sub.category?.toString() || "",
          name: sub.name,
          image: sub.image || "",
          slug: sub.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          type: "subcategory",
        }));

        results.push(...mappedSubs);
      }

      // 2. Fallback or Specific ID check in Category Collection

      // Case A: Specific IDs were provided but not found in SubCategory
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
            .select("name image slug parentId")
            .lean();

          const mappedCats = foundCategories.map((c: any) => {
            const hasParent = c.parentId != null;
            return {
              id: c._id.toString(),
              subcategoryId: hasParent ? c._id.toString() : undefined,
              categoryId: hasParent
                ? c.parentId.toString()
                : c.slug || c._id.toString(),
              name: c.name,
              image: c.image,
              slug: c.slug,
              type: hasParent ? "subcategory" : "category",
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
          .select("name image slug parentId")
          .sort({ order: 1 })
          .limit(limit || 10)
          .lean();

        const mappedChildCats = childCategories.map((c: any) => ({
          id: c._id.toString(),
          subcategoryId: c._id.toString(),
          categoryId: c.parentId.toString(),
          name: c.name,
          image: c.image,
          slug: c.slug,
          type: "subcategory",
        }));

        results.push(...mappedChildCats);
      }

      return results;
    }

    // If displayType is "products", fetch products
    if (displayType === "products") {
      const query: any = {
        status: "Active",
        publish: true,
        // Exclude shop-by-store-only products from home sections
        $or: [
          { isShopByStoreOnly: { $ne: true } },
          { isShopByStoreOnly: { $exists: false } },
        ],
      };

      // If we have a user location and nearby sellers, filter products by seller service radius.
      // Otherwise, show all products but mark availability status.
      if (hasUserLocation && nearbySellerIds && nearbySellerIds.length > 0) {
        query.seller = { $in: nearbySellerIds };
      }

      // Only filter by category if categories are explicitly selected
      if (categories && categories.length > 0) {
        const categoryIds = categories
          .map((cat: any) => (cat ? cat._id || cat : null))
          .filter((id: any) => id);

        if (categoryIds.length > 0) {
          query.category = { $in: categoryIds };
        }
      }

      // Only filter by subcategory if subcategories are explicitly selected
      if (subCategories && subCategories.length > 0) {
        const subCategoryIds = subCategories
          .map((sub: any) => (sub ? sub._id || sub : null))
          .filter((id: any) => id);

        if (subCategoryIds.length > 0) {
          query.subcategory = { $in: subCategoryIds };
        }
      }

      const products = await Product.find(query)
        .sort({ createdAt: -1 }) // Show newest items first
        .limit(limit || 8)
        .select("productName mainImage price discPrice compareAtPrice mrp discount rating reviewsCount pack seller variations shopId")
        .populate("seller", "storeName sellerName viewCustomerDetails")
        .populate("shopId", "name")
        .lean();

      return products.map((p: any) => {
        // If we filtered by radius above, this should always be true when hasUserLocation is set.
        const sellerIdStr = p.seller ? (typeof p.seller === 'object' ? p.seller._id?.toString() : p.seller.toString()) : null;
        const isAvailable = hasUserLocation
          ? true
          : nearbySellerIds && nearbySellerIds.length > 0 && sellerIdStr
            ? nearbySellerIds.some(id => id.toString() === sellerIdStr)
            : false;

        const sellerObj = typeof p.seller === 'object' && p.seller !== null ? p.seller : null;
        const shopObj = typeof p.shopId === 'object' && p.shopId !== null ? p.shopId : null;
        const isSellerVisible = sellerObj ? sellerObj.viewCustomerDetails !== false : true;
        const storeName = isSellerVisible ? (sellerObj?.storeName || sellerObj?.sellerName || null) : null;
        const shopName = shopObj?.name || storeName || null;

        return {
          id: p._id.toString(),
          productId: p._id.toString(),
          name: p.productName,
          productName: p.productName,
          image: p.mainImage,
          mainImage: p.mainImage,
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
          isAvailable,
          seller: p.seller,
          storeName,
          shopName,
        };
      });

    }

    // If displayType is "categories", fetch the selected categories themselves
    if (displayType === "categories") {
      // If categories are specified, fetch those specific categories
      if (categories && categories.length > 0) {
        const categoryIds = categories.map((cat: any) => cat._id || cat);

        const fetchedCategories = await Category.find({
          _id: { $in: categoryIds },
          status: "Active",
        })
          .select("name image slug")
          .sort({ order: 1 })
          .limit(limit || 8)
          .lean();

        return fetchedCategories.map((c: any) => ({
          id: c._id.toString(),
          categoryId: c.slug || c._id.toString(), // Use slug for SEO-friendly URLs, fallback to _id
          name: c.name,
          image: c.image,
          slug: c.slug,
          type: "category",
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
      .populate("category", "name slug image")
      .sort({ order: 1 })
      .limit(6)
      .lean();

    // For each bestseller card, get 4 products from the associated category
    const bestsellers = await Promise.all(
      bestsellerCards.map(async (card: any) => {
        const categoryId = card.category?._id || card.category;

        // Build product query for images (ignore location to show category preview)
        const productQuery: any = {
          category: categoryId,
          status: "Active",
          publish: true,
        };

        // When location is known, only show preview images for in-range sellers.
        if (hasUserLocation) {
          productQuery.seller = { $in: nearbySellerIds };
        }

        // Fetch 4 active products from the category for preview images
        // We fetch these irrespective of location radius to show category preview
        const categoryProducts = await Product.find(productQuery)
          .select("productName mainImage galleryImages")
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
          id: card._id.toString(),
          categoryId: categoryId.toString(),
          name: card.name,
          productImages: productImages.slice(0, 4),
          productCount: categoryProducts.length,
        };
      })
    );

    const visibleBestsellers = hasUserLocation
      ? bestsellers.filter((b: any) => Array.isArray(b.productImages) && b.productImages.length > 0)
      : bestsellers;

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
          "productName mainImage price discPrice compareAtPrice mrp discount status publish category subcategory seller variations shopId",
        populate: [
          { path: "seller", select: "storeName sellerName" },
          { path: "shopId", select: "name" },
        ],
        match: {
          status: "Active",
          publish: true,
          // Removed location filter to show preview images irrespective of radius
        },
      })
      .sort({ order: 1 })
      .lean();

    // Filter out any products that were null (due to match condition)
    const validLowestPricesProducts = lowestPricesProducts
      .filter((item: any) => item.product !== null)
      .map((item: any) => {
        const product = item.product;
        const sellerIdStr = product.seller ? (typeof product.seller === 'object' ? product.seller._id?.toString() : product.seller.toString()) : null;
        // Check if the product's seller is within range
        const isAvailable = nearbySellerIds && nearbySellerIds.length > 0 && sellerIdStr
          ? nearbySellerIds.some(id => id.toString() === sellerIdStr)
          : false;

        const sellerObj = typeof product.seller === 'object' && product.seller !== null ? product.seller : null;
        const shopObj = typeof product.shopId === 'object' && product.shopId !== null ? product.shopId : null;
        const storeName = sellerObj?.storeName || sellerObj?.sellerName || null;
        const shopName = shopObj?.name || storeName || null;

        return {
          id: product._id.toString(),
          _id: product._id.toString(),
          productName: product.productName,
          name: product.productName,
          mainImage: product.mainImage,
          imageUrl: product.mainImage,
          price: product.price,
          discPrice: product.discPrice || 0,
          compareAtPrice: product.compareAtPrice || product.mrp || product.price,
          mrp: product.mrp || product.compareAtPrice || product.price,
          discount: product.discount || (product.mrp && product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0),
          variations: product.variations || [],
          categoryId: product.category?.toString() || "",
          subcategory: product.subcategory?.toString() || "",
          status: product.status,
          publish: product.publish,
          isAvailable,
          seller: product.seller,
          storeName,
          shopName,
        };
      })

      // Strictly hide products from sellers not in range (when location is available).
      .filter((p: any) => !hasUserLocation || p.isAvailable === true);

    // 3. Categories for Tiles (Grocery, Snacks, etc)
    const categories = await Category.find({
      status: "Active",
    })
      .select("name image icon color slug")
      .sort({ order: 1 });

    // 4. Shop By Store - Fetch from database
    const shopDocuments = await Shop.find({ isActive: true })
      .populate("category", "name slug")
      .sort({ order: 1, createdAt: -1 })
      .lean();

    // Transform shop data to match frontend expected format and include preview images
    const shops = await Promise.all(
      shopDocuments.map(async (shop: any) => {
        let productImages: string[] = [];

        if (shop.products && shop.products.length > 0) {
          const shopProducts = await Product.find({
            _id: { $in: shop.products.slice(0, 4) },
            status: "Active",
            publish: true,
            ...(hasUserLocation ? { seller: { $in: nearbySellerIds } } : {}),
          })
            .select("mainImage")
            .lean();

          productImages = shopProducts.map((p: any) => p.mainImage).filter(Boolean);
        }

        return {
          id: shop.storeId || shop._id.toString(),
          name: shop.name,
          image: shop.image,
          productImages, // Include preview images irrespective of location
          slug: shop.storeId || shop._id.toString(),
          category: shop.category,
          productIds: shop.products?.map((p: any) => p.toString()) || [],
          bgColor: shop.bgColor || "bg-neutral-50",
        };
      })
    );

    // When location is known, hide shops that have no in-range products to preview.
    const visibleShops = hasUserLocation
      ? shops.filter((s: any) => Array.isArray(s.productImages) && s.productImages.length > 0)
      : shops;

    // 5. Trending Items (Fetch some popular categories or products)
    const trendingCategories = await Category.find({
      status: "Active",
    })
      .limit(5)
      .select("name image slug");

    const trending = trendingCategories.map((c) => ({
      id: c._id,
      name: c.name,
      image: c.image || `/assets/categories/${c.slug}.jpg`,
      type: "category",
    }));

    // 6. Personal Care Subcategories - Now handled by dynamic sections

    // 7. Cooking Ideas (Fetch some products from 'Food' or 'Grocery' categories)
    // We fetch these irrespective of location radius to show preview images
    const foodProductsQuery: any = {
      status: "Active",
      publish: true,
    };

    // When location is known, only show preview images for in-range sellers.
    if (hasUserLocation) {
      foodProductsQuery.seller = { $in: nearbySellerIds };
    }

    const foodProducts = await Product.find(foodProductsQuery)
      .limit(3)
      .select("productName mainImage");

    const cookingIdeas = foodProducts.map((p) => ({
      id: p._id,
      title: p.productName,
      image: p.mainImage,
      productId: p._id,
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
      .populate("headerCategoryId", "name status")
      .sort({ order: 1 })
      .limit(4) // Limit to 4 promo cards
      .lean();

    const promoCards = await Promise.all(
      categoriesWithHeaderCategory.map(async (category: any) => {
        // Get child categories (subcategories) for this category
        const childCategories = await Category.find({
          parentId: category._id,
          status: "Active",
        })
          .select("name image _id")
          .sort({ order: 1 })
          .limit(4) // Limit to 4 subcategory images
          .lean();

        // Extract subcategory images
        const subcategoryImages = childCategories
          .map((child: any) => child.image)
          .filter((img: string) => img && img.trim() !== "");

        return {
          id: category._id.toString(),
          badge: "Up to 55% OFF", // Default badge, can be customized later
          title: category.name,
          categoryId: category._id.toString(),
          slug: category.slug || category._id.toString(),
          bgColor: "bg-yellow-50",
          subcategoryImages: subcategoryImages.slice(0, 4), // Max 4 images
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
      .populate("categories", "name slug image")
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
          id: section._id.toString(),
          title: section.title,
          slug: section.slug,
          displayType: section.displayType,
          columns: section.columns,
          data: sectionData,
        };
      })
    );

    // 10. Fetch PromoStrip for the current header category (with caching)
    const currentHeaderCategorySlug = (headerCategorySlug as string) || "all";
    const promoStripCacheKey = `promoStrip-${currentHeaderCategorySlug.toLowerCase()}`;

    // Try to get from cache first
    let promoStrip = cache.get(promoStripCacheKey) as any;

    if (!promoStrip) {
      const now = new Date();
      const promoStripDoc = await PromoStrip.findOne({
        headerCategorySlug: currentHeaderCategorySlug.toLowerCase(),
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
        .populate("categoryCards.categoryId", "name slug image")
        .populate("featuredProducts", "productName mainImage mainImageUrl galleryImageUrls galleryImages price discPrice mrp compareAtPrice discount rating reviewsCount seller variations")
        .sort({ order: 1 })
        .lean();

      promoStrip = promoStripDoc;

      // If we have promoStrip, add availability flag to featured products
      if (promoStrip && (promoStrip as any).featuredProducts) {
        (promoStrip as any).featuredProducts = (promoStrip as any).featuredProducts
          .map((p: any) => {
            const isAvailable =
              nearbySellerIds && nearbySellerIds.length > 0 && p.seller
                ? nearbySellerIds.some(id => id.toString() === p.seller.toString())
                : false;
            return { ...p, isAvailable };
          })
          // Strictly hide products from sellers not in range (when location is available).
          .filter((p: any) => !hasUserLocation || p.isAvailable === true);
      }

      // Cache for 3 minutes (PromoStrip data doesn't change frequently)
      if (promoStrip) {
        cache.set(promoStripCacheKey, promoStrip, 3 * 60 * 1000);
      } else {
        // Cache null result for 1 minute to prevent repeated DB queries
        cache.set(promoStripCacheKey, null, 60 * 1000);
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
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching home content",
      error: error.message,
    });
  }
};

// Get Products for a specific "Store" (Campaign/Collection)
// Fetch products based on store configuration from database
export const getStoreProducts = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { latitude, longitude } = req.query; // User location for filtering
    let query: any = {
      status: "Active",
      publish: true,
      // Only show shop-by-store-only products in shop by store section
      isShopByStoreOnly: true,
    };

    console.log(`[getStoreProducts] Looking for shop with storeId: ${storeId}`);

    // Build shop query - only include _id if storeId is a valid ObjectId
    const shopQuery: any = { isActive: true };
    if (mongoose.Types.ObjectId.isValid(storeId)) {
      shopQuery.$or = [
        { storeId: storeId.toLowerCase() },
        { _id: new mongoose.Types.ObjectId(storeId) }
      ];
    } else {
      shopQuery.storeId = storeId.toLowerCase();
    }

    // Find the shop by storeId or _id
    const shop = await Shop.findOne(shopQuery)
      .populate("category", "_id name slug image")
      .populate("subCategory", "_id name")
      .lean();

    console.log(`[getStoreProducts] Shop found:`, shop ? { name: shop.name, productsCount: shop.products?.length || 0, category: shop.category, image: shop.image } : 'NOT FOUND');

    let shopData: any = null;

    if (shop) {
      shopData = {
        name: shop.name,
        image: shop.image,
        description: shop.description || '',
        category: shop.category,
      };

      // Convert products array to ObjectIds if needed
      // When using .lean(), products array contains ObjectIds directly
      let productIds: mongoose.Types.ObjectId[] = [];
      if (shop.products && shop.products.length > 0) {
        productIds = shop.products.map((p: any) => {
          // Handle different formats: ObjectId, string, or object with _id
          if (mongoose.Types.ObjectId.isValid(p)) {
            return typeof p === 'string' ? new mongoose.Types.ObjectId(p) : p;
          }
          return p._id ? (typeof p._id === 'string' ? new mongoose.Types.ObjectId(p._id) : p._id) : p;
        }).filter(Boolean);
      }

      console.log(`[getStoreProducts] Shop has ${productIds.length} products assigned`);

      // Get shop ID for filtering
      const shopId = (shop as any)._id;

      // If shop has specific products assigned, use those
      if (productIds.length > 0) {
        query._id = { $in: productIds };
        // Also filter by shopId to ensure products belong to this shop
        query.shopId = shopId;
        console.log(`[getStoreProducts] Filtering by product IDs: ${productIds.length} products and shopId: ${shopId}`);
      }
      // Otherwise, filter by shopId and category/subcategory
      else {
        // Filter by shopId to show only products assigned to this shop
        query.shopId = shopId;
        console.log(`[getStoreProducts] Filtering by shopId: ${shopId}`);

        if (shop.category) {
          const categoryId = (shop.category as any)._id || (shop.category as any);
          query.category = categoryId;
          console.log(`[getStoreProducts] Also filtering by category: ${categoryId}`);

          // If subcategory is also specified, filter by both
          if (shop.subCategory) {
            const subCategoryId = (shop.subCategory as any)._id || (shop.subCategory as any);
            query.$or = [
              { category: categoryId, shopId: shopId },
              { subcategory: subCategoryId, shopId: shopId },
            ];
            console.log(`[getStoreProducts] Also filtering by subcategory: ${subCategoryId}`);
          }
        }
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

    // Location-based filtering: Only show products from sellers within user's range
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;

    console.log(`[getStoreProducts] User location: lat=${userLat}, lng=${userLng}`);

    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      const nearbySellerIds = await findSellersWithinRange(userLat, userLng);
      console.log(`[getStoreProducts] Found ${nearbySellerIds.length} sellers within range`);

      if (nearbySellerIds.length === 0) {
        // No sellers within range, return shop data but empty products
        console.log(`[getStoreProducts] No sellers in range, returning empty products`);
        return res.status(200).json({
          success: true,
          data: [],
          shop: shopData,
          pagination: {
            page: 1,
            limit: 50,
            total: 0,
            pages: 0,
          },
          message: "No sellers available in your area. Please update your location.",
        });
      }

      // Filter products by sellers within range
      query.seller = { $in: nearbySellerIds };
      console.log(`[getStoreProducts] Added seller filter to query`);
    } else {
      // If no location provided, return empty (require location for marketplace)
      console.log(`[getStoreProducts] No location provided, returning empty products`);
      return res.status(200).json({
        success: true,
        data: [],
        shop: shopData,
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0,
        },
        message: "Location is required to view products. Please enable location access.",
      });
    }

    console.log(`[getStoreProducts] Final query:`, JSON.stringify(query, null, 2));

    const products = await Product.find(query)
      .populate("category", "name icon image")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate("seller", "storeName")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean({ virtuals: true });

    const total = await Product.countDocuments(query);

    console.log(`[getStoreProducts] Found ${total} products matching query, returning ${products.length}`);

    return res.status(200).json({
      success: true,
      data: products.map(p => ({ ...p, isAvailable: true })),
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
