export interface DeliveryAddressInput {
  address?: string;
  street?: string;
  houseNo?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface FormattedAddressResult {
  formatted: string;
  cleanAddress: string;
  cityStatePincode: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
}

/**
 * Cleanly formats a delivery address snapshot to avoid duplicate city, state, and pincode text.
 * Returns a mapsUrl (Google Maps link) when coordinates are available.
 */
export function formatDeliveryAddress(
  deliveryAddress?: DeliveryAddressInput | null
): FormattedAddressResult {
  if (!deliveryAddress) {
    return {
      formatted: "N/A",
      cleanAddress: "N/A",
      cityStatePincode: "",
    };
  }

  const city = (deliveryAddress.city || "").trim();
  const state = (deliveryAddress.state || "").trim();
  const pincode = (deliveryAddress.pincode || "").trim();
  const rawAddress = (deliveryAddress.address || deliveryAddress.street || "").trim();

  // Clean up "Current Location, " prefix if present
  let cleanAddress = rawAddress.replace(/^Current Location,?\s*/i, "").trim();
  if (!cleanAddress) {
    cleanAddress = rawAddress || [city, state, pincode].filter(Boolean).join(", ");
  }

  // Check if city, state, or pincode are already in the cleanAddress string to prevent duplication
  const lowerClean = cleanAddress.toLowerCase();
  const extraParts: string[] = [];

  if (city && !lowerClean.includes(city.toLowerCase())) {
    extraParts.push(city);
  }
  if (state && !lowerClean.includes(state.toLowerCase())) {
    extraParts.push(state);
  }
  if (pincode && !lowerClean.includes(pincode)) {
    extraParts.push(pincode);
  }

  const parts = [cleanAddress];
  if (extraParts.length > 0) {
    parts.push(extraParts.join(", "));
  }

  const formatted = parts.filter(Boolean).join(", ");

  const lat = typeof deliveryAddress.latitude === "number" && !isNaN(deliveryAddress.latitude) ? deliveryAddress.latitude : undefined;
  const lng = typeof deliveryAddress.longitude === "number" && !isNaN(deliveryAddress.longitude) ? deliveryAddress.longitude : undefined;

  // Generate Google Maps link from coordinates (most precise) 
  const mapsUrl = lat != null && lng != null
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : undefined;

  return {
    formatted,
    cleanAddress,
    cityStatePincode: [city, state, pincode].filter(Boolean).join(", "),
    latitude: lat,
    longitude: lng,
    mapsUrl,
  };
}
