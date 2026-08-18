import { Socket } from 'socket.io-client';
import api from '../config';

export interface OrderNotificationData {
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: {
        address: string;
        city: string;
        state?: string;
        pincode: string;
        landmark?: string;
    };
    total: number;
    subtotal: number;
    shipping: number;
    deliveryBoyEarning: number; // Estimated earning for the delivery boy
    createdAt: string;
}

export interface AcceptOrderResponse {
    success: boolean;
    message: string;
}

export interface RejectOrderResponse {
    success: boolean;
    message: string;
    allRejected: boolean;
}

/**
 * Accept an order via WebSocket with REST API fallback
 */
export const acceptOrder = async (
    socket: Socket | null,
    orderId: string,
    deliveryBoyId: string
): Promise<AcceptOrderResponse> => {
    // 1. Try WebSocket first if connected
    if (socket && socket.connected) {
        try {
            const socketResult = await new Promise<AcceptOrderResponse>((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({ success: false, message: 'Request timeout' });
                }, 4000); // 4s timeout for socket

                socket.emit('accept-order', { orderId, deliveryBoyId });

                socket.once('accept-order-response', (response: AcceptOrderResponse) => {
                    clearTimeout(timeout);
                    resolve(response);
                });
            });

            if (socketResult.success) {
                return socketResult;
            }
        } catch (e) {
            console.warn('Socket accept attempt failed, using REST fallback:', e);
        }
    }

    // 2. Fallback to REST API if socket is not connected or timed out or failed
    try {
        const response = await api.post<AcceptOrderResponse>(`/delivery/orders/${orderId}/accept`);
        return response.data;
    } catch (err: any) {
        console.error('REST accept order failed:', err);
        return {
            success: false,
            message: err?.response?.data?.message || err?.message || 'Failed to accept order',
        };
    }
};

/**
 * Reject an order via WebSocket with REST API fallback
 */
export const rejectOrder = async (
    socket: Socket | null,
    orderId: string,
    deliveryBoyId: string
): Promise<RejectOrderResponse> => {
    // 1. Try WebSocket first if connected
    if (socket && socket.connected) {
        try {
            const socketResult = await new Promise<RejectOrderResponse>((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({ success: false, message: 'Request timeout', allRejected: false });
                }, 4000); // 4s timeout for socket

                socket.emit('reject-order', { orderId, deliveryBoyId });

                socket.once('reject-order-response', (response: RejectOrderResponse) => {
                    clearTimeout(timeout);
                    resolve(response);
                });
            });

            if (socketResult.success) {
                return socketResult;
            }
        } catch (e) {
            console.warn('Socket reject attempt failed, using REST fallback:', e);
        }
    }

    // 2. Fallback to REST API if socket is not connected or timed out or failed
    try {
        const response = await api.post<RejectOrderResponse>(`/delivery/orders/${orderId}/reject`);
        return response.data;
    } catch (err: any) {
        console.error('REST reject order failed:', err);
        return {
            success: false,
            message: err?.response?.data?.message || err?.message || 'Failed to reject order',
            allRejected: false,
        };
    }
};


