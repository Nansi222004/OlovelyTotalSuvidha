import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/Payment';
import Order from '../models/Order';
import mongoose from 'mongoose';
import { getOnlineAmountDue } from './financeMath';

let transactionsSupported: boolean | null = null;

/**
 * Mock payments (order_mock_/pay_mock_/sig_mock_ identifiers) are a development aid only.
 * They must NEVER be accepted in production: otherwise any client can mark an order Paid
 * (or clear a delivery partner's COD debt) by sending a "pay_mock_..." id.
 */
export const isMockPaymentAllowed = (): boolean => process.env.NODE_ENV !== 'production';

const isMockIdentifier = (razorpayOrderId?: string, razorpayPaymentId?: string, razorpaySignature?: string) =>
    Boolean(
        (razorpayOrderId && razorpayOrderId.startsWith('order_mock_')) ||
        (razorpayPaymentId && razorpayPaymentId.startsWith('pay_mock_')) ||
        (razorpaySignature && razorpaySignature.startsWith('sig_mock_'))
    );

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

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
        if (isMockPaymentAllowed() && (process.env.USE_MOCK_PAYMENT === 'true' || isAuthError)) {
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
        if (isMockIdentifier(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
            // Never trust mock identifiers outside development/test.
            return isMockPaymentAllowed();
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
 * Ask Razorpay what was actually paid for (razorpayOrderId, razorpayPaymentId).
 * Returns null for allowed mock payments (development only). Throws when the payment
 * cannot be confirmed, is not captured, or does not belong to the given Razorpay order.
 */
export const fetchGatewayPaidAmount = async (
    razorpayOrderId: string,
    razorpayPaymentId: string,
    expectedReceiptPrefix?: string
): Promise<{ amount: number; receipt: string } | null> => {
    if (isMockIdentifier(razorpayOrderId, razorpayPaymentId)) {
        if (!isMockPaymentAllowed()) throw new Error('Mock payments are not accepted');
        return null;
    }
    const razorpay = getRazorpayInstance();
    const [payDetails, rzpOrder]: any[] = await Promise.all([
        razorpay.payments.fetch(razorpayPaymentId),
        razorpay.orders.fetch(razorpayOrderId),
    ]);
    if (payDetails?.order_id !== razorpayOrderId) {
        throw new Error('Payment does not belong to this payment order');
    }
    const receipt = String(rzpOrder?.receipt || '');
    if (expectedReceiptPrefix && !receipt.startsWith(expectedReceiptPrefix)) {
        throw new Error('Payment order does not belong to this account');
    }
    let status = payDetails.status;
    if (status === 'authorized') {
        await razorpay.payments.capture(razorpayPaymentId, Number(payDetails.amount), 'INR');
        status = 'captured';
    }
    if (status !== 'captured') {
        throw new Error(`Payment is not captured (status: ${status})`);
    }
    return { amount: round2(Number(payDetails.amount) / 100), receipt };
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

    // Verify signature first
    const isValid = verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    );

    if (!isValid) {
        console.error(`❌ [PAYMENT VERIFY FAILED] Order ID: ${orderId}, Razorpay Order ID: ${razorpayOrderId}`);
        return {
            success: false,
            message: 'Invalid payment signature',
        };
    }

    // A valid signature only proves (razorpayOrderId, razorpayPaymentId) belong together.
    // It does NOT prove they belong to *this* Olovely order, nor that the right amount was paid.
    // Without the checks below a customer could replay the signature of a cheap paid order
    // to mark an expensive order as Paid.
    const conflictingPayment = await Payment.findOne({
        $or: [{ razorpayPaymentId }, { razorpayOrderId }],
        order: { $ne: existingOrder._id },
    });
    if (conflictingPayment) {
        console.error(`❌ [PAYMENT VERIFY FAILED] Razorpay payment ${razorpayPaymentId} already belongs to order ${conflictingPayment.order}, not ${orderId}`);
        return { success: false, message: 'Payment does not belong to this order' };
    }

    const expectedPayable = getOnlineAmountDue(existingOrder);

    let payStatus = 'captured';
    if (!isMockIdentifier(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
        try {
            const razorpay = getRazorpayInstance();
            const [payDetails, rzpOrder]: any[] = await Promise.all([
                razorpay.payments.fetch(razorpayPaymentId),
                razorpay.orders.fetch(razorpayOrderId),
            ]);
            const rzpOrderRef = String(rzpOrder?.receipt || rzpOrder?.notes?.orderId || '');
            if (payDetails?.order_id !== razorpayOrderId || rzpOrderRef !== String(orderId)) {
                return { success: false, message: 'Payment does not belong to this order' };
            }
            if (Number(payDetails.amount) + 1 < Math.round(expectedPayable * 100)) {
                return { success: false, message: 'Paid amount is less than the order payable amount' };
            }
            payStatus = payDetails.status;
            if (payDetails.status === 'authorized') {
                await razorpay.payments.capture(razorpayPaymentId, Number(payDetails.amount), 'INR');
                payStatus = 'captured';
            }
            if (payStatus !== 'captured') {
                return { success: false, message: `Payment is not captured (status: ${payStatus})` };
            }
        } catch (apiErr: any) {
            // Fail closed: if Razorpay cannot confirm the payment, the order stays unpaid.
            // The payment.captured webhook will still mark it Paid once Razorpay confirms.
            console.error(`❌ [Razorpay API] Could not verify payment ${razorpayPaymentId}:`, apiErr?.message || apiErr);
            return { success: false, message: 'Unable to verify payment with gateway. Please retry shortly.' };
        }
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        let session: mongoose.ClientSession | null = null;
        if (transactionsSupported !== false) {
            try {
                session = await mongoose.startSession();
                session.startTransaction();
            } catch (txErr) {
                transactionsSupported = false;
                session = null;
            }
        }

        try {
            // Find order
            const order = session ? await Order.findById(orderId).session(session) : await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            if (order.paymentStatus === 'Paid') {
                if (session) await session.commitTransaction();
                return {
                    success: true,
                    message: 'Payment already captured',
                    data: {
                        paymentId: order.paymentId,
                        orderId: order._id,
                    },
                };
            }

            const payableAmount = getOnlineAmountDue(order);

            console.log(`\n[PAYMENT VERIFY]\nOrder ID: ${orderId}\nRazorpay Order ID: ${razorpayOrderId}\nRazorpay Payment ID: ${razorpayPaymentId}\nRazorpay Payment Status: ${payStatus}`);

            // Check if payment document already exists
            let payment = session 
                ? await Payment.findOne({ $or: [{ razorpayPaymentId }, { razorpayOrderId }] }).session(session)
                : await Payment.findOne({ $or: [{ razorpayPaymentId }, { razorpayOrderId }] });

            if (!payment) {
                payment = new Payment({
                    order: orderId,
                    customer: order.customer,
                    paymentMethod: 'Online',
                    paymentGateway: 'Razorpay',
                    razorpayOrderId,
                    razorpayPaymentId,
                    razorpaySignature,
                    amount: payableAmount,
                    currency: 'INR',
                    status: 'Completed',
                    paidAt: new Date(),
                    gatewayResponse: {
                        success: true,
                        message: 'Payment captured successfully',
                    },
                });
                if (session) {
                    await payment.save({ session });
                } else {
                    await payment.save();
                }
            }

            // Update order payment status and allocation fields
            order.paymentStatus = 'Paid';
            order.paymentId = razorpayPaymentId;
            order.onlineAmountPaid = payableAmount;
            order.codAmountPending = 0;
            if (order.status === 'Pending') {
                order.status = 'Received';
            }
            if (session) {
                await order.save({ session });
                await session.commitTransaction();
            } else {
                await order.save();
            }

            // Commit coupon usage if order has an uncommitted coupon
            if (order.couponCode && !order.couponUsageCommitted) {
                try {
                    const { commitCouponUsage } = await import('./couponService');
                    await commitCouponUsage(order);
                } catch (couponErr) {
                    console.error("Failed to commit coupon usage after payment capture:", couponErr);
                }
            }

            console.log(`\n[ORDER PAYMENT UPDATE]\nOrder ID: ${orderId}\nPayment Method: ${order.paymentMethod}\nPayment Status: ${order.paymentStatus}`);

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

            // Notify customer of order placement confirmation (independent of socket.io availability)
            try {
                const { sendOrderStatusNotification } = await import('./notificationService');
                const custId = (order.customer as any)?._id?.toString() || order.customer?.toString();
                if (custId) {
                    sendOrderStatusNotification(order._id.toString(), custId, order.status, io).catch((e) =>
                        console.error("Error sending customer notification after online payment capture:", e)
                    );
                }
            } catch (notifErr) {
                console.error("Error sending customer notification on capturePayment:", notifErr);
            }

            // Create Pending Commissions
            try {
                const { createPendingCommissions } = await import('./commissionService');
                await createPendingCommissions(orderId);
            } catch (commError) {
                console.error("Failed to create pending commissions after payment:", commError);
            }

            // Manifest Ecommerce shipments if any
            if (order.fulfillmentGroups) {
                for (const group of order.fulfillmentGroups) {
                    if (group.fulfillmentType === 'COURIER_SHIPPING' && (group.status === 'Processing' || group.status === 'Pending')) {
                        try {
                            const { createEcommerceShipment } = await import('./shipping/shippingService');
                            await createEcommerceShipment(order._id.toString(), group.groupId);
                        } catch (shipErr) {
                            console.error('Failed to create ecommerce shipment after payment capture:', shipErr);
                        }
                    }
                }
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
            if (session) {
                try {
                    await session.abortTransaction();
                } catch (_) {}
            }

            const isNotReplicaSet = error?.code === 20 || error?.message?.includes('Transaction numbers are only allowed on a replica set member or mongos');
            if (isNotReplicaSet) {
                transactionsSupported = false;
                console.warn('⚠️ [Payment] Transactions not supported on standalone MongoDB. Retrying without transaction.');
                attempt--; // Retry immediately without session
                continue;
            }

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
            if (session) session.endSession();
        }
    }

    return {
        success: false,
        message: 'Failed to capture payment due to write conflicts',
    };
};


/**
 * R-06: gateway refund with durable idempotency.
 *
 * Callers run inside retryable Mongo transactions, but a gateway refund cannot be rolled back.
 * Every attempt is therefore recorded in GatewayRefundIntent OUTSIDE the caller's transaction:
 *   - SUCCEEDED intent for this key → Razorpay is never called again; the refund is only
 *     (re-)applied to the Payment if the caller's view does not include it yet
 *   - INITIATED/FAILED intent with earlier attempts → Razorpay's refunds for the payment are
 *     searched by receipt / notes.idempotency_key first, and a match is adopted
 * The Payment's cumulative refundAmount is written in the caller's session, so an aborted
 * attempt is simply re-applied on retry with no second gateway refund.
 *
 * `idempotencyKey` must identify the business event (RETURN_<returnId>, CANCEL_<orderId>).
 */
const refundReceiptFor = (key: string) =>
    key.length <= 40 ? key : `RF_${crypto.createHash('sha1').update(key).digest('hex').slice(0, 32)}`;

export const processRefund = async (
    paymentId: string,
    amount?: number,
    reason?: string,
    session?: mongoose.ClientSession,
    idempotencyKey?: string,
): Promise<{ success: boolean; message: string; data?: { refundId?: string; amount?: number } }> => {
    try {
        const payment = session ? await Payment.findById(paymentId).session(session) : await Payment.findById(paymentId);
        if (!payment) throw new Error(`Payment record not found for ID: ${paymentId}`);
        if (!payment.razorpayPaymentId) throw new Error(`Razorpay payment ID missing on payment record: ${paymentId}`);

        const alreadyRefunded = round2(payment.refundAmount || 0);
        const refundableRemaining = round2(payment.amount - alreadyRefunded);
        const requested = round2(amount || refundableRemaining);
        // Deterministic fallback: the same payment state + amount gives the same key on a retry.
        const key = idempotencyKey || `PAY_${paymentId}_CUM_${Math.round(alreadyRefunded * 100)}_AMT_${Math.round(requested * 100)}`;

        const { default: GatewayRefundIntent } = await import('../models/GatewayRefundIntent');

        const applyToPayment = async (refundId: string, amt: number) => {
            const cumulative = round2(alreadyRefunded + amt);
            if (cumulative >= round2(payment.amount) - 0.01) payment.status = 'Refunded';
            payment.refundId = refundId;
            payment.refundAmount = cumulative;
            payment.refundedAt = new Date();
            payment.refundReason = reason;
            if (session) await payment.save({ session }); else await payment.save();
            GatewayRefundIntent.updateOne({ key }, { $set: { appliedToPaymentAt: new Date() } }).catch(() => undefined);
        };

        let intent = await GatewayRefundIntent.findOne({ key });
        const resolveSucceeded = async (it: any) => {
            // Refund totals only grow, so the Payment already includes this refund iff it reached
            // the cumulative total recorded when the intent was created.
            if (alreadyRefunded + 0.01 < round2(it.cumulativeAfter ?? alreadyRefunded + it.amount)) {
                await applyToPayment(it.gatewayRefundId, it.amount);
            }
            return { success: true, message: 'Refund already processed (idempotent)', data: { refundId: it.gatewayRefundId, amount: it.amount } };
        };
        if (intent && intent.status === 'SUCCEEDED') return resolveSucceeded(intent);

        if (payment.status === 'Refunded') {
            return {
                success: true,
                message: 'Payment is already marked Refunded (Idempotent)',
                data: { refundId: payment.refundId || `rfnd_existing_${payment._id}`, amount: payment.refundAmount || payment.amount },
            };
        }
        if (!requested || requested <= 0) throw new Error(`Invalid refund amount: ₹${requested}`);
        if (requested > refundableRemaining + 0.01) {
            throw new Error(`Refund amount ₹${requested} exceeds refundable balance ₹${refundableRemaining} on payment ${paymentId}`);
        }

        if (!intent) {
            try {
                intent = await GatewayRefundIntent.create({
                    key,
                    payment: payment._id,
                    order: payment.order,
                    razorpayPaymentId: payment.razorpayPaymentId,
                    amount: requested,
                    cumulativeAfter: round2(alreadyRefunded + requested),
                    status: 'INITIATED',
                    reason,
                });
            } catch (e: any) {
                if (e?.code !== 11000) throw e;
                intent = await GatewayRefundIntent.findOne({ key });
                if (intent?.status === 'SUCCEEDED') return resolveSucceeded(intent);
            }
        }
        if (!intent) throw new Error(`Could not record refund intent ${key}`);
        if (Math.abs(intent.amount - requested) > 0.01) {
            throw new Error(`Refund key ${key} was first used for ₹${intent.amount}, not ₹${requested}`);
        }

        const amountPaise = Math.round(requested * 100);
        const receipt = refundReceiptFor(key);
        const isMockPayment = isMockPaymentAllowed() &&
            (payment.razorpayPaymentId.startsWith('pay_mock_') || process.env.USE_MOCK_PAYMENT === 'true');
        let refundId = '';

        if (isMockPayment) {
            refundId = `rfnd_mock_${receipt}`;
        } else {
            const razorpay = getRazorpayInstance();

            // Recovery: an earlier attempt may have refunded at the gateway and then failed locally.
            if (intent.attempts > 0) {
                const existing: any = await (razorpay.payments as any).fetchMultipleRefund(payment.razorpayPaymentId, { count: 100 });
                const match = (existing?.items || []).find(
                    (r: any) => r.receipt === receipt || r.notes?.idempotency_key === key,
                );
                if (match?.id) refundId = match.id;
            }

            if (!refundId) {
                const payDetails = await razorpay.payments.fetch(payment.razorpayPaymentId);
                if (payDetails.status !== 'captured' && payDetails.status !== 'refunded') {
                    throw new Error(`Cannot refund payment ${payment.razorpayPaymentId}. Current Razorpay status is '${payDetails.status}' (expected 'captured')`);
                }
                await GatewayRefundIntent.updateOne({ key }, { $inc: { attempts: 1 } });
                try {
                    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
                        amount: amountPaise,
                        receipt,
                        notes: {
                            reason: reason || 'Order refund',
                            orderId: payment.order?.toString() || '',
                            idempotency_key: key,
                        },
                    });
                    if (!refund || !refund.id) throw new Error('Razorpay refund API call failed to return refund ID');
                    refundId = refund.id;
                } catch (gwErr: any) {
                    await GatewayRefundIntent.updateOne(
                        { key, status: { $ne: 'SUCCEEDED' } },
                        { $set: { status: 'FAILED', lastError: String(gwErr?.message || gwErr?.error?.description || gwErr) } },
                    );
                    throw gwErr;
                }
            }
        }

        // Durable success record BEFORE touching the caller's transaction
        await GatewayRefundIntent.updateOne({ key }, { $set: { status: 'SUCCEEDED', gatewayRefundId: refundId }, $unset: { lastError: 1 } });

        console.log(`\n[RAZORPAY REFUND]\nOrder ID: ${payment.order}\nRazorpay Payment ID: ${payment.razorpayPaymentId}\nRefund Amount: ₹${requested}\nRazorpay Refund ID: ${refundId}\nKey: ${key}`);
        await applyToPayment(refundId, requested);

        return { success: true, message: 'Refund processed successfully', data: { refundId, amount: requested } };
    } catch (error: any) {
        console.error('❌ [RAZORPAY REFUND ERROR]:', error?.message || error?.error?.description || error);
        return {
            success: false,
            message: error?.message || error?.error?.description || 'Failed to process Razorpay refund',
        };
    }
};


/**
 * Handle Razorpay webhook
 */
export const handleWebhook = async (
    body: any,
    signature: string,
    io?: any,
    rawBody?: string
): Promise<{ success: boolean; message: string }> => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
            throw new Error('Razorpay webhook secret not configured');
        }

        // Verify webhook signature over the exact bytes Razorpay sent (fallback: re-serialised JSON)
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody ?? JSON.stringify(body))
            .digest('hex');

        const sigBuf = Buffer.from(String(signature || ''), 'utf8');
        const expBuf = Buffer.from(expectedSignature, 'utf8');
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            throw new Error('Invalid webhook signature');
        }

        const event = body.event;

        // Handle different events
        switch (event) {
            case 'payment.captured':
                // Payment was captured successfully
                if (body.payload?.payment?.entity) {
                    await handlePaymentCaptured(body.payload.payment.entity, io);
                }
                break;

            case 'payment.failed':
                // Payment failed
                if (body.payload?.payment?.entity) {
                    await handlePaymentFailed(body.payload.payment.entity);
                }
                break;

            case 'refund.created':
            case 'refund.processed':
                // Refund was created or processed
                if (body.payload?.refund?.entity) {
                    await handleRefundCreated(body.payload.refund.entity, body.payload?.payment?.entity);
                }
                break;

            case 'payment.authorized':
            case 'order.paid':
                // Acknowledged webhook events
                console.log(`ℹ️ [Webhook] Acknowledged ${event} event cleanly.`);
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

        // R-09: record what the gateway actually captured (paise → ₹), never order.total
        // (order.total includes any wallet-funded part).
        const capturedAmount = Number.isFinite(Number(payload.amount)) && Number(payload.amount) > 0
            ? round2(Number(payload.amount) / 100)
            : getOnlineAmountDue(order);

        // Create or update Payment record
        if (!payment) {
            payment = new Payment({
                order: order._id,
                customer: order.customer,
                paymentMethod: 'Online',
                paymentGateway: 'Razorpay',
                razorpayOrderId,
                razorpayPaymentId,
                amount: capturedAmount,
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
        order.onlineAmountPaid = capturedAmount;
        order.codAmountPending = 0;
        if (order.status === 'Pending') {
            order.status = 'Received';
        }
        await order.save();

        // Commit coupon usage if order has an uncommitted coupon
        if (order.couponCode && !order.couponUsageCommitted) {
            try {
                const { commitCouponUsage } = await import('./couponService');
                await commitCouponUsage(order);
            } catch (couponErr) {
                console.error("Failed to commit coupon usage after webhook capture:", couponErr);
            }
        }

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

            // Notify customer of order placement confirmation on first transition to Paid
            try {
                const { sendOrderStatusNotification } = await import('./notificationService');
                const custId = (order.customer as any)?._id?.toString() || order.customer?.toString();
                if (custId) {
                    sendOrderStatusNotification(order._id.toString(), custId, order.status, io).catch((e) =>
                        console.error("Error sending customer notification after webhook payment capture:", e)
                    );
                }
            } catch (notifErr) {
                console.error("Error sending customer notification on webhook capture:", notifErr);
            }

            // Create Pending Commissions
            try {
                const { createPendingCommissions } = await import('./commissionService');
                await createPendingCommissions(order._id.toString());
            } catch (commError) {
                console.error("Failed to create pending commissions after webhook payment:", commError);
            }

            // Manifest Ecommerce shipments if any (idempotently)
            if (order.fulfillmentGroups) {
                for (const group of order.fulfillmentGroups) {
                    if (group.fulfillmentType === 'COURIER_SHIPPING' && (group.status === 'Processing' || group.status === 'Pending')) {
                        try {
                            const { createEcommerceShipment } = await import('./shipping/shippingService');
                            await createEcommerceShipment(order._id.toString(), group.groupId);
                        } catch (shipErr) {
                            console.error('Failed to create ecommerce shipment after webhook payment capture:', shipErr);
                        }
                    }
                }
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
            // Idempotency: skip if already Failed. A captured/refunded payment can never "fail" later
            // (late or out-of-order event for an earlier attempt).
            if (payment.status === 'Failed' || payment.status === 'Completed' || payment.status === 'Refunded') {
                return;
            }
            payment.status = 'Failed';
            payment.gatewayResponse = {
                success: false,
                message: payload.error_description || 'Payment failed',
                rawResponse: payload,
            };
            await payment.save();

            // Update order and restore inventory atomically.
            // Razorpay emits payment.failed for every failed attempt; a later attempt on the
            // same checkout can still succeed, and webhooks can arrive out of order. Never
            // cancel an order that is already Paid.
            const order = await Order.findById(payment.order);
            if (order && order.paymentStatus !== 'Failed' && order.paymentStatus !== 'Paid') {
                order.paymentStatus = 'Failed';
                order.status = 'Cancelled';
                if (order.fulfillmentGroups) {
                    for (const group of order.fulfillmentGroups) {
                        group.status = 'Cancelled';
                    }
                }
                await order.save();

                // Release first-order free shipping claim so customer retains future eligibility
                if (order.firstOrderFreeShippingApplied) {
                    try {
                        const { releaseFirstOrderFreeShippingClaim } = await import('./shipping/shippingPromotionService');
                        const custId = (order.customer as any)?._id || order.customer;
                        await releaseFirstOrderFreeShippingClaim(custId);
                    } catch (relErr) {
                        console.error('Error releasing first order free shipping claim on payment failure:', relErr);
                    }
                }

                // Restore stock for all items — use mutateStock for atomicity and variation isolation
                const OrderItem = (await import('../models/OrderItem')).default;
                const Product = (await import('../models/Product')).default;
                const { mutateStock } = await import('./inventoryService');
                for (const itemId of order.items) {
                    const item = await OrderItem.findById(itemId);
                    if (item && item.product) {
                        const resolvedVariationId = (item as any).variationId
                            ? (item as any).variationId.toString()
                            : null;

                        try {
                            await mutateStock({
                                productId: item.product.toString(),
                                variationId: resolvedVariationId,
                                quantity: +item.quantity,   // positive = restore
                                type: 'RETURN',
                                referenceType: 'RETURN',
                                referenceId: order._id.toString(),
                                orderItemId: item._id.toString(),
                                performedByRole: 'SYSTEM',
                                note: 'Payment failed stock restore',
                            });
                        } catch (stockErr: any) {
                            console.warn(`[PaymentFailed] Stock restore failed for product ${item.product}:`, stockErr.message);
                        }

                        item.status = 'Cancelled';
                        await item.save();
                    }
                }

                console.log(`🔒 [Payment Failed] Order ${order.orderNumber} cancelled and inventory restored atomically`);
            }
        }
    } catch (error) {
        console.error('Error handling payment failed webhook:', error);
    }
};

const handleRefundCreated = async (payload: any, paymentEntity?: any) => {
    try {
        const razorpayPaymentId = payload.payment_id;

        // Find payment record
        const payment = await Payment.findOne({ razorpayPaymentId });

        if (payment) {
            // Idempotency: skip if already marked Refunded
            if (payment.status === 'Refunded') {
                return;
            }
            // Partial refunds (item returns) are common. Use the gateway's cumulative
            // amount_refunded when available; never shrink what we already recorded.
            const gatewayCumulative = paymentEntity?.amount_refunded != null
                ? Number(paymentEntity.amount_refunded) / 100
                : Number(payload.amount || 0) / 100;
            const cumulative = round2(Math.max(payment.refundAmount || 0, gatewayCumulative));
            const isFullRefund = cumulative >= round2(payment.amount) - 0.01;
            payment.refundAmount = cumulative;
            payment.refundedAt = new Date();
            if (isFullRefund) payment.status = 'Refunded';
            await payment.save();

            if (!isFullRefund) {
                console.log(`ℹ️ [REFUND WEBHOOK] Partial refund recorded for payment ${payment._id}: ₹${cumulative} of ₹${payment.amount}. Order status unchanged.`);
                return;
            }

            // A full refund must never "un-deliver" an order: delivered/returned orders keep
            // their fulfillment status; only pre-delivery orders become Cancelled.
            const currentOrder = await Order.findById(payment.order).select('status');
            const orderUpdate: any = { paymentStatus: 'Refunded' };
            if (currentOrder && !['Delivered', 'Returned'].includes(currentOrder.status)) {
                orderUpdate.status = 'Cancelled';
            }
            const updatedOrder = await Order.findByIdAndUpdate(payment.order, orderUpdate, { new: true });

            console.log(`\n[REFUND WEBHOOK ORDER UPDATE]\nRefund ID: ${payload.id || 'N/A'}\nPayment ID: ${payment._id}\nOrder ID: ${payment.order}\npayment.status: ${payment.status}\norder.status: ${updatedOrder?.status}\norder.paymentStatus: ${updatedOrder?.paymentStatus}`);
        }
    } catch (error) {
        console.error('Error handling refund created webhook:', error);
    }
};
