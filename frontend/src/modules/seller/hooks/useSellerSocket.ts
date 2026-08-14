import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';
import { getSocketBaseURL } from '../../../services/api/config';

export interface SellerNotification {
    type: 'NEW_ORDER' | 'STATUS_UPDATE';
    orderId: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    customer: {
        name: string;
        email: string;
        phone: string;
        address: {
            address: string;
            city: string;
            state?: string;
            pincode: string;
            landmark?: string;
        };
    };
    items: Array<{
        productName: string;
        quantity: number;
        price: number;
        total: number;
        variation?: string;
    }>;
    totalAmount: number;
    deliveryOption?: string;
    timestamp: Date;
}

export const useSellerSocket = (onNotificationReceived?: (notification: SellerNotification) => void) => {
    const { user, token, isAuthenticated } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!isAuthenticated || !token || !user || user.userType !== 'Seller') {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const socketUrl = getSocketBaseURL();
        const newSocket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });

        newSocket.on('connect', () => {
            console.log('✅ Seller connected to socket server');
            setIsConnected(true);

            // Join seller room
            newSocket.emit('join-seller-room', user.id);
        });

        newSocket.on('joined-seller-room', (data) => {
            console.log('📦 Joined seller notification room:', data.sellerId);
        });

        newSocket.on('seller-notification', (notification: SellerNotification) => {
            console.log('🔔 New seller notification received:', notification);
            if (onNotificationReceived) {
                onNotificationReceived(notification);
            }
        });

        newSocket.on('disconnect', () => {
            console.log('❌ Seller disconnected from socket server');
            setIsConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated, token, user?.id, user?.userType]);

    return { socket, isConnected };
};
