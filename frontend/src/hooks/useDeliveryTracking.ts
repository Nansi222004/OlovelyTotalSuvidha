import { useState, useEffect, useCallback, useRef } from 'react'
// @ts-ignore - socket.io-client types may not be available
import { io, Socket } from 'socket.io-client'
import { getSocketBaseURL } from '../services/api/config'

interface LocationUpdate {
    orderId: string
    location: {
        latitude: number
        longitude: number
        timestamp: Date
    }
    eta: number
    distance: number
    status: string
    timestamp: Date
}

interface TrackingData {
    deliveryLocation: { lat: number; lng: number } | null
    eta: number
    distance: number
    status: string
    orderStatus: string | null // The actual order status (Placed, Out for Delivery, Delivered, etc.)
    isConnected: boolean
    lastUpdate: Date | null
    error: string | null
    reconnectAttempts: number
}

const MAX_RECONNECT_ATTEMPTS = 5
const INITIAL_RECONNECT_DELAY = 2000 // 2 seconds

export const useDeliveryTracking = (orderId: string | undefined) => {
    const [trackingData, setTrackingData] = useState<TrackingData>({
        deliveryLocation: null,
        eta: 30,
        distance: 0,
        status: 'idle',
        orderStatus: null,
        isConnected: false,
        lastUpdate: null,
        error: null,
        reconnectAttempts: 0,
    })

    const socketRef = useRef<Socket | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const reconnectAttemptsRef = useRef(0)

    const connectSocket = useCallback(() => {
        if (!orderId) return

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }

        const token = localStorage.getItem('authToken')
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
        })

        socketRef.current = socket

        socket.on('connect', () => {
            console.log('🔌 Socket connected')
            reconnectAttemptsRef.current = 0
            setTrackingData(prev => ({
                ...prev,
                isConnected: true,
                error: null,
                reconnectAttempts: 0
            }))

            // Subscribe to order tracking
            socket.emit('track-order', orderId)
        })

        socket.on('tracking-started', (data: any) => {
            console.log('📡 Tracking started:', data)
        })

        socket.on('tracking-error', (data: any) => {
            console.error('❌ Tracking error:', data)
            setTrackingData(prev => ({
                ...prev,
                error: data.message || 'Tracking error'
            }))
        })

        socket.on('delivery-boy-accepted', (data: any) => {
            console.log('✅ Delivery boy accepted order:', data)
            // Start tracking when delivery boy accepts
            setTrackingData(prev => ({
                ...prev,
                isConnected: true,
            }))
        })

        socket.on('location-update', (update: LocationUpdate) => {
            console.log('📍 Location update received:', update)

            // Parse timestamp - handle both string and Date objects
            let timestamp: Date;
            if (update.timestamp instanceof Date) {
                timestamp = update.timestamp;
            } else if (typeof update.timestamp === 'string') {
                timestamp = new Date(update.timestamp);
            } else if (update.location?.timestamp) {
                // Fallback to location timestamp if available
                timestamp = update.location.timestamp instanceof Date
                    ? update.location.timestamp
                    : new Date(update.location.timestamp);
            } else {
                // Use current time as fallback
                timestamp = new Date();
            }

            setTrackingData(prev => ({
                ...prev,
                deliveryLocation: {
                    lat: update.location.latitude,
                    lng: update.location.longitude,
                },
                eta: update.eta,
                distance: update.distance,
                status: update.status,
                lastUpdate: timestamp,
                error: null,
            }))
        })

        // Listen for order status updates
        socket.on('order-taken', (data: any) => {
            console.log('📦 Order picked up from seller:', data)
            setTrackingData(prev => ({
                ...prev,
                orderStatus: 'Picked up',
                lastUpdate: new Date(),
            }))
        })

        socket.on('seller-pickup-confirmed', (data: any) => {
            console.log('🏪 Seller pickup confirmed:', data)
            if (data.allPickedUp && data.newStatus) {
                setTrackingData(prev => ({
                    ...prev,
                    orderStatus: data.newStatus,
                    lastUpdate: new Date(),
                }))
            }
        })

        socket.on('order-delivered', (data: any) => {
            console.log('✅ Order delivered:', data)
            setTrackingData(prev => ({
                ...prev,
                orderStatus: 'Delivered',
                lastUpdate: new Date(),
            }))
        })

        socket.on('disconnect', (reason: any) => {
            console.log('❌ Socket disconnected:', reason)
            setTrackingData(prev => ({ ...prev, isConnected: false }))

            // Attempt reconnection with exponential backoff
            if (reason === 'io server disconnect' || reason === 'io client disconnect') {
                return // Don't auto-reconnect if intentionally disconnected
            }

            attemptReconnect()
        })

        socket.on('connect_error', (error: any) => {
            console.error('Socket connection error:', error)
            setTrackingData(prev => ({
                ...prev,
                isConnected: false,
                error: 'Failed to connect to tracking server'
            }))

            attemptReconnect()
        })

        socket.on('error', (error: any) => {
            console.error('Socket error:', error)
            setTrackingData(prev => ({
                ...prev,
                error: 'Tracking service error'
            }))
        })

        return socket
    }, [orderId])

    const attemptReconnect = useCallback(() => {
        reconnectAttemptsRef.current += 1

        if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
            console.log('❌ Max reconnection attempts reached')
            setTrackingData(prev => ({
                ...prev,
                error: 'Unable to connect. Please refresh the page.',
                reconnectAttempts: reconnectAttemptsRef.current
            }))
            return
        }

        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1)
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)

        setTrackingData(prev => ({
            ...prev,
            reconnectAttempts: reconnectAttemptsRef.current
        }))

        reconnectTimeoutRef.current = setTimeout(() => {
            disconnectSocket()
            connectSocket()
        }, delay)
    }, [connectSocket])

    const disconnectSocket = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }

        if (socketRef.current) {
            if (orderId) {
                socketRef.current.emit('stop-tracking', orderId)
            }
            socketRef.current.disconnect()
            socketRef.current = null
        }
    }, [orderId])

    const manualReconnect = useCallback(() => {
        reconnectAttemptsRef.current = 0
        disconnectSocket()
        connectSocket()
    }, [connectSocket, disconnectSocket])

    useEffect(() => {
        if (!orderId) return

        const socket = connectSocket()

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
            disconnectSocket()
        }
    }, [orderId, connectSocket, disconnectSocket])

    return {
        ...trackingData,
        reconnect: manualReconnect,
        disconnect: disconnectSocket,
    }
}
