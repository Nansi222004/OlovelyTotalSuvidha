import Seller from "../models/Seller";

export interface ResolvedSellerChannel {
  seller: any;
  vendorType?: "QUICK_COMMERCE" | "ECOMMERCE" | "HYBRID";
  activeChannel?: "QUICK_COMMERCE" | "ECOMMERCE";
  isLegacy: boolean;
  isHybrid: boolean;
  isQuickCommerceOnly: boolean;
  isEcommerceOnly: boolean;
}

/**
 * Validates the requested channel against the authenticated seller's vendorType.
 * Rules:
 * - QUICK_COMMERCE seller: QC allowed, ECOMMERCE rejected (403)
 * - ECOMMERCE seller: ECOMMERCE allowed, QC rejected (403)
 * - HYBRID seller: both QC and ECOMMERCE allowed; defaults to QUICK_COMMERCE if not requested
 * - Legacy/missing vendorType: do NOT infer a channel; returns isLegacy = true
 */
export async function resolveAuthorizedSellerChannel(
  sellerId: string | any,
  requestedChannel?: string
): Promise<{
  error?: string;
  statusCode?: number;
  data?: ResolvedSellerChannel;
}> {
  const seller = await Seller.findById(sellerId)
    .select(
      "vendorType categories storeName sellerName shippingConfig address city latitude longitude serviceRadiusKm"
    )
    .lean();
  if (!seller) {
    return { error: "Seller not found", statusCode: 404 };
  }

  const vendorType = seller.vendorType;

  // Legacy seller check (missing vendorType in database)
  if (!vendorType) {
    if (requestedChannel && !["QUICK_COMMERCE", "ECOMMERCE"].includes(requestedChannel)) {
      return { error: "Invalid channel requested", statusCode: 400 };
    }
    if (requestedChannel === "ECOMMERCE") {
      return {
        error: "Legacy seller without configured channel cannot access ECOMMERCE channel",
        statusCode: 403,
      };
    }
    return {
      data: {
        seller,
        vendorType: undefined,
        activeChannel: undefined,
        isLegacy: true,
        isHybrid: false,
        isQuickCommerceOnly: false,
        isEcommerceOnly: false,
      },
    };
  }

  if (requestedChannel && !["QUICK_COMMERCE", "ECOMMERCE"].includes(requestedChannel)) {
    return {
      error: "Channel must be either 'QUICK_COMMERCE' or 'ECOMMERCE'",
      statusCode: 400,
    };
  }

  if (vendorType === "QUICK_COMMERCE") {
    if (requestedChannel && requestedChannel === "ECOMMERCE") {
      return {
        error: "QUICK_COMMERCE seller is not authorized to access ECOMMERCE channel",
        statusCode: 403,
      };
    }
    return {
      data: {
        seller,
        vendorType: "QUICK_COMMERCE",
        activeChannel: "QUICK_COMMERCE",
        isLegacy: false,
        isHybrid: false,
        isQuickCommerceOnly: true,
        isEcommerceOnly: false,
      },
    };
  }

  if (vendorType === "ECOMMERCE") {
    if (requestedChannel && requestedChannel === "QUICK_COMMERCE") {
      return {
        error: "ECOMMERCE seller is not authorized to access QUICK_COMMERCE channel",
        statusCode: 403,
      };
    }
    return {
      data: {
        seller,
        vendorType: "ECOMMERCE",
        activeChannel: "ECOMMERCE",
        isLegacy: false,
        isHybrid: false,
        isQuickCommerceOnly: false,
        isEcommerceOnly: true,
      },
    };
  }

  if (vendorType === "HYBRID") {
    const active =
      requestedChannel === "ECOMMERCE" ? "ECOMMERCE" : "QUICK_COMMERCE";
    return {
      data: {
        seller,
        vendorType: "HYBRID",
        activeChannel: active,
        isLegacy: false,
        isHybrid: true,
        isQuickCommerceOnly: false,
        isEcommerceOnly: false,
      },
    };
  }

  return { error: "Unrecognized vendorType", statusCode: 400 };
}
