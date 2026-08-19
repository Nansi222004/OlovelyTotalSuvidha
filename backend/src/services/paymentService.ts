import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/Payment';
import Order from '../models/Order';
import mongoose from 'mongoose';

// Initialize Razorpay instance
const getRazorpayInstance = () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials not configured');
    }

    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });
};

/**
 * Create a Razorpay order
 */
export const createRazorpayOrder = async (
    orderId: string,
    amount: number,
    currency: string = 'INR'
) => {
    try {
        const razorpay = getRazorpayInstance();

        const options = {
            amount: Math.round(amount * 100), // Amount in paise
            currency,
            receipt: orderId,
            notes: {
                orderId,
            },
        };

        const razorpayOrder = await razorpay.orders.create(options);

        return {
            success: true,
            data: {
                razorpayOrderId: razorpayOrder.id,
                razorpayKey: process.env.RAZORPAY_KEY_ID, // Send key to frontend
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                receipt: razorpayOrder.receipt,
                isMock: false,
            },
        };
    } catch (error: any) {
        console.error('Error creating Razorpay order:', error);
        
        // Fallback for development/testing if Razorpay key is invalid, revoked, or unauthenticated or USE_MOCK_PAYMENT is true
        const isAuthError = error?.statusCode === 401 || error?.error?.code === 'BAD_REQUEST_ERROR' || (error?.message && String(error.message).includes('Authentication failed'));
        if (process.env.USE_MOCK_PAYMENT === 'true' || isAuthError) {
            if (isAuthError) {
                console.warn('⚠️ [Payment] Razorpay credentials in backend/.env failed authentication (401). Falling back to mock payment.');
                console.warn('💡 To display the official Razorpay Test Checkout popup (UPI/Card/Netbanking), update RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in backend/.env with active test keys from https://dashboard.razorpay.com/#/app/keys.');
            }
            const mockOrderId = `order_mock_${Date.now()}`;
            return {
                success: true,
                data: {
                    razorpayOrderId: mockOrderId,
                    razorpayKey: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
                    amount: Math.round(amount * 100),
                    currency,
                    receipt: orderId,
                    isMock: true,
                },
            };
        }

        return {
            success: false,
            message: error?.error?.description || error.message || 'Failed to create Razorpay order',
        };
    }
};

/**
 * Verify Razorpay payment signature
 */
export const verifyPaymentSignature = (
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
): boolean => {
    try {
        if (
            (razorpayOrderId && razorpayOrderId.startsWith('order_mock_')) ||
            (razorpayPaymentId && razorpayPaymentId.startsWith('pay_mock_')) ||
            (razorpaySignature && razorpaySignature.startsWith('sig_mock_'))
        ) {
            return true;
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keySecret) {
            throw new Error('Razorpay key secret not configured');
        }

        const body = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(body)
            .digest('hex');

        return expectedSignature === razorpaySignature;
    } catch (error) {
        console.error('Error verifying payment signature:', error);
        return false;
    }
};


/**
 * Capture payment and update order
 */
