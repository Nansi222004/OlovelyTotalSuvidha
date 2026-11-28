import { Product } from './domain';

export interface CartItem {
  id?: string;
  product: Product;
  quantity: number;
  variant?: any;
  isWholesale?: boolean;
  wholesalePrice?: number;
  wholesaleMinimumQuantity?: number;
  price?: number;
  availableStock?: number;
  isOutOfStock?: boolean;
  isInsufficientStock?: boolean;
  isStockBelowMoq?: boolean;
  variantTitle?: string;
}

export interface Cart {
  items: CartItem[];
  totalItemCount?: number;
  itemCount?: number;
  total: number;
  estimatedDeliveryFee?: number;
  qcDeliveryFee?: number;
  ecomShippingFee?: number;
  platformFee?: number;
  freeDeliveryThreshold?: number;
  minimumOrderValue?: number;
  /** Small cart fee charged on this cart (0 = none). Server-computed. */
  smallCartFee?: number;
  /** Quick Commerce value still needed to avoid the small cart fee. */
  amountToAvoidSmallCartFee?: number;
  /** Fee the admin configured (shown in the "add more" hint). */
  configuredSmallCartFee?: number;
  /** Courier free-shipping threshold (0 = follows freeDeliveryThreshold). */
  ecomFreeShippingThreshold?: number;
  amountToFreeCourierShipping?: number;
  firstOrderFreeShippingEligible?: boolean;
  firstOrderFreeShippingApplied?: boolean;
  normalEstimatedDeliveryFee?: number;
  shippingDiscount?: number;
  debug_config?: any;
  backendTotal?: number;
  groups?: {
    quickCommerce?: {
      items: any[];
      subtotal: number;
      fulfillmentType: string;
      estimatedDelivery?: string;
      estimatedDeliveryTime?: string;
      deliveryFee: number;
    };
    ecommerce?: {
      items: any[];
      subtotal: number;
      fulfillmentType: string;
      estimatedDelivery?: string;
      estimatedDeliveryTime?: string;
      shippingFee: number;
      note?: string;
    };
  };
}
