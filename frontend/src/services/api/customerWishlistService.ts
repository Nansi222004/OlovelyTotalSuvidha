import api from "./config";
import { Product } from "./productService";

export interface WishlistResponse {
  success: boolean;
  message?: string;
  data: {
    _id: string;
    customer: string;
    products: Product[];
  };
}

export interface GetWishlistParams {
  latitude?: number;
  longitude?: number;
}

export const getWishlist = async (params?: GetWishlistParams): Promise<WishlistResponse> => {
  const res = await api.get<WishlistResponse>("/customer/wishlist", { params });
  return res.data;
};

export const addToWishlist = async (productId: string, latitude?: number, longitude?: number): Promise<WishlistResponse> => {
  const params: any = {};
  if (latitude !== undefined && longitude !== undefined) {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const res = await api.post<WishlistResponse>("/customer/wishlist", { productId }, { params });
  return res.data;
};

export const removeFromWishlist = async (productId: string): Promise<WishlistResponse> => {
  const res = await api.delete<WishlistResponse>(`/customer/wishlist/${productId}`);
  return res.data;
};

