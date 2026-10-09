import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';
import { getSocketBaseURL } from '../../../services/api/config';

export const ADMIN_SUPPORT_BROWSER_EVENT = 'olovely:admin-support-event';

export interface AdminOrderAlertNotification {
  type: 'NEW_ORDER' | 'STATUS_UPDATE';
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  hasQcItems?: boolean;
  hasEcomItems?: boolean;
  requiresLocalDelivery?: boolean;
  fulfillmentType?: 'LOCAL_DELIVERY' | 'COURIER_SHIPPING' | 'MIXED';
  ownerType: 'PLATFORM';
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
    productType?: string;
    fulfillmentType?: string;
    isWholesale?: boolean;
    wholesalePrice?: number;
    wholesaleMinimumQuantity?: number;
    ownerType: 'PLATFORM';
  }>;
  totalAmount: number;
  deliveryOption?: string;
  deliveryType: string;
  timestamp: Date;
}

export interface AdminSupportEvent {
  eventType: 'CREATED' | 'REPLIED';
  ticketId: string;
  ticketNumber?: string;
  messageId?: string;
  message?: {
    _id?: string;
    clientMessageId?: string;
    senderType: 'CUSTOMER' | 'ADMIN';
    senderId?: string;
    senderName?: string;
    message: string;
    createdAt: string;
  };
}

export const useAdminSocket = (
  onNotificationReceived?: (notification: AdminOrderAlertNotification) => void,
  onAdminRoomJoined?: () => void,
  onSupportEvent?: (event: AdminSupportEvent) => void,
) => {
  const { user, token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const notificationHandlerRef = useRef(onNotificationReceived);
  const joinedHandlerRef = useRef(onAdminRoomJoined);
  const supportHandlerRef = useRef(onSupportEvent);

  useEffect(() => {
    notificationHandlerRef.current = onNotificationReceived;
    joinedHandlerRef.current = onAdminRoomJoined;
    supportHandlerRef.current = onSupportEvent;
  }, [onNotificationReceived, onAdminRoomJoined, onSupportEvent]);

  useEffect(() => {
    if (!isAuthenticated || !token || !user || user.userType !== 'Admin') {
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
      console.log('✅ Admin connected to socket server');
      setIsConnected(true);

      // Join admin room
      newSocket.emit('join-admin-room');
    });

    newSocket.on('joined-admin-room', (ack: { success: boolean; message?: string }) => {
      if (!ack?.success) {
        console.error('❌ Failed to join admin notification room:', ack?.message || 'Unknown error');
        return;
      }
      console.log('📦 Joined admin notification room');
      joinedHandlerRef.current?.();
    });

    newSocket.on('admin-notification', (notification: AdminOrderAlertNotification) => {
      console.log('🔔 New admin notification received:', notification);
      notificationHandlerRef.current?.(notification);
    });

    newSocket.on('admin-support-event', (event: AdminSupportEvent) => {
      supportHandlerRef.current?.(event);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Admin disconnected from socket server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Admin socket connection failed:', error.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, token, user?.id, user?.userType]);

  return { socket, isConnected };
};
