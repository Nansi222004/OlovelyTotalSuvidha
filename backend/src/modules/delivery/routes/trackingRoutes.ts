import express from 'express';
import { authenticate, requireApprovedUser } from '../../../middleware/auth';
import { updateDeliveryLocation, updateGeneralLocation, getActiveOrdersTracking, getSellersInRadius } from '../../customer/controllers/trackingController';

const router = express.Router();

// Delivery partner tracking routes (require operational approval)
router.post('/location', authenticate, requireApprovedUser, updateDeliveryLocation);
router.post('/location/general', authenticate, requireApprovedUser, updateGeneralLocation);
router.get('/location/sellers-in-radius', authenticate, requireApprovedUser, getSellersInRadius);
router.get('/active-orders', authenticate, requireApprovedUser, getActiveOrdersTracking);

export default router;
