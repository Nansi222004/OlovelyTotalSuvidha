import { calculateDistance } from '../utils/locationHelper';

export const PLATFORM_QC_NOT_CONFIGURED = 'PLATFORM_QC_FULFILLMENT_NOT_CONFIGURED';

export interface PlatformQuickCommerceFulfillment {
  warehouseName?: string;
  warehouseAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm?: number;
}

export type ProductServiceabilityStatus =
  | 'SERVICEABLE'
  | 'UNSERVICEABLE'
  | 'LOCATION_REQUIRED'
  | 'PINCODE_REQUIRED'
  | 'CONFIGURATION_ERROR';

export interface ProductServiceabilityResult {
  channel: 'QUICK_COMMERCE' | 'ECOMMERCE';
  status: ProductServiceabilityStatus;
  isServiceable: boolean | null;
  code?: string;
  message?: string;
  distanceKm?: number;
  serviceRadiusKm?: number;
  source: 'PLATFORM_QC' | 'SELLER_QC' | 'ECOMMERCE_SHIPPING';
}

export interface CustomerProductServiceability {
  channel: 'QUICK_COMMERCE' | 'ECOMMERCE';
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'LOCATION_REQUIRED' | 'PINCODE_REQUIRED';
  isServiceable: boolean | null;
  customerMessage?: string;
}

/**
 * Public/customer APIs must not expose fulfillment origins, distances, radii,
 * or internal configuration error codes. Those details remain available to
 * server-side callers through ProductServiceabilityResult.
 */
export function toCustomerProductServiceability(
  result: ProductServiceabilityResult
): CustomerProductServiceability {
  if (result.status === 'SERVICEABLE') {
    return {
      channel: result.channel,
      availability: 'AVAILABLE',
      isServiceable: true,
    };
  }

  if (result.status === 'LOCATION_REQUIRED') {
    return {
      channel: result.channel,
      availability: 'LOCATION_REQUIRED',
      isServiceable: null,
    };
  }

  if (result.status === 'PINCODE_REQUIRED') {
    return {
      channel: result.channel,
      availability: 'PINCODE_REQUIRED',
      isServiceable: null,
    };
  }

  return {
    channel: result.channel,
    availability: 'UNAVAILABLE',
    isServiceable: false,
    customerMessage: result.channel === 'ECOMMERCE'
      ? 'Courier delivery is not available for this pincode.'
      : 'This service is not available in your location yet.',
  };
}

export function validatePlatformQuickCommerceFulfillment(
  config?: PlatformQuickCommerceFulfillment | null
): { valid: boolean; message?: string } {
  const requiredText: Array<keyof PlatformQuickCommerceFulfillment> = [
    'warehouseName',
    'warehouseAddress',
    'city',
    'state',
    'pincode',
  ];
  if (!config || requiredText.some((key) => !String(config[key] ?? '').trim())) {
    return { valid: false, message: 'Platform Quick Commerce warehouse details are incomplete.' };
  }
  if (!/^[1-9][0-9]{5}$/.test(String(config.pincode).trim())) {
    return { valid: false, message: 'Platform warehouse pincode must be a valid 6-digit Indian pincode.' };
  }
  const latitude = Number(config.latitude);
  const longitude = Number(config.longitude);
  const serviceRadiusKm = Number(config.serviceRadiusKm);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { valid: false, message: 'Platform warehouse latitude must be between -90 and 90.' };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { valid: false, message: 'Platform warehouse longitude must be between -180 and 180.' };
  }
  if (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm < 0.1 || serviceRadiusKm > 300) {
    return { valid: false, message: 'Platform Quick Commerce service radius must be between 0.1 and 300 KM.' };
  }
  return { valid: true };
}

function validCustomerCoordinates(latitude?: number | null, longitude?: number | null) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Number(latitude) >= -90 && Number(latitude) <= 90 &&
    Number(longitude) >= -180 && Number(longitude) <= 180;
}

