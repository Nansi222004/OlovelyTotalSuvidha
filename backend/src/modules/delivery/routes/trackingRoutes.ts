import express from 'express';
import { authenticate } from '../../../middleware/auth';
import { updateDeliveryLocation, updateGeneralLocation, getActiveOrdersTracking, getSellersInRadius } from '../../customer/controllers/trackingController';

const router = express.Router();

// Delivery partner tracking routes
router.post('/location', authenticate, updateDeliveryLocation);
router.post('/location/general', authenticate, updateGeneralLocation);
router.get('/location/sellers-in-radius', authenticate, getSellersInRadius);
router.get('/active-orders', authenticate, getActiveOrdersTracking);

export default router;
