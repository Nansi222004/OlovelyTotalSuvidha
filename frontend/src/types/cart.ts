import { Product } from './domain';

export interface CartItem {
  product: Product;
  quantity: number;
  variant?: any;
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
      estimatedDelivery: string;
      deliveryFee: number;
    };
    ecommerce?: {
      items: any[];
      subtotal: number;
      fulfillmentType: string;
      estimatedDelivery: string;
      shippingFee: number;
      note?: string;
    };
  };
}
