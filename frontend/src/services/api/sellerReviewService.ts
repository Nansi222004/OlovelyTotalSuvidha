import api from './config';

export interface SellerReview {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  createdAt: string;
  customer: {
    _id: string;
    name: string;
  };
  product: {
    _id: string;
    productName: string;
    mainImage?: string;
    rating?: number;
    reviewsCount?: number;
  };
}

export interface SellerReviewStats {
  avgRating: number;
  totalReviews: number;
  breakdown: Record<number, number>;
}

export interface SellerReviewsResponse {
  success: boolean;
  data: {
    reviews: SellerReview[];
    pagination: {
      total: number;
      page: number;
      pages: number;
      limit: number;
    };
  };
}

export interface SellerReviewStatsResponse {
  success: boolean;
  data: SellerReviewStats;
}

export const getSellerReviews = async (params?: {
  page?: number;
  limit?: number;
  productId?: string;
}): Promise<SellerReviewsResponse> => {
  const response = await api.get<SellerReviewsResponse>('/seller/reviews', { params });
  return response.data;
};

export const getSellerReviewStats = async (): Promise<SellerReviewStatsResponse> => {
  const response = await api.get<SellerReviewStatsResponse>('/seller/reviews/stats');
  return response.data;
};
