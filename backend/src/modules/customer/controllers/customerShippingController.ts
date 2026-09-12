import { Request, Response } from 'express';
import { checkPincode, getShipmentTracking } from '../../../services/shipping/shippingService';

/**
 * Check Pincode Serviceability for Ecommerce
 * GET /api/v1/customer/shipping/serviceability?pincode=110001
 */
export const checkPincodeServiceability = async (req: Request, res: Response) => {
  try {
    const { pincode } = req.query;
    const cleanPincode = typeof pincode === 'string' ? pincode.trim() : '';

    if (!cleanPincode) {
      return res.status(400).json({
        success: false,
        message: 'Pincode query parameter is required',
        data: {
          isServiceable: false,
          pincode: cleanPincode,
          estimatedDays: null,
          shippingFee: null,
          courierName: null,
        },
      });
    }

    // Validate 6-digit Indian pincode format (100000 - 999999)
    if (!/^[1-9][0-9]{5}$/.test(cleanPincode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Indian pincode format: must be a 6-digit number starting with 1-9',
        data: {
          isServiceable: false,
          serviceable: false,
          pincode: cleanPincode,
          estimatedDays: null,
          shippingFee: null,
          courierName: null,
        },
      });
    }

    const result = await checkPincode(cleanPincode);

    // Return normalized DTO without exposing raw provider details
    return res.status(200).json({
      success: true,
      data: {
        isServiceable: Boolean(result.isServiceable),
        serviceable: Boolean(result.isServiceable),
        pincode: result.pincode,
        estimatedDays: result.estimatedDeliveryDays ?? null,
        estimatedDeliveryDays: result.estimatedDeliveryDays ?? null,
        shippingFee: result.shippingFee ?? null,
        courierName: result.courierName ?? null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to check pincode serviceability',
      error: error.message,
    });
  }
};

/**
 * Get Tracking for an Ecommerce Shipment
 * GET /api/v1/customer/shipping/tracking/:awbNumber
 */
export const getTracking = async (req: Request, res: Response) => {
  try {
    const { awbNumber } = req.params;

    if (!awbNumber) {
      return res.status(400).json({
        success: false,
        message: 'AWB Number is required',
      });
    }

    const tracking = await getShipmentTracking(awbNumber);

    return res.status(200).json({
      success: true,
      data: tracking,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tracking details',
      error: error.message,
    });
  }
};
