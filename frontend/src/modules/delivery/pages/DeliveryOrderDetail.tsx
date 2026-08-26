import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getOrderDetails, updateOrderStatus, getSellerLocationsForOrder, sendDeliveryOtp, verifyDeliveryOtp, updateDeliveryLocation, checkSellerProximity, confirmSellerPickup, checkCustomerProximity } from '../../../services/api/delivery/deliveryService';
import deliveryIcon from '@assets/deliveryboy/deliveryIcon.png';
import GoogleMapsTracking from '../../../components/GoogleMapsTracking';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { acceptOrder, rejectOrder } from '../../../services/api/delivery/deliveryOrderNotificationService';
import { getTranslatedDeliveryStatus } from '../utils/deliveryStatusHelper';
import { getSocketBaseURL, getAuthToken } from '../../../services/api/config';
import { useRingtoneAlert } from '../../../hooks/useRingtoneAlert';

// Helper to get delivery icon URL (works in both dev and production)
const getDeliveryIconUrl = () => {
    // Try imported path first (Vite will process this in production)
    if (deliveryIcon && typeof deliveryIcon === 'string') {
        return deliveryIcon;
    }
    // Fallback to public path
    return '/assets/deliveryboy/deliveryIcon.png';
};

// Icons components to avoid external dependency issues
const Icons = {
    ChevronLeft: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M15 18l-6-6 6-6" />
        </svg>
    ),
    MapPin: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    ),
    User: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    Phone: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    ),
    Clock: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    CheckCircle: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    ),
    Truck: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
    ),
    ShoppingBag: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    ),
    Navigation: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
    ),
    Store: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    ),
    AlertTriangle: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    )
};

type DeliveryOrderStatus = 'Pending' | 'Ready for pickup' | 'Picked up' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | 'Returned';

