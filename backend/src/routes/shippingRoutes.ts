import { Router } from 'express';
import { handleWebhook } from '../modules/shipping/controllers/shippingWebhookController';

const router = Router();

// Carrier Webhook endpoint
router.post('/webhook', handleWebhook);

export default router;
