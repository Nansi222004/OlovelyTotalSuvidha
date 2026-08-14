import express from 'express';
import { authenticate } from '../../../middleware/auth';
import { getOrderTracking, getSellerLocationsForOrder } from '../controllers/trackingController';

const router = express.Router();

// Customer tracking routes
router.get('/orders/:orderId/tracking', authenticate, getOrderTracking);
router.get('/orders/:orderId/seller-locations', authenticate, getSellerLocationsForOrder);

export default router;