export default function DeliveryOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const { user } = useAuth();
    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [acceptingOrder, setAcceptingOrder] = useState(false);
    const [rejectingOrder, setRejectingOrder] = useState(false);
    const [sellerLocations, setSellerLocations] = useState<any[]>([]);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [deliveryBoyLocation, setDeliveryBoyLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    // New state for seller proximity and pickup tracking
    const [sellerProximity, setSellerProximity] = useState<Record<string, { withinRange: boolean; distance: number }>>({});
    const [pickupLoading, setPickupLoading] = useState<Record<string, boolean>>({});

    // New state for customer proximity
    const [customerProximity, setCustomerProximity] = useState<{ withinRange: boolean; distance: number } | null>(null);
    const [getOtpEnabled, setGetOtpEnabled] = useState(false);
    const [isTestMode, setIsTestMode] = useState(false);

    const fetchOrder = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await getOrderDetails(id);
            setOrder(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load order details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrder();
    }, [id]);

    // Socket.IO listener for real-time order acceptance and status synchronization
    useEffect(() => {
        if (!id) return;
        const socketUrl = getSocketBaseURL();
        const token = getAuthToken();
        const socket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
            socket.emit('join-order-room', id);
        });

        socket.on('order-updated', (data: any) => {
            if (data?.orderId === id || data?.id === id) {
                fetchOrder();
            }
        });

        socket.on('order-accepted', (data: any) => {
            if (data?.orderId === id || data?.id === id) {
                fetchOrder();
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [id]);

    // Fetch seller locations when order is assigned — never for cancelled/returned/delivered
    useEffect(() => {
        const fetchSellerLocations = async () => {
            if (!id || !order) return;
            const skipStatuses = ['Picked up', 'Delivered', 'Cancelled', 'Returned'];
            if (order.status && !skipStatuses.includes(order.status)) {
                try {
                    const locations = await getSellerLocationsForOrder(id);
                    setSellerLocations(locations || []);
                } catch (err) {
                    console.error('Failed to fetch seller locations:', err);
                }
            } else if (order.status === 'Cancelled' || order.status === 'Returned') {
                setSellerLocations([]);
            }
        };
        fetchSellerLocations();
    }, [id, order?.status]);

    // Clean up when component unmounts
    useEffect(() => {
        return () => {
            if (locationIntervalRef.current) {
                clearInterval(locationIntervalRef.current);
            }
        };
    }, []);

    const isAssignedToMe = Boolean(
        order &&
        order.deliveryBoy &&
        (typeof order.deliveryBoy === 'object'
            ? (order.deliveryBoy._id?.toString() === user?.id || order.deliveryBoy.id?.toString() === user?.id)
            : order.deliveryBoy?.toString() === user?.id)
    );

    const isOfferPending = Boolean(
        order &&
        !isAssignedToMe &&
        order.status !== 'Delivered' &&
        order.status !== 'Cancelled' &&
        order.status !== 'Returned'
    );

    // Play ringtone while this offer is pending acceptance
    useRingtoneAlert('/assets/sound/delivery-alert.mp3', isOfferPending);

    const handleSendOtp = async () => {
        if (!id) return;
        try {
            setOtpSending(true);
            const coords = deliveryBoyLocation ? { latitude: deliveryBoyLocation.lat, longitude: deliveryBoyLocation.lng } : undefined;
            await sendDeliveryOtp(id, coords);
            setShowOtpInput(true);
            showToast('OTP sent to customer successfully', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to send OTP', 'error');
        } finally {
            setOtpSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!id || !otpValue) {
            showToast('Please enter OTP', 'info');
            return;
        }
        try {
            setOtpVerifying(true);
            const result = await verifyDeliveryOtp(id, otpValue);
            showToast(result.message || 'OTP verified successfully. Order marked as delivered.', 'success');
            await fetchOrder(); // Refresh order data
            setShowOtpInput(false);
            setOtpValue('');
        } catch (err: any) {
            showToast(err.message || 'Failed to verify OTP', 'error');
        } finally {
            setOtpVerifying(false);
        }
    };

    const handleAcceptUnassigned = async () => {
        if (!id || !user?.id) return;
        setAcceptingOrder(true);
        try {
            const res = await acceptOrder(null, id, user.id);
            if (res.success) {
                showToast('Order accepted successfully', 'success');
                // Immediately transition local state so pending offer disappears without waiting
                setOrder((prev: any) => prev ? {
                    ...prev,
                    deliveryBoy: user.id,
                    deliveryBoyStatus: 'Assigned',
                    status: 'Processed'
                } : prev);
                await fetchOrder();
            } else {
                showToast(res.message || 'Failed to accept order', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error accepting order', 'error');
        } finally {
            setAcceptingOrder(false);
        }
    };

    const handleRejectUnassigned = async () => {
        if (!id || !user?.id) return;
        setRejectingOrder(true);
        try {
            const res = await rejectOrder(null, id, user.id);
            if (res.success) {
                showToast('Order rejected', 'info');
                navigate('/delivery');
            } else {
                showToast(res.message || 'Failed to reject order', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error rejecting order', 'error');
        } finally {
            setRejectingOrder(false);
        }
    };

    // Handle seller pickup confirmation
    const handleSellerPickup = async (sellerId: string) => {
        if (!id || !deliveryBoyLocation) {
            showToast('Location not available', 'error');
            return;
        }

        try {
            setPickupLoading(prev => ({ ...prev, [sellerId]: true }));
            const result = await confirmSellerPickup(id, sellerId, deliveryBoyLocation.lat, deliveryBoyLocation.lng);
            showToast(result.message || 'Pickup confirmed successfully', 'success');
            await fetchOrder(); // Refresh order data
        } catch (err: any) {
            showToast(err.message || 'Failed to confirm pickup', 'error');
        } finally {
            setPickupLoading(prev => ({ ...prev, [sellerId]: false }));
        }
    };

    // Check proximity to sellers (runs periodically)
    useEffect(() => {
        const checkSellersProximity = async () => {
            if (!id || !deliveryBoyLocation || !sellerLocations.length) return;
            if (order?.status === 'Out for Delivery' || order?.status === 'Delivered') return;

            const proximityChecks: Record<string, { withinRange: boolean; distance: number }> = {};

            for (const seller of sellerLocations) {
                try {
                    const response = await checkSellerProximity(
                        id,
                        seller.sellerId,
                        deliveryBoyLocation.lat,
                        deliveryBoyLocation.lng
                    );
                    if (response.success && response.data) {
                        proximityChecks[seller.sellerId] = {
                            withinRange: response.data.withinRange,
                            distance: response.data.distanceMeters
                        };
                    }
                } catch (error) {
                    console.error(`Failed to check proximity for seller ${seller.sellerId}:`, error);
                }
            }

            setSellerProximity(proximityChecks);
        };

        if (sellerLocations.length > 0 && deliveryBoyLocation) {
            checkSellersProximity();
            const interval = setInterval(checkSellersProximity, 4000); // Check every 4 seconds
            return () => clearInterval(interval);
        }
    }, [id, deliveryBoyLocation, sellerLocations, order?.status]);

    // Check proximity to customer (runs periodically)
    useEffect(() => {
        const checkCustomerProx = async () => {
            if (!id) return;
            if (order?.status !== 'Out for Delivery') return;

            try {
                const lat = deliveryBoyLocation?.lat ?? 0;
                const lng = deliveryBoyLocation?.lng ?? 0;
                const response = await checkCustomerProximity(id, lat, lng);
                if (response.success && response.data) {
                    if (response.data.testMode) {
                        setIsTestMode(true);
                        setGetOtpEnabled(true);
                    } else {
                        setIsTestMode(false);
                        setCustomerProximity({
                            withinRange: response.data.withinRange,
                            distance: response.data.distanceMeters
                        });
                        setGetOtpEnabled(response.data.withinRange);
                    }
                }
            } catch (error) {
                console.error('Failed to check customer proximity:', error);
            }
        };

        if (order?.status === 'Out for Delivery') {
            checkCustomerProx();
            const interval = setInterval(checkCustomerProx, 4000); // Check every 4 seconds
            return () => clearInterval(interval);
        }
    }, [id, deliveryBoyLocation, order?.status]);

    // Track if location permission was denied
    const locationPermissionDeniedRef = useRef<boolean>(false);

    // Get delivery boy's current location
    useEffect(() => {
        const getCurrentLocation = () => {
            if (!navigator.geolocation) {
                console.warn('Geolocation is not supported by this browser');
                return;
            }

            if (locationPermissionDeniedRef.current) {
                // Don't retry if permission was denied
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setDeliveryBoyLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                    locationPermissionDeniedRef.current = false; // Reset on success
                    setLocationError(null);
                },
                (error: GeolocationPositionError) => {
                    // Handle different error types
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            locationPermissionDeniedRef.current = true;
                            setLocationError('Location permission denied. Please enable location access in your browser settings to track delivery.');
                            console.warn('Location permission denied. Please enable location access in your browser settings.');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            setLocationError('Location information unavailable. Please check your device settings.');
                            console.warn('Location information unavailable. Please check your device settings.');
                            break;
                        case error.TIMEOUT:
                            setLocationError('Location request timed out. Please try again.');
                            console.warn('Location request timed out. Please try again.');
                            break;
                        default:
                            setLocationError(`Error getting location: ${error.message}`);
                            console.warn('Error getting location:', error.message);
                            break;
                    }
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        };

        getCurrentLocation();
    }, []);



    // Socket.io connection
    const socketRef = useRef<any>(null);
    const [socketConnected, setSocketConnected] = useState(false);

    // Initialize Socket
    useEffect(() => {
        let isMounted = true;
        let socket: any = null;

        const initializeSocket = async () => {
            try {
                const [{ io }, { getSocketBaseURL, getAuthToken }] = await Promise.all([
                    import('socket.io-client'),
                    import('../../../services/api/config')
                ]);

                if (!isMounted) return;

                const baseURL = getSocketBaseURL();
                const token = getAuthToken();

                socket = io(baseURL, {
                    auth: { token },
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 2000
                });

                socket.on('connect', () => {
                    if (isMounted) {
                        console.log('✅ Delivery Socket Connected:', socket.id);
                        setSocketConnected(true);
                    }
                });

                socket.on('disconnect', (reason: string) => {
                    if (isMounted) {
                        console.log('❌ Delivery Socket Disconnected:', reason);
                        setSocketConnected(false);
                    }
                });

                socket.on('connect_error', (error: any) => {
                    if (isMounted && error.message !== 'Invalid namespace') {
                        console.warn('⚠️ Delivery Socket Connection Notice:', error.message);
                    }
                });

                // Listen for order cancellation — delivery boy should know and become available for next order
                socket.on('order-cancelled', (data: any) => {
                    if (isMounted && data.orderId === id) {
                        console.log('Order cancelled event received:', data);
                        setOrder((prev: any) => prev ? { ...prev, status: 'Cancelled' } : null);
                        setSellerLocations([]);
                        showToast(data.message || 'Order has been cancelled. You are now available for the next order.', 'info');
                        setTimeout(() => navigate('/delivery'), 500);
                    }
                });

                socketRef.current = socket;
            } catch (err) {
                console.error('Failed to initialize socket:', err);
            }
        };

        initializeSocket();

        return () => {
            isMounted = false;
            if (socket) {
                console.log('🔌 Disconnecting delivery socket...');
                socket.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    // Helper to get socket (for use in other effects)
    const getSocket = useCallback(() => socketRef.current, []);


    // Update delivery boy location from geolocation updates (Socket)
    useEffect(() => {
        if (!id || !order) return;

        const shouldTrack = order.status && order.status !== 'Delivered' && order.status !== 'Cancelled' && order.status !== 'Returned';
        const socket = socketRef.current;

        if (shouldTrack && socketConnected && socket) {
            const updateLocation = async () => {
                if (!navigator.geolocation) return;
                if (locationPermissionDeniedRef.current) return;

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const newLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        };
                        setDeliveryBoyLocation(newLocation);
                        setLastUpdate(new Date());

                        // Emit via Socket
                        socket.emit('update-location', {
                            orderId: id,
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        });

                        locationPermissionDeniedRef.current = false;
                    },
                    (error: GeolocationPositionError) => {
                        // ... error handling ...
                        if (error.code === error.PERMISSION_DENIED) {
                            if (!locationPermissionDeniedRef.current) {
                                locationPermissionDeniedRef.current = true;
                                console.warn('Location permission denied.');
                            }
                        }
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            };

            // Initial update
            updateLocation();

            // Interval (4 seconds)
            locationIntervalRef.current = setInterval(updateLocation, 4000);

            return () => {
                if (locationIntervalRef.current) {
                    clearInterval(locationIntervalRef.current);
                    locationIntervalRef.current = null;
                }
            };
        } else {
            if (locationIntervalRef.current) {
                clearInterval(locationIntervalRef.current);
                locationIntervalRef.current = null;
            }
        }
    }, [id, order?.status, socketConnected]);


    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
                <p className="text-neutral-500">Loading order...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center flex-col">
                <p className="text-red-500 mb-4">{error || 'Order not found'}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 bg-neutral-200 rounded-lg text-neutral-700 font-medium"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const statusFlow: DeliveryOrderStatus[] = ['Pending', 'Ready for pickup', 'Picked up', 'Out for Delivery', 'Delivered'];

    let currentStatusIndex = statusFlow.indexOf(order.status as DeliveryOrderStatus);
    // Handle cases where status might not be in the flow (e.g. Cancelled)
    if (currentStatusIndex === -1 && (order.status === 'Cancelled' || order.status === 'Returned')) {
        // Maybe show a different UI for cancelled/returned orders
        currentStatusIndex = -1;
    }

    const handleStatusChange = async (newStatus: DeliveryOrderStatus) => {
        if (!id) return;
        try {
            setLoading(true); // Or use a separate loading state for the action
            const updatedOrder = await updateOrderStatus(id, newStatus);
            // Verify the update was successful and update local state
            if (updatedOrder && updatedOrder.data) {
                setOrder(updatedOrder.data);
            } else {
                // Fallback - re-fetch everything
                await fetchOrder();
            }
        } catch (err: any) {
            showToast(err.message || "Failed to update status", "error");
            setLoading(false);
        }
    };

    const getNextStatus = () => {
        if (currentStatusIndex !== -1 && currentStatusIndex < statusFlow.length - 1) {
            return statusFlow[currentStatusIndex + 1];
        }
        return null;
    };

    const nextStatus = getNextStatus();
    const isCancelledOrReturned = order.status === 'Cancelled' || order.status === 'Returned';
    const isMapVisible = !isCancelledOrReturned && (order.status === 'Out for Delivery' || order.status === 'Picked up' || (sellerLocations.length > 0 && order.status !== 'Delivered'));
    const showSellerLocations = !isCancelledOrReturned && sellerLocations.length > 0 && order.status !== 'Picked up' && order.status !== 'Out for Delivery' && order.status !== 'Delivered';
    const showCustomerLocation = order.status === 'Picked up' || order.status === 'Out for Delivery';

    // Check if we have valid customer coordinates
    const customerLat = order.deliveryAddress?.latitude || order.address?.latitude;
    const customerLng = order.deliveryAddress?.longitude || order.address?.longitude;
    const hasValidCustomerLocation = !!(customerLat && customerLng && customerLat !== 0 && customerLng !== 0);

    return (
        <div className="min-h-screen bg-neutral-50 pb-32 relative">

            {/* Top Bar with Back Button */}
            <div className="sticky top-0 z-20 bg-white border-b border-neutral-100 px-4 py-3 flex items-center shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
                >
                    <Icons.ChevronLeft size={24} />
                </button>
                <span className="ml-2 font-semibold text-lg text-neutral-800">{t("delivery.orderDetails", "Order Details")}</span>

                <div className="ml-auto">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                        order.status === 'Cancelled' || order.status === 'Returned' ? 'bg-red-100 text-red-700' :
                            order.status === 'Picked up' ? 'bg-indigo-100 text-indigo-700' :
                                order.status === 'Ready for pickup' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-orange-100 text-orange-700'
                        }`}>
                        {getTranslatedDeliveryStatus(order.status, t)}
                    </span>
                </div>
            </div>

            {/* Unassigned / Pending Order Acceptance Prompt */}
            {isOfferPending && (
                <div className="mx-4 mt-4 p-4 bg-amber-50 border-2 border-amber-400 rounded-xl shadow-md">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-amber-900 text-base">New Delivery Offer Pending</h4>
                        <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-semibold">Action Required</span>
                    </div>
                    <p className="text-sm text-amber-800 mb-4 leading-snug">
                        This order is not accepted by you yet. Please explicitly accept or reject this delivery request.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleRejectUnassigned}
                            disabled={rejectingOrder || acceptingOrder}
                            className="flex-1 py-2.5 bg-neutral-200 hover:bg-neutral-300 active:bg-neutral-400 text-neutral-800 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                            {rejectingOrder ? 'Rejecting...' : 'Reject Order'}
                        </button>
                        <button
                            onClick={handleAcceptUnassigned}
                            disabled={acceptingOrder || rejectingOrder}
                            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold rounded-lg text-sm transition-colors shadow-md disabled:opacity-50"
                        >
                            {acceptingOrder ? 'Accepting...' : 'Accept Order'}
                        </button>
                    </div>
                </div>
            )}

            {/* Order cancelled / returned — no locations shown, delivery boy available for next order */}
            {isCancelledOrReturned && (
                <div className="mx-4 mt-4 p-5 bg-red-50 border border-red-200 rounded-xl">
                    <p className="font-semibold text-red-800">This order has been {String(order.status || "").toLowerCase()}.</p>
                    <p className="text-sm text-red-700 mt-1">You are now available for the next order.</p>
                    <button
                        onClick={() => navigate('/delivery')}
                        className="mt-4 w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700"
                    >
                        Back to Dashboard
                    </button>
                </div>
            )}

            {/* Location Error Warning */}
            {locationError && (
                <div className="mx-4 mt-4 bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                    <Icons.AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-800">Location Access Required</p>
                        <p className="text-xs text-red-600 mt-0.5">{locationError}</p>
                    </div>
                </div>
            )}

            {/* Google Maps View - Shared Component for Parity */}
            {isMapVisible && (
                <GoogleMapsTracking
                    sellerLocations={
                        (order.status === 'Out for Delivery' || order.status === 'Picked up')
                            ? []  // Hide seller markers when delivering to customer
                            : sellerLocations.map(s => ({
                                lat: s.latitude,
                                lng: s.longitude,
                                name: s.storeName
                            }))
                    }
                    customerLocation={{
                        lat: order.deliveryAddress?.latitude || order.address?.latitude || 0,
                        lng: order.deliveryAddress?.longitude || order.address?.longitude || 0
                    }}
                    deliveryLocation={deliveryBoyLocation || undefined}
                    isTracking={!!deliveryBoyLocation}
                    showRoute={!!deliveryBoyLocation && (
                        ((order.status === 'Picked up' || order.status === 'Out for Delivery') && hasValidCustomerLocation) ||
                        (sellerLocations.length > 0 && order.status !== 'Delivered' && order.status !== 'Picked up' && order.status !== 'Out for Delivery')
                    )}
                    routeOrigin={deliveryBoyLocation || undefined}
                    routeDestination={
                        order.status === 'Picked up' || order.status === 'Out for Delivery'
                            ? (hasValidCustomerLocation ? {
                                lat: customerLat!,
                                lng: customerLng!
                            } : undefined)
                            : sellerLocations.length > 0
                                ? { lat: sellerLocations[sellerLocations.length - 1].latitude, lng: sellerLocations[sellerLocations.length - 1].longitude }
                                : undefined
                    }
                    routeWaypoints={
                        order.status === 'Picked up' || order.status === 'Out for Delivery'
                            ? []
                            : sellerLocations.length > 1
                                ? sellerLocations.slice(0, -1).map(s => ({ lat: s.latitude, lng: s.longitude }))
                                : []
                    }
                    destinationName={
                        order.status === 'Picked up' || order.status === 'Out for Delivery'
                            ? order.address?.split(',')[0]
                            : sellerLocations.length > 0
                                ? sellerLocations[0].storeName
                                : undefined
                    }
                    onRouteInfoUpdate={setRouteInfo}
                    lastUpdate={lastUpdate}
                />
            )}

            {/* Seller Locations Card with Pickup Buttons (before all sellers picked up) */}
            {showSellerLocations && sellerLocations.length > 0 && (
                <div className="p-4">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                                <Icons.Store size={18} className="text-neutral-500" />
                                {t("delivery.sellerPickupLocations", "Seller Pickup Locations")}
                            </h3>
                            {sellerLocations.length > 1 && (
                                <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full">
                                    {order?.sellerPickups?.filter((p: any) => p.pickedUpAt)?.length || 0} / {sellerLocations.length} Picked Up
                                </span>
                            )}
                        </div>
                        <div className="space-y-3">
                            {sellerLocations.map((seller: any, idx: number) => {
                                const isPickedUp = order?.sellerPickups?.some(
                                    (p: any) => (p.seller?._id?.toString() || p.seller?.toString()) === (seller.sellerId?.toString() || seller._id?.toString()) && p.pickedUpAt
                                );
                                const proximity = sellerProximity[seller.sellerId];
                                const withinRange = proximity?.withinRange || false;
                                const distance = proximity?.distance;
                                const isLoading = pickupLoading[seller.sellerId] || false;

                                return (
                                    <div key={idx} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {sellerLocations.length > 1 && (
                                                        <span className="text-xs font-bold px-1.5 py-0.5 bg-neutral-200 text-neutral-700 rounded">
                                                            #{idx + 1}
                                                        </span>
                                                    )}
                                                    <p className="font-semibold text-neutral-900">{seller.storeName}</p>
                                                    {isPickedUp && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                            <Icons.CheckCircle size={12} />
                                                            {t("delivery.pickedUp", "Picked Up")}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-neutral-600">{seller.address}, {seller.city}</p>
                                                {distance !== undefined && (
                                                    <p className={`text-xs mt-1 font-medium ${withinRange ? 'text-green-600' :
                                                        distance < 1000 ? 'text-yellow-600' : 'text-red-600'
                                                        }`}>
                                                        {distance < 1000 ? `${distance}m away` : `${(distance / 1000).toFixed(1)}km away`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {isOfferPending ? (
                                            <div className="w-full py-2 bg-amber-50 text-amber-800 border border-amber-200 text-center rounded-lg font-medium text-xs">
                                                Accept delivery offer above to enable pickup
                                            </div>
                                        ) : !isPickedUp ? (
                                            <button
                                                onClick={() => handleSellerPickup(seller.sellerId)}
                                                disabled={!withinRange || isLoading}
                                                className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${withinRange && !isLoading
                                                    ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
                                                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                {isLoading
                                                    ? t("common.loading", "Confirming...")
                                                    : withinRange
                                                        ? (sellerLocations.length > 1 ? `Confirm Pickup (${idx + 1} of ${sellerLocations.length})` : t("delivery.confirmPickup", "Confirm Pickup"))
                                                        : 'Move within 500m to pickup'}
                                            </button>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 space-y-4 max-w-lg mx-auto">

                {/* Status Stepper Card */}
                {currentStatusIndex !== -1 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-1">{t("delivery.process", "Process")}</p>
                                <h2 className="text-lg font-bold text-neutral-900">{t("delivery.orderProgress", "Order Progress")}</h2>
                            </div>
                        </div>

                        {/* Status Progress Bar */}
                        <div className="relative">
                            <div className="flex justify-between mb-2 relative z-10">
                                {statusFlow.map((step, idx) => (
                                    <div key={idx} className="flex flex-col items-center flex-1">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${idx <= currentStatusIndex
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'bg-white border-neutral-200 text-neutral-300'
                                            }`}>
                                            {idx <= currentStatusIndex ? <Icons.CheckCircle size={14} /> : idx + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Connecting Line */}
                            <div className="absolute top-4 left-0 w-full h-0.5 bg-neutral-100 -z-0">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-500"
                                    style={{ width: `${(currentStatusIndex / (statusFlow.length - 1)) * 100}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-neutral-500 font-medium mt-2">
                                {statusFlow.map((step, idx) => (
                                    <span key={idx} className={`text-center flex-1 transition-colors ${idx === currentStatusIndex ? 'text-blue-600 font-bold' : ''}`}>
                                        {getTranslatedDeliveryStatus(step, t)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}


                {/* Customer Details */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                    <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                        <Icons.User size={18} className="text-neutral-500" />
                        {t("delivery.customerDetails", "Customer Details")}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                                <Icons.User size={20} />
                            </div>
                            <div>
                                <p className="font-medium text-neutral-900">{order.customerName}</p>
                                <p className="text-sm text-neutral-500">{t("delivery.customer", "Customer")}</p>
                            </div>
                            <button
                                onClick={() => window.open(`tel:${order.customerPhone}`, '_system')}
                                className="ml-auto p-3 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-md transition-transform hover:scale-105 active:scale-95"
                            >
                                <Icons.Phone size={20} />
                            </button>
                        </div>
                        <div className="flex items-start gap-3 pt-3 border-t border-neutral-50">
                            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 text-orange-600">
                                <Icons.MapPin size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-neutral-800 leading-relaxed font-medium">
                                    {(() => {
                                        // Prefer the rich deliveryAddress snapshot from the order over the flat address string
                                        if (order.deliveryAddress && typeof order.deliveryAddress === 'object') {
                                            const addr = order.deliveryAddress as any;
                                            const raw = (addr.address || addr.street || '').replace(/^Current Location,?\s*/i, '').trim();
                                            const city = (addr.city || '').trim();
                                            const pincode = (addr.pincode || '').trim();
                                            const lc = raw.toLowerCase();
                                            const extras = [];
                                            if (city && !lc.includes(city.toLowerCase())) extras.push(city);
                                            if (pincode && !lc.includes(pincode)) extras.push(pincode);
                                            return [raw, ...extras].filter(Boolean).join(', ') || 'N/A';
                                        }
                                        return (order.address || 'N/A').replace(/^Current Location,?\s*/i, '');
                                    })()}
                                </p>
                                {customerLat && customerLng && customerLat !== 0 && (
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-mono text-neutral-500">
                                            📍 {Number(customerLat).toFixed(6)}, {Number(customerLng).toFixed(6)}
                                        </span>
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${customerLat},${customerLng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-[11px] transition-colors shadow-xs"
                                        >
                                            <span>Open in Maps</span>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                <polyline points="15 3 21 3 21 9" />
                                                <line x1="10" y1="14" x2="21" y2="3" />
                                            </svg>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Delivery Earning Card - Show only if delivered or has earning */}
                {(order.status === 'Delivered' || (order.deliveryEarning && order.deliveryEarning > 0)) && (
                    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-5 shadow-sm text-white mb-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-green-100 text-xs font-medium mb-1">{t("delivery.yourEarning", "Your Earning")}</p>
                                <h3 className="text-2xl font-bold">₹ {order.deliveryEarning?.toFixed(2) || '0.00'}</h3>
                            </div>
                            <div className="bg-white/20 p-2 rounded-lg">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}

                {/* Order Items */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                            <Icons.ShoppingBag size={18} className="text-neutral-500" />
                            {t("delivery.orderSummary", "Order Summary")}
                        </h3>
                        <span className="text-xs font-medium text-neutral-500 px-2 py-1 bg-neutral-100 rounded-md">
                            {order.items?.length || 0} {order.items?.length === 1 ? t("delivery.item", "item") : t("delivery.items", "items")}
                        </span>
                    </div>

                    <div className="space-y-3">
                        {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-neutral-50 last:border-0">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">{item.quantity}x</span>
                                    <span className="text-sm text-neutral-700 font-medium">{item.name}</span>
                                </div>
                                <span className="text-sm font-semibold text-neutral-900">₹{item.price * item.quantity}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-dashed border-neutral-200 flex justify-between items-center">
                        <span className="font-semibold text-neutral-700">{t("delivery.totalAmount", "Total Amount")}</span>
                        <span className="text-xl font-bold text-neutral-900">₹{order.totalAmount}</span>
                    </div>
                </div>

                {/* Order Info */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 mb-20">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-neutral-50 rounded-lg">
                            <p className="text-xs text-neutral-500 mb-1">{t("delivery.orderNumber", "Order Number")}</p>
                            <p className="text-sm font-bold text-neutral-900">{order.orderId}</p>
                        </div>
                        <div className="p-3 bg-neutral-50 rounded-lg">
                            <p className="text-xs text-neutral-500 mb-1">{t("delivery.orderDate", "Order Date")}</p>
                            <p className="text-sm font-bold text-neutral-900">
                                {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Customer Delivery OTP Section (only when order is Out for Delivery) */}
            {order.status === 'Out for Delivery' && (
                <div className="fixed bottom-24 left-6 right-6 z-30">
                    <div className="bg-white rounded-2xl p-4 shadow-2xl border border-neutral-200">
                        {isTestMode && (
                            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm">
                                <span>⚡ Development Test Mode</span>
                                <span className="text-[11px] text-amber-700">GPS verification bypassed</span>
                            </div>
                        )}
                        <p className="text-sm font-semibold text-neutral-900 mb-3">{t("delivery.customerDeliveryOtp", "Customer Delivery OTP")}</p>

                        {/* Distance indicator */}
                        {customerProximity && (
                            <p className={`text-xs mb-2 font-medium ${customerProximity.withinRange ? 'text-green-600' :
                                customerProximity.distance < 1000 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                {customerProximity.distance < 1000
                                    ? `${customerProximity.distance}m from customer`
                                    : `${(customerProximity.distance / 1000).toFixed(1)}km from customer`}
                            </p>
                        )}

                        {/* 4-digit OTP Input - Always visible but disabled until OTP is sent */}
                        <input
                            type="text"
                            value={otpValue}
                            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="Enter 4-digit OTP"
                            disabled={!showOtpInput}
                            className={`w-full px-4 py-3 border rounded-xl text-lg font-semibold text-center mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${showOtpInput ? 'border-neutral-300 bg-white' : 'border-neutral-200 bg-neutral-100 text-neutral-400'
                                }`}
                            maxLength={4}
                        />

                        <div className="flex gap-3">
                            {!showOtpInput ? (
                                <button
                                    onClick={handleSendOtp}
                                    disabled={!getOtpEnabled || otpSending}
                                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${getOtpEnabled && !otpSending
                                        ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
                                        : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                        }`}
                                >
                                    {otpSending ? t("delivery.sending", "Sending...") : getOtpEnabled ? t("delivery.getOtp", "Get OTP") : 'Move within 500m to get OTP'}
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            setShowOtpInput(false);
                                            setOtpValue('');
                                        }}
                                        className="flex-1 py-3 rounded-xl bg-neutral-200 text-neutral-700 font-semibold hover:bg-neutral-300 transition-colors"
                                    >
                                        {t("delivery.cancel", "Cancel")}
                                    </button>
                                    <button
                                        onClick={handleVerifyOtp}
                                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
                                        disabled={otpVerifying || otpValue.length !== 4}
                                    >
                                        {otpVerifying ? t("delivery.verifying", "Verifying...") : t("delivery.verifyOtp", "Verify OTP")}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Glassmorphic Action Button Dock - Order Taken button or status update */}
            {/* Hide this button when order is "Out for Delivery" because OTP section is shown instead */}
            {nextStatus && order.status !== 'Picked up' && order.status !== 'Out for Delivery' && !showOtpInput && (
                <div className="fixed bottom-24 left-6 right-6 z-30">
                    <button
                        onClick={() => handleStatusChange(nextStatus)}
                        className="w-full py-4 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] text-white font-bold text-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-3 overflow-hidden group"
                        disabled={loading}
                    >
                        <span className="relative z-10">
                            {loading ? 'Updating...' : nextStatus === 'Picked up' ? t("delivery.orderTaken", "Order Taken") : `Mark as ${getTranslatedDeliveryStatus(nextStatus, t)}`}
                        </span>
                        {!loading && <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center relative z-10 group-hover:bg-white/30 transition-colors">
                            <Icons.ChevronLeft className="rotate-180" size={18} />
                        </div>}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
                    </button>
                </div>
            )}
        </div>
    );
}
