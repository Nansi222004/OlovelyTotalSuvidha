import { Server as SocketIOServer } from 'socket.io';
import OrderItem from '../models/OrderItem';
import mongoose from 'mongoose';
import { sendNotification } from './notificationService';
import { buildAdminOrderAlert, isPlatformQuickCommerceItem, isVendorOwnedOrderItem } from './orderAlertService';

/**
 * Notify all sellers involved in an order about a new order or status change
 */
export async function notifySellersOfOrderUpdate(
    io: SocketIOServer,
    order: any,
    type: 'NEW_ORDER' | 'STATUS_UPDATE' | 'ORDER_CANCELLED'
): Promise<void> {
    try {
        if (!io) {
            console.error('Socket.io server not provided to notifySellersOfOrderUpdate');
            return;
        }

        // Get all unique seller IDs from order items
        // If items are populated, we can get them directly, otherwise we need to query
        let orderItems = order.items;

        // If items are just IDs, fetch the full OrderItem details to get seller IDs
        if (orderItems.length > 0 && (typeof orderItems[0] === 'string' || orderItems[0] instanceof mongoose.Types.ObjectId)) {
            orderItems = await OrderItem.find({ order: order._id });
        }

        const extractSellerId = (item: any): string => {
            if (!item.seller) return '';
            if (typeof item.seller === 'object' && item.seller._id) {
                return item.seller._id.toString();
            }
            return item.seller.toString();
        };

        // A Platform product can still carry the canonical platform Seller ObjectId for
        // inventory/accounting. ownerType, not seller presence, is the ownership boundary.
        const vendorItems = orderItems.filter(isVendorOwnedOrderItem);
        const sellerIds = Array.from(new Set(vendorItems.map(extractSellerId).filter(Boolean))) as string[];

        console.log(`🔔 Notifying ${sellerIds.length} sellers about ${type} for order ${order.orderNumber}`);

        // The Admin incoming-order popup is exclusively for new Platform QC items.
        // Ecommerce continues through its courier flow and never enters this channel.
        const platformQcItems = orderItems.filter(isPlatformQuickCommerceItem);
        if (type === 'NEW_ORDER' && platformQcItems.length > 0) {
            const adminEventId = `order:${order._id}:platform_qc:new_order`;
            const adminNotificationData = {
                ...buildAdminOrderAlert(order, platformQcItems),
                eventId: adminEventId,
            };
            io.to('admin').emit('admin-notification', adminNotificationData);
            console.log(`📤 Emitted admin-notification to admin room for Platform QC order ${order.orderNumber}`);

            try {
                const Admin = (await import('../models/Admin')).default;
                const admins = await Admin.find().select('_id').lean();
                for (const admin of admins) {
                    const scopedEventId = `order:${order._id}:admin:${admin._id}:platform_qc:new_order`;
                    sendNotification('Admin', admin._id.toString(), 'New Platform Order Received', `Platform received a new QC order #${order.orderNumber}`, {
                        type: 'Order',
                        link: `/admin/orders/${order._id}`,
                        priority: 'High',
                        eventId: scopedEventId,
                        data: {
                            orderId: order._id.toString(),
                            orderNumber: order.orderNumber,
                            role: 'admin',
                            panel: 'admin',
                            type: 'NEW_ORDER',
                            eventId: scopedEventId,
                        },
                    }).catch(err => console.error(`❌ [Admin Notification Error] ${admin._id}:`, err?.message));
                }
            } catch (adminQueryErr: any) {
                console.error(`❌ [Admin Notification Query Error]:`, adminQueryErr?.message);
            }
        }

        for (const sellerId of sellerIds) {
            // Get only items belonging to this seller
            const sellerSpecificItems = vendorItems.filter((item: any) => extractSellerId(item) === sellerId);

            let sellerHasQc = false;
            let sellerHasEcom = false;

            const mappedItems = sellerSpecificItems.map((item: any) => {
                // Determine item fulfillment channel safely
                const group = (order.fulfillmentGroups || []).find((g: any) =>
                    Array.isArray(g.items) && g.items.some((itId: any) => itId.toString() === item._id.toString())
                );
                const isEcom = group
                    ? group.fulfillmentType === 'COURIER_SHIPPING' || group.fulfillmentType === 'THIRD_PARTY_API'
                    : (item.productType === 'ECOMMERCE' || (order.orderType === 'ECOMMERCE'));

                if (isEcom) {
                    sellerHasEcom = true;
                } else {
                    sellerHasQc = true;
                }

                return {
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.unitPrice,
                    total: item.total,
                    variation: item.variation,
                    productType: isEcom ? 'ECOMMERCE' : 'QUICK_COMMERCE',
                    fulfillmentType: isEcom ? 'COURIER_SHIPPING' : 'LOCAL_DELIVERY',
                    isWholesale: Boolean(item.isWholesale),
                    wholesalePrice: item.wholesalePrice,
                    wholesaleMinimumQuantity: item.wholesaleMinimumQuantity,
                };
            });

            const sellerFulfillmentType = (sellerHasQc && sellerHasEcom)
                ? 'MIXED'
                : sellerHasQc
                    ? 'LOCAL_DELIVERY'
                    : 'COURIER_SHIPPING';

            const sellerEventId = `order:${order._id}:seller:${sellerId}:${type.toLowerCase()}`;
            const notificationData = {
                type,
                eventId: sellerEventId,
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                paymentStatus: order.paymentStatus,
                customer: {
                    name: order.customerName,
                    email: order.customerEmail,
                    phone: order.customerPhone,
                    address: order.deliveryAddress
                },
                deliveryOption: sellerHasQc ? (order.deliveryOption || 'Standard') : 'Courier',
                items: mappedItems,
                totalAmount: sellerSpecificItems.reduce((acc: number, item: any) => acc + item.total, 0),
                timestamp: new Date(),
                hasQcItems: sellerHasQc,
                hasEcomItems: sellerHasEcom,
                requiresLocalDelivery: sellerHasQc,
                fulfillmentType: sellerFulfillmentType,
            };

            // Emit to seller-specific room
            io.to(`seller-${sellerId}`).emit('seller-notification', notificationData);
            console.log(`📤 Emitted notification to seller-${sellerId}`);

            // Send Notification (Database + Push) with stable eventId
            const title = type === 'NEW_ORDER' ? 'New Order Received' : 
                         type === 'ORDER_CANCELLED' ? 'Order Cancelled' : 'Order Status Update';
            
            const body = type === 'NEW_ORDER' ? `You have received a new order #${order.orderNumber}` :
                         type === 'ORDER_CANCELLED' ? `Order #${order.orderNumber} has been cancelled` :
                         `Order #${order.orderNumber} status updated to ${order.status}`;

            await sendNotification('Seller', sellerId, title, body, {
                type: 'Order',
                link: `/seller/orders/${order._id}`,
                priority: type === 'NEW_ORDER' ? 'High' : 'Medium',
                eventId: sellerEventId,
                data: {
                    orderId: order._id.toString(),
                    orderNumber: order.orderNumber,
                    role: 'seller',
                    panel: 'seller',
                    type: type || 'NEW_ORDER',
                    eventId: sellerEventId,
                },
            }).catch(err => console.error(`❌ [Seller Notification Error] ${sellerId}:`, err?.message));
        }
    } catch (error) {
        console.error('Error in notifySellersOfOrderUpdate:', error);
    }
}
