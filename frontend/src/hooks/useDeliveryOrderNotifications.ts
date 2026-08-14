import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { OrderNotificationData } from '../services/api/delivery/deliveryOrderNotificationService';
import { acceptOrder, rejectOrder } from '../services/api/delivery/deliveryOrderNotificationService';
import { getSocketBaseURL } from '../services/api/config';
import { getPendingOrderAlerts } from '../services/api/delivery/deliveryService';

interface NotificationState {
    currentNotification: OrderNotificationData | null;
    notificationQueue: OrderNotificationData[];
    isConnected: boolean;
    error: string | null;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 2000;
const STORAGE_KEY_PREFIX = 'delivery_order_notifications_';

function getInitialNotificationState(userId?: string): {
    currentNotification: OrderNotificationData | null;
    notificationQueue: OrderNotificationData[];
} {
    if (!userId || typeof window === 'undefined') {
        return { currentNotification: null, notificationQueue: [] };
    }
    try {
        const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                return {
                    currentNotification: parsed.currentNotification || null,
                    notificationQueue: Array.isArray(parsed.notificationQueue) ? parsed.notificationQueue : [],
                };
            }
        }
    } catch (e) {
        console.warn('Failed to parse persisted delivery notification state:', e);
    }
    return { currentNotification: null, notificationQueue: [] };
}

function persistNotificationState(
    userId: string | undefined,
    current: OrderNotificationData | null,
    queue: OrderNotificationData[],
) {
    if (!userId || typeof window === 'undefined') return;
    try {
        const key = `${STORAGE_KEY_PREFIX}${userId}`;
        if (!current && queue.length === 0) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(
                key,
                JSON.stringify({
                    currentNotification: current,
                    notificationQueue: queue,
                }),
            );
        }
    } catch (e) {
        console.warn('Failed to persist delivery notification state:', e);
    }
}

function mergeUniqueOrderNotifications(
    existing: OrderNotificationData[],
    incoming: OrderNotificationData[],
): OrderNotificationData[] {
    const seen = new Set(existing.map((notification) => notification.orderId));
    const merged = [...existing];

    for (const notification of incoming) {
        if (!seen.has(notification.orderId)) {
            seen.add(notification.orderId);
            merged.push(notification);
        }
    }

    return merged;
}

