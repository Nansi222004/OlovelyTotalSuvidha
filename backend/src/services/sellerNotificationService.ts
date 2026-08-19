import { Server as SocketIOServer } from 'socket.io';
import OrderItem from '../models/OrderItem';
import mongoose from 'mongoose';
import { sendNotification } from './notificationService';

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
        if (orderItems.length > 0 && typeof orderItems[0] === 'string' || orderItems[0] instanceof mongoose.Types.ObjectId) {
            orderItems = await OrderItem.find({ order: order._id });
        }

        const extractSellerId = (item: any): string => {
            if (!item.seller) return '';
            if (typeof item.seller === 'object' && item.seller._id) {
                return item.seller._id.toString();
            }
            return item.seller.toString();
        };

        const sellerIds = Array.from(new Set(orderItems.map(extractSellerId).filter(Boolean))) as string[];

        console.log(`🔔 Notifying ${sellerIds.length} sellers about ${type} for order ${order.orderNumber}`);

        for (const sellerId of sellerIds) {
            // Get only items belonging to this seller
            const sellerSpecificItems = orderItems.filter((item: any) => extractSellerId(item) === sellerId);

            const notificationData = {
                type,
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
                deliveryOption: order.deliveryOption || 'Standard',
                items: sellerSpecificItems.map((item: any) => ({
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.unitPrice,
                    total: item.total,
                    variation: item.variation
                })),
                totalAmount: sellerSpecificItems.reduce((acc: number, item: any) => acc + item.total, 0),
                timestamp: new Date()
            };

            // Emit to seller-specific room
            io.to(`seller-${sellerId}`).emit('seller-notification', notificationData);
            console.log(`📤 Emitted notification to seller-${sellerId}`);

            // Send Notification (Database + Push)
            const title = type === 'NEW_ORDER' ? 'New Order Received' : 
                         type === 'ORDER_CANCELLED' ? 'Order Cancelled' : 'Order Status Update';
            
            const body = type === 'NEW_ORDER' ? `You have received a new order #${order.orderNumber}` :
                         type === 'ORDER_CANCELLED' ? `Order #${order.orderNumber} has been cancelled` :
                         `Order #${order.orderNumber} status updated to ${order.status}`;

            await sendNotification('Seller', sellerId, title, body, {
                type: 'Order',
                link: `/seller/orders/${order._id}`,
                priority: type === 'NEW_ORDER' ? 'High' : 'Medium',
                data: {
                    orderId: order._id.toString(),
                    orderNumber: order.orderNumber,
                    role: 'seller',
                    panel: 'seller',
                    type: type || 'NEW_ORDER',
                },
            }).catch(err => console.error(`❌ [Seller Notification Error] ${sellerId}:`, err?.message));
        }
    } catch (error) {
        console.error('Error in notifySellersOfOrderUpdate:', error);
    }
}
