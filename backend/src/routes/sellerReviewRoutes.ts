import { Router } from 'express';
import {
  getSellerReviews,
  getSellerReviewStats,
} from '../modules/seller/controllers/sellerReviewController';
import { authenticate, requireUserType, requireApprovedUser } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireUserType('Seller'));
router.use(requireApprovedUser);

router.get('/stats', getSellerReviewStats);
router.get('/', getSellerReviews);

export default router;