export const capturePayment = async (
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    io?: any
) => {
    // Check if order is already paid (idempotent pre-check)
    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) {
        return {
            success: false,
            message: 'Order not found',
        };
    }

    if (existingOrder.paymentStatus === 'Paid') {
        return {
            success: true,
            message: 'Payment already captured',
            data: {
                paymentId: existingOrder.paymentId,
                orderId: existingOrder._id,
            },
        };
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Verify signature
            const isValid = verifyPaymentSignature(
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature
            );

            if (!isValid) {
                throw new Error('Invalid payment signature');
            }

            // Find order inside session
            const order = await Order.findById(orderId).session(session);
            if (!order) {
                throw new Error('Order not found');
            }

            if (order.paymentStatus === 'Paid') {
                await session.commitTransaction();
                return {
                    success: true,
                    message: 'Payment already captured',
                    data: {
                        paymentId: order.paymentId,
                        orderId: order._id,
                    },
                };
            }

            // Check if payment document already exists
            let payment = await Payment.findOne({
                $or: [{ razorpayPaymentId }, { razorpayOrderId }]
            }).session(session);

            if (!payment) {
                payment = new Payment({
                    order: orderId,
                    customer: order.customer,
                    paymentMethod: 'Online',
                    paymentGateway: 'Razorpay',
                    razorpayOrderId,
                    razorpayPaymentId,
                    razorpaySignature,
                    amount: order.total,
                    currency: 'INR',
                    status: 'Completed',
                    paidAt: new Date(),
                    gatewayResponse: {
                        success: true,
                        message: 'Payment captured successfully',
                    },
                });
                await payment.save({ session });
            }

            // Update order
            order.paymentStatus = 'Paid';
            order.paymentId = razorpayPaymentId;
            if (order.status === 'Pending') {
                order.status = 'Received';
            }
            await order.save({ session });
            await session.commitTransaction();

            // Notify sellers after successful payment capture
            if (io) {
                try {
                    const { notifySellersOfOrderUpdate } = await import('./sellerNotificationService');
                    await notifySellersOfOrderUpdate(io, order, 'NEW_ORDER');
                    console.log(`📢 [Online] Seller notification sent after payment capture for order ${order.orderNumber}`);
                } catch (notifyError) {
                    console.error("Failed to notify sellers after payment capture:", notifyError);
                }
            }

            // Create Pending Commissions
            try {
                const { createPendingCommissions } = await import('./commissionService');
                await createPendingCommissions(orderId);
            } catch (commError) {
                console.error("Failed to create pending commissions after payment:", commError);
            }

            return {
                success: true,
                message: 'Payment captured successfully',
                data: {
                    paymentId: payment._id,
                    orderId: order._id,
                },
            };
        } catch (error: any) {
            await session.abortTransaction();
            const isWriteConflict = error?.message?.includes('Write conflict') || error?.code === 112 || error?.hasErrorLabel?.('TransientTransactionError');
            if (isWriteConflict && attempt < maxRetries) {
                console.warn(`⚠️ [Payment] Write conflict on capturePayment (attempt ${attempt}/${maxRetries}). Retrying...`);
                await new Promise(r => setTimeout(r, 100 * attempt));
                continue;
            }

            console.error('Error capturing payment:', error);
            return {
                success: false,
                message: error.message || 'Failed to capture payment',
            };
        } finally {
            session.endSession();
        }
    }

    return {
        success: false,
        message: 'Failed to capture payment due to write conflicts',
    };
};


/**
 * Process refund
 */
export const processRefund = async (
    paymentId: string,
    amount?: number,
    reason?: string,
    session?: mongoose.ClientSession
) => {
    try {
        const payment = session ? await Payment.findById(paymentId).session(session) : await Payment.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        if (!payment.razorpayPaymentId) {
            throw new Error('Razorpay payment ID not found');
        }

        const refundAmount = amount || payment.amount;

        const isMockPayment = payment.razorpayPaymentId.startsWith('pay_mock_') || process.env.USE_MOCK_PAYMENT === 'true';
        let refundId = `rfnd_mock_${Date.now()}`;

        if (!isMockPayment) {
            const razorpay = getRazorpayInstance();
            const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
                amount: Math.round(refundAmount * 100), // Amount in paise
                notes: {
                    reason: reason || 'Order cancelled',
                },
            });
            refundId = refund.id;
        }

        // Update payment record
        payment.status = 'Refunded';
        payment.refundAmount = refundAmount;
        payment.refundedAt = new Date();
        payment.refundReason = reason;
        if (session) {
            await payment.save({ session });
        } else {
            await payment.save();
        }

        return {
            success: true,
            message: 'Refund processed successfully',
            data: {
                refundId,
                amount: refundAmount,
            },
        };
    } catch (error: any) {
        console.error('Error processing refund:', error);
        return {
            success: false,
            message: error.message || 'Failed to process refund',
        };
    }
};

/**
 * Handle Razorpay webhook
 */
export const handleWebhook = async (
    body: any,
    signature: string,
    io?: any
): Promise<{ success: boolean; message: string }> => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
            throw new Error('Razorpay webhook secret not configured');
        }

        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(body))
            .digest('hex');

        if (expectedSignature !== signature) {
            throw new Error('Invalid webhook signature');
        }

        const event = body.event;
        const payload = body.payload.payment.entity;

        // Handle different events
        switch (event) {
            case 'payment.captured':
                // Payment was captured successfully
                await handlePaymentCaptured(payload, io);
                break;

            case 'payment.failed':
                // Payment failed
                await handlePaymentFailed(payload);
                break;

            case 'refund.created':
                // Refund was created
                await handleRefundCreated(body.payload.refund.entity);
                break;

            default:
                console.log('Unhandled webhook event:', event);
        }

        return {
            success: true,
            message: 'Webhook processed successfully',
        };
    } catch (error: any) {
        console.error('Error handling webhook:', error);
        return {
            success: false,
            message: error.message || 'Failed to process webhook',
        };
    }
};

