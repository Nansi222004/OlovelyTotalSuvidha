import { Router } from 'express';
import {
  getProductReviews,
  addReview,
  getMyReviewForOrderProduct,
} from '../modules/customer/controllers/productReviewController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

// Check if current customer already reviewed (must be before /:productId)
router.get(
  '/mine',
  authenticate,
  requireUserType('Customer'),
  getMyReviewForOrderProduct
);

// Public route to view reviews
router.get('/:productId', getProductReviews);

// Protected route to add review
router.post('/', authenticate, requireUserType('Customer'), addReview);

export default router;
