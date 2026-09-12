import { Request, Response } from 'express';
import { handleShippingWebhook, getShippingProvider } from '../../../services/shipping/shippingService';

/**
 * Handle Carrier Webhook Events
 * POST /api/v1/shipping/webhook
 */
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const provider = getShippingProvider();

    // Check signature if method is supported
    if (provider.verifyWebhookSignature) {
      const rawBody = (req as any).rawBody || JSON.stringify(payload);
      const isValid = provider.verifyWebhookSignature(req.headers as Record<string, string>, rawBody);
      if (!isValid && process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature',
        });
      }
    }

    const result = await handleShippingWebhook(payload);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Shipping webhook processing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process shipping webhook',
      error: error.message,
    });
  }
};
