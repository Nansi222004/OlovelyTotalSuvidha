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
}

export interface Cart {
  items: CartItem[];
  totalItemCount?: number;
  itemCount?: number;
  total: number;
  estimatedDeliveryFee?: number;
  platformFee?: number;
  freeDeliveryThreshold?: number;
  minimumOrderValue?: number;
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
