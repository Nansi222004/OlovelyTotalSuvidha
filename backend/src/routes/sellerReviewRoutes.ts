import { Router } from 'express';
import {
  getSellerReviews,
  getSellerReviewStats,
} from '../modules/seller/controllers/sellerReviewController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireUserType('Seller'));

router.get('/stats', getSellerReviewStats);
router.get('/', getSellerReviews);

export default router;
