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
}
