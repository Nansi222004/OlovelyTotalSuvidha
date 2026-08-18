import Order from '../models/Order';
import Customer from '../models/Customer';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 Minutes Expiry
const MAX_OTP_ATTEMPTS = 5;

export const isDeliveryTestMode = (): boolean => {
  return process.env.NODE_ENV !== "production" && String(process.env.DELIVERY_TEST_MODE).trim().toLowerCase() === "true";
};

/**
 * Generate dynamic 4-digit delivery OTP for an order.
 * Invalidates any previous OTP and resets attempt counter.
 */
export async function generateDeliveryOtp(orderId: string): Promise<{ success: boolean; message: string; otp?: string; testMode?: boolean }> {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'Delivered') {
      throw new Error('Order is already delivered');
    }

    const testModeActive = isDeliveryTestMode();

    // Fixed test OTP '9999' when in test mode, else random 4-digit OTP
    const newOtp = testModeActive ? "9999" : Math.floor(1000 + Math.random() * 9000).toString();

    // Set order-specific dynamic OTP with expiry and reset attempts
    order.deliveryOtp = newOtp;
    order.deliveryOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    order.deliveryOtpAttempts = 0;
    await order.save();

    console.log(`[Delivery OTP] ${testModeActive ? 'TEST MODE OTP (9999)' : 'Dynamic OTP'} generated for order ${order.orderNumber}: ${newOtp} (Expires in 10 mins)`);

    return {
      success: true,
      message: testModeActive
        ? 'Development Test Mode: OTP set to 9999.'
        : 'Delivery OTP generated and sent to customer.',
      otp: testModeActive ? '9999' : undefined,
      testMode: testModeActive,
    };
  } catch (error: any) {
    console.error('Error in generateDeliveryOtp:', error);
    throw new Error(error.message || 'Failed to process delivery OTP request');
  }
}

/**
 * Verify delivery OTP checking expiration, attempt limits, and exact match
 */
export async function verifyDeliveryOtp(orderId: string, otp: string): Promise<{ success: boolean; message: string }> {
  try {
    const order = await Order.findById(orderId).populate('customer');

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'Delivered') {
      throw new Error('Order is already delivered');
    }

    // 1. Attempt Limit Protection (Max 5 attempts)
    const currentAttempts = order.deliveryOtpAttempts || 0;
    if (currentAttempts >= MAX_OTP_ATTEMPTS) {
      throw new Error('Too many incorrect OTP attempts. Please request a new OTP.');
    }

    // 2. Expiry Check (10 minutes)
    if (order.deliveryOtpExpiresAt && new Date() > new Date(order.deliveryOtpExpiresAt)) {
      throw new Error('OTP has expired. Please request a new OTP.');
    }

    // Determine expected OTP: Order dynamic OTP first, fallback to Customer permanent OTP
    let expectedOtp = order.deliveryOtp;
    if (!expectedOtp) {
      if (order.customer && typeof order.customer === 'object' && 'deliveryOtp' in order.customer) {
        expectedOtp = (order.customer as any).deliveryOtp;
      } else if (order.customer) {
        const customer = await Customer.findById(order.customer);
        expectedOtp = customer?.deliveryOtp;
      }
    }

    if (!expectedOtp) {
      throw new Error('Customer delivery OTP not found. Please contact support.');
    }

    // Developer bypass for testing
    if ((process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_OTP === 'true') && otp === '9999') {
      order.deliveryOtpVerified = true;
      order.status = 'Delivered';
      order.deliveredAt = new Date();
      order.invoiceEnabled = true;
      order.deliveryOtpAttempts = 0;
      await order.save();

      return {
        success: true,
        message: 'OTP verified successfully. Order marked as delivered.',
      };
    }

    // 3. Verify exact OTP match
    if (expectedOtp !== otp) {
      // Record failed attempt in DB
      order.deliveryOtpAttempts = currentAttempts + 1;
      await order.save();

      const remainingAttempts = MAX_OTP_ATTEMPTS - order.deliveryOtpAttempts;
      if (remainingAttempts <= 0) {
        throw new Error('Too many incorrect OTP attempts. Verification blocked until a new OTP is generated.');
      }

      throw new Error(`Invalid OTP. Please check and try again. (${remainingAttempts} attempts remaining)`);
    }

    // Mark order as delivered on successful verification
    order.deliveryOtpVerified = true;
    order.status = 'Delivered';
    order.deliveredAt = new Date();
    order.invoiceEnabled = true;
    order.deliveryOtpAttempts = 0;
    await order.save();

    return {
      success: true,
      message: 'OTP verified successfully. Order marked as delivered.',
    };
  } catch (error: any) {
    console.error('Error verifying delivery OTP:', error);
    throw new Error(error.message || 'Failed to verify delivery OTP');
  }
}
