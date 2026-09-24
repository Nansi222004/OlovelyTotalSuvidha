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
  const mapsUrl = lat !== undefined && lng !== undefined ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : undefined;

  return {
    formatted,
    cleanAddress,
    cityStatePincode: [city, state, pincode].filter(Boolean).join(", "),
    latitude: lat,
    longitude: lng,
    mapsUrl,
  };
}

export interface ParsedLocationAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  formattedAddress: string;
  placeId?: string;
  rawComponents?: any[];
}

/**
 * Parses Google Maps Geocoder result into standardized address components:
 * - Extracts clean street/area (including street number, route, sublocality, colony) without repeating city/state/pincode
 * - Extracts city (locality), state, 6-digit pincode, landmark, and place_id
 */
export function parseGoogleGeocodeResult(result: any): ParsedLocationAddress {
  if (!result) {
    return {
      street: "",
      city: "",
      state: "",
      pincode: "",
      landmark: "",
      formattedAddress: "",
    };
  }

  const components: any[] = result.address_components || [];
  let streetNumber = "";
  let route = "";
  let sublocality2 = "";
  let sublocality1 = "";
  let neighborhood = "";
  let locality = "";
  let adminArea2 = "";
  let adminArea1 = "";
  let postalCode = "";
  let landmark = "";

  for (const comp of components) {
    const types: string[] = comp.types || [];
    if (types.includes("street_number")) streetNumber = comp.long_name || "";
    else if (types.includes("route")) route = comp.long_name || "";
    else if (types.includes("sublocality_level_2")) sublocality2 = comp.long_name || "";
    else if (types.includes("sublocality_level_1") || types.includes("sublocality")) sublocality1 = comp.long_name || "";
    else if (types.includes("neighborhood")) neighborhood = comp.long_name || "";
    else if (types.includes("locality")) locality = comp.long_name || "";
    else if (types.includes("administrative_area_level_2")) adminArea2 = comp.long_name || "";
    else if (types.includes("administrative_area_level_1")) adminArea1 = comp.long_name || "";
    else if (types.includes("postal_code")) postalCode = comp.long_name || "";
    else if (types.includes("point_of_interest") || types.includes("establishment") || types.includes("premise")) {
      if (!landmark) landmark = comp.long_name || "";
    }
  }

  const city = locality || adminArea2 || sublocality1 || "";
  const state = adminArea1 || "";
  const pincode = postalCode.replace(/\D/g, "");

  // Build clean street/area without duplicating city/state/pincode
  const streetParts: string[] = [];
  if (streetNumber && route) {
    streetParts.push(`${streetNumber} ${route}`);
  } else if (route) {
    streetParts.push(route);
  } else if (streetNumber) {
    streetParts.push(streetNumber);
  }

  if (sublocality2 && !streetParts.includes(sublocality2)) streetParts.push(sublocality2);
  if (sublocality1 && !streetParts.includes(sublocality1) && sublocality1.toLowerCase() !== city.toLowerCase()) {
    streetParts.push(sublocality1);
  }
  if (neighborhood && !streetParts.includes(neighborhood) && neighborhood.toLowerCase() !== city.toLowerCase()) {
    streetParts.push(neighborhood);
  }

  let cleanStreet = streetParts.join(", ").trim();

  // If no street/sublocality parts were extracted, fall back to formatted_address stripped of city/state/country/pincode
  if (!cleanStreet && result.formatted_address) {
    let raw = result.formatted_address;
    // Strip Plus Codes e.g. "8V7V+7X Indore, Madhya Pradesh"
    raw = raw.replace(/^[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}([,\s]+)?/i, "");
    if (pincode) raw = raw.replace(new RegExp(`,?\\s*${pincode}`, "gi"), "");
    if (state) raw = raw.replace(new RegExp(`,?\\s*${state}`, "gi"), "");
    if (city) raw = raw.replace(new RegExp(`,?\\s*${city}`, "gi"), "");
    raw = raw.replace(/,?\s*India/gi, "").replace(/^[,\s]+|[,\s]+$/g, "").trim();
    cleanStreet = raw || result.formatted_address;
  }

  return {
    street: cleanStreet,
    city,
    state,
    pincode,
    landmark,
    formattedAddress: result.formatted_address || "",
    placeId: result.place_id,
    rawComponents: components,
  };
}