export function evaluatePlatformQuickCommerce(
  config: PlatformQuickCommerceFulfillment | null | undefined,
  customerLatitude?: number | null,
  customerLongitude?: number | null
): ProductServiceabilityResult {
  const validation = validatePlatformQuickCommerceFulfillment(config);
  if (!validation.valid) {
    return {
      channel: 'QUICK_COMMERCE',
      status: 'CONFIGURATION_ERROR',
      isServiceable: false,
      code: PLATFORM_QC_NOT_CONFIGURED,
      message: validation.message,
      source: 'PLATFORM_QC',
    };
  }
  if (!validCustomerCoordinates(customerLatitude, customerLongitude)) {
    return {
      channel: 'QUICK_COMMERCE',
      status: 'LOCATION_REQUIRED',
      isServiceable: null,
      message: 'Customer latitude and longitude are required for Quick Commerce serviceability.',
      serviceRadiusKm: Number(config!.serviceRadiusKm),
      source: 'PLATFORM_QC',
    };
  }
  const distanceKm = calculateDistance(
    Number(customerLatitude),
    Number(customerLongitude),
    Number(config!.latitude),
    Number(config!.longitude)
  );
  const serviceRadiusKm = Number(config!.serviceRadiusKm);
  const isServiceable = distanceKm <= serviceRadiusKm;
  return {
    channel: 'QUICK_COMMERCE',
    status: isServiceable ? 'SERVICEABLE' : 'UNSERVICEABLE',
    isServiceable,
    distanceKm,
    serviceRadiusKm,
    source: 'PLATFORM_QC',
  };
}

export function evaluateSellerQuickCommerce(
  seller: any,
  customerLatitude?: number | null,
  customerLongitude?: number | null
): ProductServiceabilityResult {
  if (!validCustomerCoordinates(customerLatitude, customerLongitude)) {
    return {
      channel: 'QUICK_COMMERCE',
      status: 'LOCATION_REQUIRED',
      isServiceable: null,
      message: 'Customer latitude and longitude are required for Quick Commerce serviceability.',
      source: 'SELLER_QC',
    };
  }
  const coordinates = seller?.location?.coordinates;
  const sellerLatitude = Array.isArray(coordinates) && coordinates.length === 2
    ? Number(coordinates[1])
    : Number(seller?.latitude);
  const sellerLongitude = Array.isArray(coordinates) && coordinates.length === 2
    ? Number(coordinates[0])
    : Number(seller?.longitude);
  if (!validCustomerCoordinates(sellerLatitude, sellerLongitude)) {
    return {
      channel: 'QUICK_COMMERCE',
      status: 'CONFIGURATION_ERROR',
      isServiceable: false,
      message: 'Seller Quick Commerce location is not configured.',
      source: 'SELLER_QC',
    };
  }
  // Preserve the established seller fallback. Platform QC never uses this default.
  const serviceRadiusKm = Number(seller?.serviceRadiusKm) || 10;
  const distanceKm = calculateDistance(
    Number(customerLatitude),
    Number(customerLongitude),
    sellerLatitude,
    sellerLongitude
  );
  const isServiceable = distanceKm <= serviceRadiusKm;
  return {
    channel: 'QUICK_COMMERCE',
    status: isServiceable ? 'SERVICEABLE' : 'UNSERVICEABLE',
    isServiceable,
    distanceKm,
    serviceRadiusKm,
    source: 'SELLER_QC',
  };
}

export async function evaluateEcommerce(
  pincode: string | null | undefined,
  checkPincode: (pincode: string) => Promise<{ isServiceable: boolean }>
): Promise<ProductServiceabilityResult> {
  const cleanPincode = String(pincode ?? '').trim();
  if (!/^[1-9][0-9]{5}$/.test(cleanPincode)) {
    return {
      channel: 'ECOMMERCE',
      status: 'PINCODE_REQUIRED',
      isServiceable: null,
      message: 'A valid 6-digit delivery pincode is required for Ecommerce serviceability.',
      source: 'ECOMMERCE_SHIPPING',
    };
  }
  const result = await checkPincode(cleanPincode);
  return {
    channel: 'ECOMMERCE',
    status: result.isServiceable ? 'SERVICEABLE' : 'UNSERVICEABLE',
    isServiceable: Boolean(result.isServiceable),
    source: 'ECOMMERCE_SHIPPING',
  };
}