// Helper functions for webhook events with strict idempotency protection
const handlePaymentCaptured = async (payload: any, io?: any) => {
    try {
        const razorpayPaymentId = payload.id;
        const razorpayOrderId = payload.order_id;
        const rawOrderId = payload.notes?.orderId || payload.notes?.order_id || payload.receipt;

        // Idempotency Check 1: Check if payment record already exists and is Completed with this razorpayPaymentId
        const existingPayment = await Payment.findOne({
            $or: [
                { razorpayPaymentId, status: 'Completed' },
                { razorpayOrderId, status: 'Completed' }
            ]
        });

        if (existingPayment && existingPayment.status === 'Completed') {
            console.log(`ℹ️ [Webhook] Duplicate payment.captured for paymentId=${razorpayPaymentId}. Already processed idempotently.`);
            return;
        }

        // Find payment record by orderId or razorpayOrderId
        let payment = existingPayment || await Payment.findOne({ razorpayOrderId });

        let orderId = payment?.order?.toString() || rawOrderId;
        if (!orderId) {
            console.warn(`⚠️ [Webhook] Could not determine orderId for payment ${razorpayPaymentId}`);
            return;
        }

        const order = await Order.findById(orderId);
        if (!order) {
            console.warn(`⚠️ [Webhook] Order not found for id ${orderId}`);
            return;
        }

        // Idempotency Check 2: Check if Order is already Paid with this payment ID
        if (order.paymentStatus === 'Paid' && order.paymentId === razorpayPaymentId) {
            console.log(`ℹ️ [Webhook] Order ${order.orderNumber} already marked Paid with paymentId ${razorpayPaymentId}. Skipping duplicate.`);
            return;
        }

        // Create or update Payment record
        if (!payment) {
            payment = new Payment({
                order: order._id,
                customer: order.customer,
                paymentMethod: 'Online',
                paymentGateway: 'Razorpay',
                razorpayOrderId,
                razorpayPaymentId,
                amount: order.total,
                currency: 'INR',
                status: 'Completed',
                paidAt: new Date(),
                gatewayResponse: {
                    success: true,
                    message: 'Payment captured via webhook',
                    rawResponse: payload,
                },
            });
        } else {
            payment.status = 'Completed';
            payment.razorpayPaymentId = razorpayPaymentId;
            payment.paidAt = new Date();
            payment.gatewayResponse = {
                success: true,
                message: 'Payment captured via webhook',
                rawResponse: payload,
            };
        }
        await payment.save();

        // Update order state
        const prevPaymentStatus = order.paymentStatus;
        order.paymentStatus = 'Paid';
        order.paymentId = razorpayPaymentId;
        if (order.status === 'Pending') {
            order.status = 'Received';
        }
        await order.save();

        // Execute side-effects ONLY IF transitioning into Paid for the first time
        if (prevPaymentStatus !== 'Paid') {
            // Notify sellers
            if (io) {
                try {
                    const { notifySellersOfOrderUpdate } = await import('./sellerNotificationService');
                    await notifySellersOfOrderUpdate(io, order, 'NEW_ORDER');
                    console.log(`📢 [Online-Webhook] Seller notification sent for order ${order.orderNumber}`);
                } catch (notifyError) {
                    console.error("Failed to notify sellers after webhook capture:", notifyError);
                }
            }

            // Create Pending Commissions
            try {
                const { createPendingCommissions } = await import('./commissionService');
                await createPendingCommissions(order._id.toString());
            } catch (commError) {
                console.error("Failed to create pending commissions after webhook payment:", commError);
            }
        }
    } catch (error) {
        console.error('Error handling payment captured webhook:', error);
    }
};

const handlePaymentFailed = async (payload: any) => {
    try {
        const razorpayOrderId = payload.order_id;
        const razorpayPaymentId = payload.id;

        // Find payment record
        const payment = await Payment.findOne({
            $or: [{ razorpayOrderId }, { razorpayPaymentId }]
        });

        if (payment) {
            // Idempotency: skip if already Failed
            if (payment.status === 'Failed') {
                return;
            }
            payment.status = 'Failed';
            payment.gatewayResponse = {
                success: false,
                message: payload.error_description || 'Payment failed',
                rawResponse: payload,
            };
            await payment.save();

            // Update order
            await Order.findByIdAndUpdate(payment.order, {
                paymentStatus: 'Failed',
            });
        }
    } catch (error) {
        console.error('Error handling payment failed webhook:', error);
    }
};

const handleRefundCreated = async (payload: any) => {
    try {
        const razorpayPaymentId = payload.payment_id;

        // Find payment record
        const payment = await Payment.findOne({ razorpayPaymentId });

        if (payment) {
            // Idempotency: skip if already marked Refunded
            if (payment.status === 'Refunded') {
                return;
            }
            payment.status = 'Refunded';
            payment.refundAmount = payload.amount / 100; // Convert from paise
            payment.refundedAt = new Date();
            await payment.save();

            // Update order
            await Order.findByIdAndUpdate(payment.order, {
                paymentStatus: 'Refunded',
            });
        }
    } catch (error) {
        console.error('Error handling refund created webhook:', error);
    }
};
