import { useAppSettings } from "../context/AppSettingsContext";

/**
 * Admin → Billing & Charges → "Show Seller Details".
 * When off, the customer app must not show seller/store names or details anywhere
 * (product cards, product page, stores, order tracking, invoices).
 */
export function useShowSellerDetails(): boolean {
  const { settings } = useAppSettings();
  return settings?.features?.showSellerDetails !== false;
}

export default useShowSellerDetails;
