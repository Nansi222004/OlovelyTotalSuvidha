/**
 * customerBannerService.ts
 * API service for customer-facing dynamic banner retrieval
 */
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

export interface ActiveBanner {
  _id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  commerceSection: string;
  targetType: string;
  targetId?: string;
  ctaText?: string;
  priority: number;
  isFallback?: boolean;
}

export interface CommerceModeBanners {
  [key: string]: ActiveBanner;
  QUICK_COMMERCE: ActiveBanner;
  ECOMMERCE: ActiveBanner;
  WHOLESALE: ActiveBanner;
}

export interface CustomerBannersResult {
  banners: ActiveBanner[];
  isFallback: boolean;
}

/**
 * Fetch active customer banners for a given section.
 * Directly exposes whether real admin banners were returned or the fallback indicator was triggered.
 * @param section - "QUICK_COMMERCE" | "ECOMMERCE" | "WHOLESALE" | "ALL"
 */
export const getCustomerBanners = async (section = "ALL"): Promise<CustomerBannersResult> => {
  try {
    const response = await axios.get(`${API_BASE}/customer/banners`, {
      params: { section },
    });
    const isFallback = Boolean(response.data?.isFallback);
    const rawList: ActiveBanner[] = response.data?.data || [];

    // If backend marked it as fallback, treat as fallback with no admin banners
    if (isFallback) {
      return { banners: [], isFallback: true };
    }

    const realBanners = rawList.filter(
      (b) => !b.isFallback && !b._id?.startsWith("fallback-")
    );

    return {
      banners: realBanners,
      isFallback: realBanners.length === 0,
    };
  } catch (err) {
    // Graceful error handling: return fallback indicator so UI falls back smoothly
    console.warn("Failed to fetch customer banners, falling back to default", err);
    return { banners: [], isFallback: true };
  }
};

/**
 * Fetch active banners for a given section.
 * Falls back to empty list if no active banners found.
 * @param section - "QUICK_COMMERCE" | "ECOMMERCE" | "WHOLESALE" | "ALL"
 */
export const getActiveBanners = async (section = "ALL"): Promise<ActiveBanner[]> => {
  const result = await getCustomerBanners(section);
  return result.banners;
};

/**
 * Convenience helper to fetch active banners for the 3 commerce shopping modes in parallel.
 * Reuses the existing /customer/banners?section=... endpoint without introducing any new backend endpoints.
 */
export const getCommerceModeBanners = async (): Promise<CommerceModeBanners> => {
  const [qc, ec, ws] = await Promise.all([
    getActiveBanners("QUICK_COMMERCE"),
    getActiveBanners("ECOMMERCE"),
    getActiveBanners("WHOLESALE"),
  ]);

  return {
    QUICK_COMMERCE: qc[0] || {
      _id: "fallback-qc",
      title: "Quick Commerce",
      subtitle: "Everyday essentials delivered quickly",
      commerceSection: "QUICK_COMMERCE",
      ctaText: "Shop Quick Commerce",
      targetType: "NONE",
      priority: 0,
    },
    ECOMMERCE: ec[0] || {
      _id: "fallback-ec",
      title: "Ecommerce",
      subtitle: "Shop electronics, fashion, lifestyle & more",
      commerceSection: "ECOMMERCE",
      ctaText: "Explore Ecommerce",
      targetType: "NONE",
      priority: 0,
    },
    WHOLESALE: ws[0] || {
      _id: "fallback-ws",
      title: "Wholesale",
      subtitle: "Bulk shopping with special wholesale pricing",
      commerceSection: "WHOLESALE",
      ctaText: "Shop Wholesale",
      targetType: "NONE",
      priority: 0,
    },
  };
};