export const useDeliveryOrderNotifications = () => {
    const { isAuthenticated, user } = useAuth();
    const [state, setState] = useState<NotificationState>(() => {
        const initial = getInitialNotificationState(user?.id);
        return {
            currentNotification: initial.currentNotification,
            notificationQueue: initial.notificationQueue,
            isConnected: false,
            error: null,
        };
    });

    const socketRef = useRef<Socket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const hasRehydratedRef = useRef(false);

    // Sync state with localStorage whenever notification state or user changes
    useEffect(() => {
        if (isAuthenticated && user?.userType === 'Delivery' && user?.id) {
            persistNotificationState(user.id, state.currentNotification, state.notificationQueue);
        }
    }, [isAuthenticated, user?.id, user?.userType, state.currentNotification, state.notificationQueue]);

    // Restore from localStorage when user ID becomes available
    useEffect(() => {
        if (user?.id && user?.userType === 'Delivery' && !state.currentNotification && state.notificationQueue.length === 0) {
            const restored = getInitialNotificationState(user.id);
            if (restored.currentNotification || restored.notificationQueue.length > 0) {
                setState((prev) => ({
                    ...prev,
                    currentNotification: restored.currentNotification,
                    notificationQueue: restored.notificationQueue,
                }));
            }
        }
    }, [user?.id, user?.userType]);

    const rehydratePendingAlerts = useCallback(async () => {
        try {
            const alerts = await getPendingOrderAlerts();
            if (!Array.isArray(alerts)) return;

            setState((prev) => {
                const serverMap = new Map<string, OrderNotificationData>(
                    alerts.map((a: OrderNotificationData) => [a.orderId, a]),
                );
                let newCurrent = prev.currentNotification;
                let newQueue = [...prev.notificationQueue];

                // If current notification is no longer in server pending alerts, clear it
                if (newCurrent && !serverMap.has(newCurrent.orderId)) {
                    newCurrent = null;
                }

                // Filter out queue items that are no longer pending on server
                newQueue = newQueue.filter((item) => serverMap.has(item.orderId));

                // Merge server alerts into current/queue if not already present
                const existingIds = new Set<string>();
                if (newCurrent) existingIds.add(newCurrent.orderId);
                newQueue.forEach((item) => existingIds.add(item.orderId));

                for (const alert of alerts) {
                    if (!existingIds.has(alert.orderId)) {
                        if (!newCurrent) {
                            newCurrent = alert;
                            existingIds.add(alert.orderId);
                        } else {
                            newQueue.push(alert);
                            existingIds.add(alert.orderId);
                        }
                    }
                }

                return {
                    ...prev,
                    currentNotification: newCurrent,
                    notificationQueue: newQueue,
                };
            });
        } catch (error) {
            console.error('Failed to rehydrate delivery order alerts:', error);
        }
    }, []);

    const connectSocket = useCallback(() => {
        if (!isAuthenticated || user?.userType !== 'Delivery' || !user?.id) {
            return;
        }

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        const token = localStorage.getItem('authToken');
        const socket = io(getSocketBaseURL(), {
            auth: {
                token,
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: INITIAL_RECONNECT_DELAY,
            reconnectionDelayMax: 10000,
            timeout: 20000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('🔌 Delivery notification socket connected');
            reconnectAttemptsRef.current = 0;
            setState(prev => ({
                ...prev,
                isConnected: true,
                error: null,
            }));

            // Join delivery notification room
            const userId = String(user.id);
            console.log(`📡 [SOCKET] Connected. Joining delivery-notifications for UserID: ${userId}`);
            socket.emit('join-delivery-notifications', userId);
            rehydratePendingAlerts();
        });

        socket.on('joined-notifications-room', (data: any) => {
            console.log('✅ Successfully joined notifications room:', data);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
            setState(prev => ({
                ...prev,
                isConnected: false,
                error: `Connection failed: ${error.message}`,
            }));
        });

        socket.on('disconnect', (reason) => {
            console.warn('⚠️ Socket disconnected:', reason);
            setState(prev => ({
                ...prev,
                isConnected: false,
            }));
        });

        socket.on('new-order', (orderData: OrderNotificationData) => {
            console.log('📦 New order notification received:', orderData);

            // Play notification sound
            try {
                const audio = new Audio('/assets/sound/delivery-alert.mp3');
                audio.play().catch(e => console.warn('🔊 Sound play failed:', e.message));
            } catch (error) {
                console.warn('🔊 Error playing notification sound:', error);
            }

            setState(prev => {
                // If there's already a current notification, queue this one
                if (prev.currentNotification) {
                    // Prevent duplicate queueing
                    if (prev.currentNotification.orderId === orderData.orderId || prev.notificationQueue.some(item => item.orderId === orderData.orderId)) {
                        return prev;
                    }
                    return {
                        ...prev,
                        notificationQueue: [...prev.notificationQueue, orderData],
                    };
                }
                // Otherwise, show it immediately
                return {
                    ...prev,
                    currentNotification: orderData,
                };
            });
        });

        socket.on('order-accepted', (data: { orderId: string; acceptedBy: string }) => {
            console.log('✅ Order accepted by another delivery boy:', data);

            setState(prev => {
                // If this is the current notification, clear it
                if (prev.currentNotification?.orderId === data.orderId) {
                    const nextNotification = prev.notificationQueue[0] || null;
                    return {
                        ...prev,
                        currentNotification: nextNotification,
                        notificationQueue: prev.notificationQueue.slice(1),
                    };
                }
                // Remove from queue if it's there
                return {
                    ...prev,
                    notificationQueue: prev.notificationQueue.filter(
                        notif => notif.orderId !== data.orderId
                    ),
                };
            });
        });

        socket.on('order-rejected-by-all', (data: { orderId: string }) => {
            console.log('❌ All delivery boys rejected order:', data);

            setState(prev => {
                if (prev.currentNotification?.orderId === data.orderId) {
                    const nextNotification = prev.notificationQueue[0] || null;
                    return {
                        ...prev,
                        currentNotification: nextNotification,
                        notificationQueue: prev.notificationQueue.slice(1),
                    };
                }
                return {
                    ...prev,
                    notificationQueue: prev.notificationQueue.filter(
                        notif => notif.orderId !== data.orderId
                    ),
                };
            });
        });

        socket.on('disconnect', (reason: any) => {
            console.log('❌ Delivery notification socket disconnected:', reason);
            setState(prev => ({ ...prev, isConnected: false }));

            if (reason === 'io server disconnect' || reason === 'io client disconnect') {
                return;
            }

            attemptReconnect();
        });

        socket.on('connect_error', (error: any) => {
            console.error('Socket connection error:', error);
            setState(prev => ({
                ...prev,
                isConnected: false,
                error: 'Failed to connect to notification server',
            }));

            attemptReconnect();
        });

        socket.on('error', (error: any) => {
            console.error('Socket error:', error);
            setState(prev => ({
                ...prev,
                error: 'Notification service error',
            }));
        });

        return socket;
    }, [isAuthenticated, user, rehydratePendingAlerts]);

    const attemptReconnect = useCallback(() => {
        reconnectAttemptsRef.current += 1;

        if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
            console.log('❌ Max reconnection attempts reached');
            setState(prev => ({
                ...prev,
                error: 'Unable to connect. Please refresh the page.',
            }));
            return;
        }

        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1);
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
            disconnectSocket();
            connectSocket();
        }, delay);
    }, [connectSocket]);

    const disconnectSocket = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }, []);

    const handleAccept = useCallback(async (orderId: string, navigate?: (path: string) => void) => {
        if (!socketRef.current || !user?.id) {
            return { success: false, message: 'Not connected or user not found' };
        }

        try {
            const result = await acceptOrder(socketRef.current, orderId, user.id);

            if (result.success) {
                setState(prev => {
                    const nextNotification = prev.notificationQueue[0] || null;
                    return {
                        ...prev,
                        currentNotification: nextNotification,
                        notificationQueue: prev.notificationQueue.slice(1),
                    };
                });

                if (navigate) {
                    navigate(`/delivery/orders/${orderId}`);
                }
            } else if (result.message === 'Order notification not found') {
                console.warn('⚠️ clearing stale notification:', orderId);
                setState(prev => {
                    const nextNotification = prev.notificationQueue[0] || null;
                    return {
                        ...prev,
                        currentNotification: nextNotification,
                        notificationQueue: prev.notificationQueue.slice(1),
                    };
                });
            }

            return result;
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to accept order' };
        }
    }, [user]);

    const handleReject = useCallback(async (orderId: string) => {
        if (!socketRef.current || !user?.id) {
            return { success: false, message: 'Not connected or user not found', allRejected: false };
        }

        setState(prev => {
            const nextNotification = prev.notificationQueue[0] || null;
            return {
                ...prev,
                currentNotification: nextNotification,
                notificationQueue: prev.notificationQueue.slice(1),
            };
        });

        try {
            const result = await rejectOrder(socketRef.current, orderId, user.id);
            return result;
        } catch (error: any) {
            console.error('Failed to reject order in background:', error);
            return { success: false, message: error.message || 'Failed to reject order', allRejected: false };
        }
    }, [user]);

    const clearCurrentNotification = useCallback(() => {
        setState(prev => {
            const nextNotification = prev.notificationQueue[0] || null;
            return {
                ...prev,
                currentNotification: nextNotification,
                notificationQueue: prev.notificationQueue.slice(1),
            };
        });
    }, []);

    useEffect(() => {
        if (!isAuthenticated || user?.userType !== 'Delivery' || !user?.id) {
            disconnectSocket();
            return;
        }

        if (!hasRehydratedRef.current) {
            hasRehydratedRef.current = true;
            rehydratePendingAlerts();
        }

        const socket = connectSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            disconnectSocket();
        };
    }, [isAuthenticated, user, connectSocket, disconnectSocket, rehydratePendingAlerts]);

    return {
        currentNotification: state.currentNotification,
        notificationQueue: state.notificationQueue,
        isConnected: state.isConnected,
        error: state.error,
        acceptOrder: handleAccept,
        rejectOrder: handleReject,
        clearNotification: clearCurrentNotification,
        socket: socketRef.current,
    };
};


