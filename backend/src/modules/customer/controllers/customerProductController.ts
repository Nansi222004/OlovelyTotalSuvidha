import { Request, Response } from "express";
import Product from "../../../models/Product";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import HeaderCategory from "../../../models/HeaderCategory";
import mongoose from "mongoose";
import Seller from "../../../models/Seller";
import { findSellersWithinRange } from "../../../utils/locationHelper";
import AppSettings from "../../../models/AppSettings";
import { checkWholesaleEligibility } from "../../../utils/categoryChannelHelper";
import { SLUG_ALIASES } from "./customerCategoryController";
import { getCommerceChannels } from "../../../services/commerceChannelService";

// Get products with filtering options (public)
export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      category,
      subcategory,
      search,
      page = 1,
      limit = 20,
      sort,
      minPrice,
      maxPrice,
      brand,
      minDiscount,
      latitude, // User location latitude
      longitude, // User location longitude
      channel,
      productType,
    } = req.query;

    const query: any = {
      status: "Active",
      publish: true,
      // Exclude shop-by-store-only products from category pages
      $or: [
        { isShopByStoreOnly: { $ne: true } },
        { isShopByStoreOnly: { $exists: false } },
      ],
    };

    // Helper to resolve category/subcategory ID from slug or ID
    const resolveId = async (
      model: any,
      value: string,
      modelName: string = ""
    ) => {
      if (!value) return null;

      const baseQuery: any = {};
      if (modelName === "Category") {
        baseQuery.status = "Active";
      } else if (modelName === "HeaderCategory") {
        baseQuery.status = "Published";
      }

      if (mongoose.Types.ObjectId.isValid(value)) {
        const item = await model
          .findOne({ ...baseQuery, _id: value })
          .select("_id")
          .lean();
        if (item) return item._id;
      }

      const slugCandidates = [value];
      const alias = SLUG_ALIASES[value.toLowerCase().trim()];
      if (alias && !slugCandidates.includes(alias)) {
        slugCandidates.push(alias);
      }

      for (const cand of slugCandidates) {
        let item = await model
          .findOne({ ...baseQuery, slug: cand })
          .select("_id")
          .lean();
        if (item) return item._id;

        item = await model
          .findOne({
            ...baseQuery,
            slug: { $regex: new RegExp(`^${cand}$`, "i") },
          })
          .select("_id")
          .lean();
        if (item) return item._id;

        let namePattern = cand.replace(/[-_]/g, " ");
        item = await model
          .findOne({
            ...baseQuery,
            name: { $regex: new RegExp(`^${namePattern}$`, "i") },
          })
          .select("_id")
          .lean();
        if (item) return item._id;

        if ((modelName === "Category" || modelName === "HeaderCategory") && cand.includes("and")) {
          const withAmpersand = cand.replace(/-and-/g, " & ").replace(/-/g, " ");
          item = await model
            .findOne({
              ...baseQuery,
              name: { $regex: new RegExp(`^${withAmpersand}$`, "i") },
            })
            .select("_id")
            .lean();
          if (item) return item._id;
        }
      }

      if (modelName === "HeaderCategory" || modelName === "Category") {
        const words = value.toLowerCase().split(/[-_\s]+/).filter((w: string) => w.length >= 3);
        if (words.length > 0) {
          const items = await model.find(baseQuery).select("_id name slug").lean();
          for (const it of items) {
            const itSlug = (it.slug || "").toLowerCase();
            const itName = (it.name || "").toLowerCase();
            const allMatch = words.every((w: string) => {
              const stem = w.slice(0, 3);
              return itSlug.includes(stem) || itName.includes(stem);
            });
            if (allMatch) return it._id;
          }
        }
      }

      return null;
    };

    if (category) {
      let resolved = false;
      const categoryId = await resolveId(
        Category,
        category as string,
        "Category"
      );
      if (categoryId) {
        resolved = true;
        const categoryDoc = await Category.findById(categoryId).lean();
        if (categoryDoc && categoryDoc.parentId) {
          query.category = categoryDoc.parentId;
          query.subcategory = categoryDoc._id;
        } else {
          query.category = categoryId;
        }
      } else {
        const headerCatId = await resolveId(
          HeaderCategory,
          category as string,
          "HeaderCategory"
        );
        if (headerCatId) {
          resolved = true;
          const childCategories = await Category.find({
            headerCategoryId: headerCatId,
            status: "Active",
          }).select("_id").lean();

          const childCategoryIds = childCategories.map((c: any) => c._id);
          const headerMatch: any[] = [
            { headerCategoryId: headerCatId },
          ];
          if (childCategoryIds.length > 0) {
            headerMatch.push({ category: { $in: childCategoryIds } });
          }
          query.$and = query.$and || [];
          query.$and.push({ $or: headerMatch });
        }
      }

      if (!resolved) {
        query._id = new mongoose.Types.ObjectId();
      }
    }

    if (subcategory) {
      let subcategoryId = await resolveId(
        Category,
        subcategory as string,
        "Category"
      );
      if (!subcategoryId) {
        subcategoryId = await resolveId(
          SubCategory,
          subcategory as string,
          "SubCategory"
        );
      }
      if (subcategoryId) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { subcategory: subcategoryId },
            { category: subcategoryId }
          ]
        });
      }
    }

    const channelAvailability = await getCommerceChannels();

    const targetChannel = ((channel || productType) as string || "").toUpperCase();
    if (targetChannel === 'QUICK_COMMERCE' && !channelAvailability.quickCommerceEnabled) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { page: Number(page), limit: Number(limit), total: 0, pages: 0 },
      });
    }
    if (targetChannel === 'ECOMMERCE' && !channelAvailability.ecommerceEnabled) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { page: Number(page), limit: Number(limit), total: 0, pages: 0 },
      });
    }

    if (targetChannel === 'QUICK_COMMERCE' || targetChannel === 'ECOMMERCE') {
      query.productType = targetChannel;

      // Restrict category to active categories permitting the requested channel
      const permittedCats = await Category.find({
        status: "Active",
        commerceChannels: { $in: [targetChannel] },
      }).select("_id").lean();
      const permittedCatIds = permittedCats.map((c: any) => c._id);

      if (query.category) {
        if (Array.isArray(query.category)) {
          query.category = { $in: query.category.filter((id: any) => permittedCatIds.some(pid => pid.toString() === id.toString())) };
        } else if (typeof query.category === 'object' && (query.category as any).$in) {
          (query.category as any).$in = (query.category as any).$in.filter((id: any) => permittedCatIds.some(pid => pid.toString() === id.toString()));
        } else {
          const isPermitted = permittedCatIds.some(pid => pid.toString() === query.category.toString());
          if (!isPermitted) {
            query.category = new mongoose.Types.ObjectId(); // Non-matching dummy ID
          }
        }
      } else if (!category) {
        query.category = { $in: permittedCatIds };
      }
    } else {
      // If no specific channel requested, but one channel is globally disabled, restrict query to the enabled channel
      if (!channelAvailability.quickCommerceEnabled) {
        query.productType = 'ECOMMERCE';
      } else if (!channelAvailability.ecommerceEnabled) {
        query.productType = 'QUICK_COMMERCE';
      }
    }

    // ── WHOLESALE / RETAIL SHOPPING MODE ENFORCEMENT ───────────────────────
    // Individual retail browsing MUST exclude products where product.wholesaleEnabled === true.
    // Wholesale browsing mode requires:
    // Global wholesale enabled AND Seller wholesaleEnabled AND Category wholesaleEnabled AND Product wholesaleEnabled.
    // In ALL mode: include eligible retail products AND eligible wholesale products.
    const isWholesaleMode =
      (req.query.isWholesale as string)?.toLowerCase() === "true" ||
      (req.query.wholesale as string)?.toLowerCase() === "true" ||
      targetChannel === 'WHOLESALE';
    const isAllMode = targetChannel === 'ALL' || (!targetChannel && !isWholesaleMode);

    if (isAllMode) {
      // ── ALL SHOPPING MODE ────────────────────────────────────────────────
      // Displays eligible retail Quick Commerce, retail Ecommerce, AND eligible wholesale products.
      const appSettings = await AppSettings.findOne().select("wholesaleSettings").lean();
      const globalWholesaleEnabled = appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;

      let eligibleWholesaleSellerIds: mongoose.Types.ObjectId[] = [];
      let eligibleWholesaleCategoryIds: mongoose.Types.ObjectId[] = [];

      if (globalWholesaleEnabled) {
        const [eligibleSellers, eligibleCategories] = await Promise.all([
          Seller.find({ status: "Approved", wholesaleEnabled: true }, { _id: 1 }).lean(),
          Category.find({ status: "Active", wholesaleEnabled: true }, { _id: 1 }).lean(),
        ]);
        eligibleWholesaleSellerIds = eligibleSellers.map((s) => s._id);
        eligibleWholesaleCategoryIds = eligibleCategories.map((c) => c._id);
      }

      // Enforce category-channel compatibility across active categories
      const [qcCats, ecomCats] = await Promise.all([
        Category.find({ status: "Active", commerceChannels: "QUICK_COMMERCE" }, { _id: 1 }).lean(),
        Category.find({ status: "Active", commerceChannels: "ECOMMERCE" }, { _id: 1 }).lean(),
      ]);
      const qcCatIds = qcCats.map((c) => c._id);
      const ecomCatIds = ecomCats.map((c) => c._id);

      const allModeOrBranches: any[] = [];
      if (channelAvailability.quickCommerceEnabled) {
        allModeOrBranches.push({ productType: "QUICK_COMMERCE", category: { $in: qcCatIds } });
        allModeOrBranches.push({ productType: { $exists: false } });
        allModeOrBranches.push({ productType: null });
      }
      if (channelAvailability.ecommerceEnabled) {
        allModeOrBranches.push({ productType: "ECOMMERCE", category: { $in: ecomCatIds } });
      }

      query.$and = query.$and || [];
      query.$and.push({
        $or: allModeOrBranches.length > 0 ? allModeOrBranches : [{ _id: new mongoose.Types.ObjectId() }],
      });

      if (globalWholesaleEnabled && eligibleWholesaleSellerIds.length > 0 && eligibleWholesaleCategoryIds.length > 0) {
        query.$and.push({
          $or: [
            { wholesaleEnabled: { $ne: true } },
            {
              wholesaleEnabled: true,
              seller: { $in: eligibleWholesaleSellerIds },
              category: { $in: eligibleWholesaleCategoryIds },
            },
          ],
        });
      } else {
        query.wholesaleEnabled = { $ne: true };
      }
    } else if (!isWholesaleMode) {
      // Retail mode for individual channels: MUST exclude all wholesaleEnabled products
      query.wholesaleEnabled = { $ne: true };
    } else {
      // Wholesale mode: Enforce ALL 4 GATES server-side
      const appSettings = await AppSettings.findOne();
      const globalWholesaleEnabled = appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;
      if (!globalWholesaleEnabled) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 },
          message: "Wholesale shopping mode is currently disabled globally",
        });
      }

      // Gate 2: Categories must have wholesaleEnabled: true
      const eligibleCategories = await Category.find({ status: "Active", wholesaleEnabled: true }, { _id: 1 }).lean();
      const eligibleCategoryIds = eligibleCategories.map((c) => c._id.toString());
      if (eligibleCategoryIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 },
        });
      }

      // If category filter already exists, intersect with eligible categories
      if (query.category) {
        if (query.category.$in) {
          const existingIds = query.category.$in.map((id: any) => id.toString());
          const intersection = existingIds.filter((id: string) => eligibleCategoryIds.includes(id));
          if (intersection.length === 0) {
            return res.status(200).json({
              success: true,
              data: [],
              pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 },
            });
          }
          query.category = { $in: intersection.map((id: string) => new mongoose.Types.ObjectId(id)) };
        } else {
          const catIdStr = query.category.toString();
          if (!eligibleCategoryIds.includes(catIdStr)) {
            return res.status(200).json({
              success: true,
              data: [],
              pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 },
            });
          }
        }
      } else {
        query.category = { $in: eligibleCategoryIds.map((id) => new mongoose.Types.ObjectId(id)) };
      }

      // Gate 3: Sellers must have wholesaleEnabled: true
      const eligibleSellers = await Seller.find({ status: "Approved", wholesaleEnabled: true }, { _id: 1 }).lean();
      const eligibleSellerIds = eligibleSellers.map((s) => s._id.toString());
      if (eligibleSellerIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 },
        });
      }

      if (query.seller && query.seller.$in) {
        const existingSellerIds = query.seller.$in.map((id: any) => id.toString());
        const sellerIntersection = existingSellerIds.filter((id: string) => eligibleSellerIds.includes(id));
        if (sellerIntersection.length === 0) {
          return res.status(200).json({
            success: true,
            data: [],
            pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 },
          });
        }
        query.seller = { $in: sellerIntersection.map((id: string) => new mongoose.Types.ObjectId(id)) };
      } else {
        query.seller = { $in: eligibleSellerIds.map((id) => new mongoose.Types.ObjectId(id)) };
      }

      // Gate 4: Product wholesaleEnabled: true
      query.wholesaleEnabled = true;
    }
    // ──────────────────────────────────────────────────────────────────────

    // Location-based filtering:
    // Only Quick Commerce products require local rider radius.
    // Ecommerce products are shipped nationwide via courier / Shiprocket and must NEVER be filtered by nearby local store radius.
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;

    let nearbySellerIds: mongoose.Types.ObjectId[] = [];
    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      // Find sellers within user's location range
      nearbySellerIds = await findSellersWithinRange(userLat, userLng);

      if (targetChannel === 'QUICK_COMMERCE') {
        // Quick Commerce strictly requires nearby sellers
        if (nearbySellerIds.length > 0) {
          if (query.seller && query.seller.$in) {
            const intersection = query.seller.$in.filter((id: any) =>
              nearbySellerIds.some((nid) => nid.toString() === id.toString())
            );
            query.seller = { $in: intersection };
          } else {
            query.seller = { $in: nearbySellerIds };
          }
        }
      } else if (targetChannel === 'ECOMMERCE') {
        // Ecommerce products ship nationwide by courier; do NOT filter query.seller by nearbySellerIds
      } else {
        // Channel is ALL or Wholesale (which can be Quick Commerce or Ecommerce)
        if (nearbySellerIds.length > 0) {
          query.$and = query.$and || [];
          query.$and.push({
            $or: [
              { productType: 'ECOMMERCE' },
              { seller: { $in: nearbySellerIds } }
            ]
          });
        }
      }
    }

    if (brand) {
      query.brand = brand;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (minDiscount) {
      query.discount = { $gte: Number(minDiscount) };
    }

    if (search) {
      // Use regex search for partial matching (much better user experience than text search for small catalogs)
      const searchRegex = { $regex: search as string, $options: "i" };
      query.$or = [
        { productName: searchRegex },
        { tags: searchRegex },
        { smallDescription: searchRegex }
      ];
    }

    // Calculate skip for pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Build sort object
    let sortOptions: any = { createdAt: -1 }; // Default new to old
    if (sort === "price_asc") sortOptions = { price: 1 };
    if (sort === "price_desc") sortOptions = { price: -1 };
    if (sort === "discount") sortOptions = { discount: -1 };
    if (sort === "popular") sortOptions = { popular: -1, dealOfDay: -1 };

    const products = await Product.find(query)
      .populate("category", "name icon image")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate("seller", "storeName sellerName viewCustomerDetails")
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    const formattedProducts = products.map((p: any) => {
      const prodObj = p.toObject ? p.toObject() : { ...p };
      const sellerIdStr = prodObj.seller ? (typeof prodObj.seller === "object" ? prodObj.seller._id?.toString() : prodObj.seller.toString()) : null;
      prodObj.productType = prodObj.productType || "QUICK_COMMERCE";
      const isAvailable = prodObj.productType === 'ECOMMERCE'
        ? true
        : (nearbySellerIds && nearbySellerIds.length > 0 && sellerIdStr
            ? nearbySellerIds.some((id) => id && id.toString() === sellerIdStr)
            : false);
      prodObj.isAvailable = isAvailable;

      if (prodObj.seller && typeof prodObj.seller === "object" && prodObj.seller.viewCustomerDetails === false) {
        delete prodObj.seller.storeName;
        delete prodObj.seller.sellerName;
      }
      return prodObj;
    });

    return res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// Get single product by ID (public)
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, channel, productType: queryProductType } = req.query; // User location & channel

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      status: "Active",
      publish: true,
    })
      .populate("category", "name commerceChannels wholesaleEnabled")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate(
        "seller",
        "sellerName storeName city fssaiLicNo address location serviceRadiusKm viewCustomerDetails wholesaleEnabled"
      );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable",
      });
    }

    // ── WHOLESALE / RETAIL SHOPPING MODE ENFORCEMENT ON DIRECT RETRIEVAL ────
    const isWholesaleMode =
      (req.query.isWholesale as string)?.toLowerCase() === "true" ||
      (req.query.wholesale as string)?.toLowerCase() === "true";

    const isAllMode =
      (req.query.mode as string)?.toUpperCase() === "ALL" ||
      (req.query.channel as string)?.toUpperCase() === "ALL" ||
      (req.query.fromAll as string)?.toLowerCase() === "true";

    if (product.wholesaleEnabled === true) {
      // Wholesale-enabled product: MUST NOT be accessible in bare retail mode
      if (!isWholesaleMode && !isAllMode) {
        return res.status(404).json({
          success: false,
          message: "Product not found or unavailable in retail mode",
        });
      }

      // Wholesale mode or arriving from All mode: Re-validate ALL 4 gates
      const appSettings = await AppSettings.findOne();
      const globalWholesaleEnabled = appSettings?.wholesaleSettings?.wholesaleEnabled ?? false;
      const seller = product.seller as any;
      const category = product.category as any;

      const wholesaleEligibility = checkWholesaleEligibility({
        globalWholesaleEnabled,
        sellerWholesaleEnabled: !!seller?.wholesaleEnabled,
        categoryWholesaleEnabled: !!category?.wholesaleEnabled,
        productWholesaleEnabled: true,
      });

      if (!wholesaleEligibility.eligible) {
        return res.status(404).json({
          success: false,
          message: isAllMode
            ? "Product not found or unavailable"
            : "Product not found or unavailable in wholesale mode",
        });
      }
    } else {
      // Retail-only product: MUST NOT be accessible in wholesale mode
      if (isWholesaleMode && !isAllMode) {
        return res.status(404).json({
          success: false,
          message: "Product not found or unavailable in wholesale mode",
        });
      }
    }

    // Server-side Channel & Category Compatibility Enforcement
    const channelAvailability = await getCommerceChannels();
    const requestedChannel = (((channel || queryProductType) as string) || "").toUpperCase();
    const prodType = product.productType || "QUICK_COMMERCE";
    const catChannels: string[] = (product.category as any)?.commerceChannels || [];

    if (prodType === "QUICK_COMMERCE" && !channelAvailability.quickCommerceEnabled) {
      return res.status(404).json({
        success: false,
        message: "Quick Commerce is currently unavailable",
      });
    }
    if (prodType === "ECOMMERCE" && !channelAvailability.ecommerceEnabled) {
      return res.status(404).json({
        success: false,
        message: "E-Commerce is currently unavailable",
      });
    }

    if (requestedChannel === "QUICK_COMMERCE" || requestedChannel === "ECOMMERCE") {
      if (requestedChannel === "QUICK_COMMERCE" && !channelAvailability.quickCommerceEnabled) {
        return res.status(404).json({
          success: false,
          message: "Quick Commerce is currently unavailable",
        });
      }
      if (requestedChannel === "ECOMMERCE" && !channelAvailability.ecommerceEnabled) {
        return res.status(404).json({
          success: false,
          message: "E-Commerce is currently unavailable",
        });
      }

      // 1. Product's productType must match requested channel
      if (prodType !== requestedChannel) {
        return res.status(404).json({
          success: false,
          message: "Product not found or unavailable in this channel",
        });
      }

      // 2. Category's commerceChannels must permit requested channel
      if (catChannels.length > 0 && !catChannels.includes(requestedChannel)) {
        return res.status(404).json({
          success: false,
          message: "Product not found or unavailable in this channel",
        });
      }
    } else {
      // In ALL mode or unconstrained: verify category permits productType if category has channels configured
      if (catChannels.length > 0 && !catChannels.includes(prodType)) {
        return res.status(404).json({
          success: false,
          message: "Product not found or unavailable in this channel",
        });
      }
    }

    // Parse location
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;
    const seller = product.seller as any;

    // Initialize availability flag
    let isAvailableAtLocation = false;

    // Safely get seller ID - handle both populated and unpopulated cases
    let sellerId: mongoose.Types.ObjectId | null = null;
    if (seller) {
      if (typeof seller === "object" && seller._id) {
        // Seller is populated
        sellerId = seller._id;
      } else if (seller instanceof mongoose.Types.ObjectId) {
        // Seller is an ObjectId (not populated)
        sellerId = seller;
      } else if (typeof seller === "string") {
        // Seller is a string ID
        sellerId = new mongoose.Types.ObjectId(seller);
      }
    }

    // Check location availability if coordinates are provided
    if (
      userLat &&
      userLng &&
      !isNaN(userLat) &&
      !isNaN(userLng) &&
      sellerId &&
      seller?.location
    ) {
      const nearbySellerIds = await findSellersWithinRange(userLat, userLng);
      isAvailableAtLocation = nearbySellerIds.some(
        (id) => id.toString() === sellerId!.toString()
      );
    }

    // Find similar products (by category)
    // Filter by location
    const similarProductsQuery: any = {
      _id: { $ne: product._id },
      status: "Active",
      publish: true,
      // Exclude shop-by-store-only products from similar products
      $or: [
        { isShopByStoreOnly: { $ne: true } },
        { isShopByStoreOnly: { $exists: false } },
      ],
    };

    // Safely get category ID - handle both populated and unpopulated cases
    let categoryId: mongoose.Types.ObjectId | null = null;
    if (product.category) {
      if (
        typeof product.category === "object" &&
        (product.category as any)._id
      ) {
        // Category is populated
        categoryId = (product.category as any)._id;
      } else if (product.category instanceof mongoose.Types.ObjectId) {
        // Category is an ObjectId (not populated)
        categoryId = product.category;
      } else if (typeof product.category === "string") {
        // Category is a string ID
        categoryId = new mongoose.Types.ObjectId(product.category);
      }
    }

    // Only add category filter if we have a valid category ID
    if (categoryId) {
      similarProductsQuery.category = categoryId;
    }

    // Filter similar products by location when sellers are in range (only for quick commerce)
    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng) && product.productType !== 'ECOMMERCE') {
      const nearbySellerIds = await findSellersWithinRange(userLat, userLng);
      if (nearbySellerIds.length > 0) {
        similarProductsQuery.seller = { $in: nearbySellerIds };
      }
    }

    const similarProducts = await Product.find(similarProductsQuery)
      .limit(6)
      .select(
        "productName price discPrice compareAtPrice mrp variations mainImage pack discount _id rating reviewsCount wholesaleEnabled wholesalePrice wholesaleMinimumQuantity productType"
      );

    const settings = await AppSettings.getSettings();
    let showSellerDetails = settings?.features?.showSellerDetails !== false;

    const prodObj = product.toObject();
    prodObj.productType = prodObj.productType || "QUICK_COMMERCE";
    if (prodObj.seller && typeof prodObj.seller === "object" && (prodObj.seller as any).viewCustomerDetails === false) {
      showSellerDetails = false;
      delete (prodObj.seller as any).storeName;
      delete (prodObj.seller as any).sellerName;
      delete (prodObj.seller as any).city;
      delete (prodObj.seller as any).address;
    }

    return res.status(200).json({
      success: true,
      data: {
        ...prodObj,
        similarProducts,
        isAvailableAtLocation, // Add availability flag to response
        showSellerDetails, // Add seller visibility flag
      },
    });
  } catch (error: any) {
    console.error("Error in getProductById:", {
      productId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Error fetching product details",
      error: error.message,
    });
  }
};
