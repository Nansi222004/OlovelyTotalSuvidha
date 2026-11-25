import mongoose from "mongoose";
import Seller from "../models/Seller";

/**
 * Helper function to calculate distance between two coordinates (Haversine formula)
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find sellers whose service radius covers the user's location
 * @param userLat User's latitude
 * @param userLng User's longitude
 * @returns Array of seller IDs within range
 */
export async function findSellersWithinRange(
  userLat: number,
  userLng: number
): Promise<mongoose.Types.ObjectId[]> {
  if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
    return [];
  }

  // Validate coordinates
  if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
    return [];
  }

  try {
    // Fetch all approved sellers with location data
    const sellers = await Seller.find({
      status: "Approved",
    }).select("_id location serviceRadiusKm latitude longitude");

    // Filter sellers where user is within their service radius
    const nearbySellerIds: mongoose.Types.ObjectId[] = [];

    for (const seller of sellers) {
      let sellerLat: number | null = null;
      let sellerLng: number | null = null;

      // Try GeoJSON first
      if (seller.location && seller.location.coordinates && seller.location.coordinates.length === 2) {
        sellerLng = seller.location.coordinates[0];
        sellerLat = seller.location.coordinates[1];
      }
      // Fallback to string fields if GeoJSON missing
      else if (seller.latitude && seller.longitude) {
         sellerLat = parseFloat(seller.latitude);
         sellerLng = parseFloat(seller.longitude);
      }

      if (sellerLat !== null && sellerLng !== null && !isNaN(sellerLat) && !isNaN(sellerLng)) {
        const distance = calculateDistance(
          userLat,
          userLng,
          sellerLat,
          sellerLng
        );
        const serviceRadius = seller.serviceRadiusKm || 10; // Default to 10km if not set

        if (distance <= serviceRadius) {
          nearbySellerIds.push(seller._id as mongoose.Types.ObjectId);
        }
      }
    }

    // Platform (admin) stock ships from the platform Quick Commerce warehouse, not from the
    // admin seller account (which has no location). Count the platform seller as "nearby"
    // when the user is inside the warehouse's service radius.
    try {
      const AppSettings = (await import("../models/AppSettings")).default as any;
      const settings: any = await AppSettings.findOne().select("platformQuickCommerceFulfillment").lean();
      const wh = settings?.platformQuickCommerceFulfillment;
      const whLat = Number(wh?.latitude);
      const whLng = Number(wh?.longitude);
      const whRadius = Number(wh?.serviceRadiusKm) || 10;
      if (Number.isFinite(whLat) && Number.isFinite(whLng) && (whLat !== 0 || whLng !== 0)) {
        if (calculateDistance(userLat, userLng, whLat, whLng) <= whRadius) {
          const platformSellers = await Seller.find({
            $or: [
              { isPlatform: true },
              { category: "Admin" },
              { email: "admin-store@olovely.com" },
              { sellerName: "Olovely Admin" },
              { storeName: "Olovely Admin Store" },
            ],
          }).select("_id").lean();
          for (const ps of platformSellers as any[]) {
            if (!nearbySellerIds.some((id) => id.toString() === String(ps._id))) {
              nearbySellerIds.push(ps._id as mongoose.Types.ObjectId);
            }
          }
        }
      }
    } catch (platformError) {
      console.error("Error adding platform warehouse to nearby sellers:", platformError);
    }

    return nearbySellerIds;
  } catch (error) {
    console.error("Error finding nearby sellers:", error);
    return [];
  }
}
