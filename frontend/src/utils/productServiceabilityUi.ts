export interface CustomerProductServiceability {
  channel: 'QUICK_COMMERCE' | 'ECOMMERCE';
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'LOCATION_REQUIRED' | 'PINCODE_REQUIRED';
  isServiceable: boolean | null;
  customerMessage?: string;
}

export function shouldShowQuickDelivery(
  productType: string | undefined,
  serviceability: CustomerProductServiceability | null | undefined
): boolean {
  return productType !== 'ECOMMERCE' && serviceability?.isServiceable === true;
}

export function getCustomerServiceabilityMessage(productType?: string): string {
  return productType === 'ECOMMERCE'
    ? 'Courier delivery is not available for this pincode.'
    : 'This service is not available in your location yet.';
}

export function getCustomerServiceabilityTitle(productType?: string): string {
  return productType === 'ECOMMERCE'
    ? 'Courier delivery unavailable for this pincode'
    : 'Currently unavailable in your location';
}

export function isPlatformQuickCommerceConfigured(config: any): boolean {
  if (!config) return false;
  const requiredText = ['warehouseName', 'warehouseAddress', 'city', 'state', 'pincode'];
  if (requiredText.some((key) => !String(config[key] ?? '').trim())) return false;
  if (!/^[1-9][0-9]{5}$/.test(String(config.pincode).trim())) return false;

  const latitude = Number(config.latitude);
  const longitude = Number(config.longitude);
  const radius = Number(config.serviceRadiusKm);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && Number.isFinite(radius) && radius >= 0.1 && radius <= 300;
}

export function shouldShowPlatformQcAdminWarning(
  sellerId: string | undefined,
  productType: string | undefined,
  platformQcConfigured: boolean | null
): boolean {
  return sellerId === 'admin'
    && productType === 'QUICK_COMMERCE'
    && platformQcConfigured === false;
}
