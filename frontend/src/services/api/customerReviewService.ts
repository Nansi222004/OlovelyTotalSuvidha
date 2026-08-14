import api from './config';

export interface Review {
  _id: string;
  product: string;
  customer: {
    _id: string;
    name: string;
  };
  rating: number;
  title?: string;
  comment?: string;
  createdAt: string;
  isVerifiedPurchase?: boolean;
}

export interface ReviewStats {
  avgRating: number;
  totalReviews: number;
}

export interface ReviewPagination {
  total: number;
  page: number;
  pages: number;
}

export interface ProductReviewsData {
  reviews: Review[];
  stats: ReviewStats;
  pagination: ReviewPagination;
}

export interface ReviewListResponse {
  success: boolean;
  data: ProductReviewsData;
  message?: string;
}

export interface AddReviewPayload {
  productId: string;
  orderId: string;
  rating: number;
  comment?: string;
  title?: string;
}

/**
 * Get reviews for a product (public)
 */
export const getProductReviews = async (
  productId: string,
  page = 1,
  limit = 5
): Promise<ReviewListResponse> => {
  const response = await api.get<ReviewListResponse>(`/customer/reviews/${productId}`, {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Add a review for a product from a delivered order
 */
export const addReview = async (payload: AddReviewPayload): Promise<{
  success: boolean;
  message?: string;
  data?: Review;
}> => {
  const response = await api.post('/customer/reviews', payload);
  return response.data;
};

/**
 * Check if the current customer already reviewed a product for an order
 */
export const getMyReviewForOrderProduct = async (
  productId: string,
  orderId: string
): Promise<{ success: boolean; data: Review | null }> => {
  const response = await api.get('/customer/reviews/mine', {
    params: { productId, orderId },
  });
  return response.data;
};
