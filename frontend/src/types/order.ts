import { CartItem } from './cart';

export type OrderStatus = 'Received' | 'Accepted' | 'On the way' | 'Delivered' | 'Pending';

export interface OrderAddress {
  name: string;
  phone: string;
  flat: string;
  street: string;
  address?: string; // Add address field for backend compat
  city: string;
  state?: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  id?: string;
  _id?: string;
}

export interface OrderFees {
  platformFee?: number;
  deliveryFee?: number;
}

export interface IFulfillmentGroup {
  groupId: string;
  fulfillmentType: 'LOCAL_DELIVERY' | 'COURIER_SHIPPING' | 'THIRD_PARTY_API';
  status: string;
  items: any[];
  seller?: {
    _id?: string;
    storeName?: string;
    sellerName?: string;
    city?: string;
    phone?: string;
    address?: string;
  } | any;
  deliveryBoy?: {
    _id?: string;
    name?: string;
    mobile?: string;
    phone?: string;
    vehicleNumber?: string;
    profileImage?: string;
  };
  deliveryOtp?: string;
  shippingDetails?: {
    carrier?: string;
    awbNumber?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    shippedAt?: string;
    estimatedDelivery?: string;
  };
  subtotal: number;
  shippingFee: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  fees: OrderFees;
  totalAmount: number;
  address: OrderAddress;
  status: OrderStatus;
  paymentMethod?: string;
  createdAt: string;
  tipAmount?: number;
  donationAmount?: number;
  couponCode?: string;
  giftPackaging?: boolean;
  deliveryOption?: 'Instant' | 'Standard';
  useWallet?: boolean;
  walletAmountUsed?: number;
  orderType?: 'QUICK_COMMERCE' | 'ECOMMERCE' | 'MIXED';
  fulfillmentGroups?: IFulfillmentGroup[];
}


