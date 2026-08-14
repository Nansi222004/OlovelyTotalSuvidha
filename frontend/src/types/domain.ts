export interface Category {
  id: string;
  _id?: string;
  name: string;
  slug?: string;
  icon?: string; // emoji or small label
  imageUrl?: string; // optional imported image path
}

export interface Product {
  id: string;
  _id?: string;
  name: string;
  productName?: string;
  description?: string;
  smallDescription?: string;
  pack: string;
  price: number;
  mrp?: number;
  discPrice?: number;
  variations?: Array<{
    title?: string; // made optional as per user data which has name/value
    name?: string;
    value?: string;
    price: number;
    discPrice?: number;
    stock?: number;
    status?: string;
    _id?: { $oid: string } | string;
  }>;
  imageUrl?: string;
  mainImage?: string;
  categoryId: string;
  category?: Category;
  tags?: string[];
  rating?: number;
  reviews?: number;
  reviewsCount?: number;
  deliveryTime?: number;
  stock?: number;
  publish?: boolean;
  status?: string;
  madeIn?: string;
  manufacturer?: string;
  fssaiLicNo?: string;
  isReturnable?: boolean;
  maxReturnDays?: number;
  sellerId?: string;
  seller?: {
    _id?: string;
    id?: string;
    sellerName?: string;
    storeName?: string;
    viewCustomerDetails?: boolean;
    city?: string;
  } | string;
  storeName?: string;
  shopName?: string;
  shop?: {
    _id?: string;
    name?: string;
  };
  isAvailable?: boolean;
}


