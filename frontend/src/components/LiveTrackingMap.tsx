import { useEffect, useState, useRef } from 'react'
// @ts-ignore - react-leaflet types may not be available
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
// @ts-ignore - leaflet types may not be available
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { motion } from 'framer-motion'

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom delivery partner icon
const deliveryIcon = new L.DivIcon({
    html: `<div style="font-size: 32px; text-align: center;">🛵</div>`,
    className: 'delivery-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
})

// Store icon
const storeIcon = new L.DivIcon({
    html: `<div style="font-size: 32px; text-align: center;">🏪</div>`,
    className: 'store-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
})

// Customer icon
const customerIcon = new L.DivIcon({
    html: `<div style="font-size: 32px; text-align: center;">📍</div>`,
    className: 'customer-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 40]
})

interface Location {
    lat: number
    lng: number
}

interface LiveTrackingMapProps {
    storeLocation: Location
    customerLocation: Location
    deliveryLocation?: Location
    isTracking: boolean
}

export default function LiveTrackingMap({
    storeLocation,
    customerLocation,
    deliveryLocation,
    isTracking = false
}: LiveTrackingMapProps) {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const mapContainerRef = useRef<HTMLDivElement>(null)

    // Calculate center point between store and customer
    const defaultCenter: Location = {
        lat: (storeLocation.lat + customerLocation.lat) / 2,
        lng: (storeLocation.lng + customerLocation.lng) / 2
    }

    // Create route between store and customer (or delivery partner)
    const routePoints: Array<[number, number]> = [
        [storeLocation.lat, storeLocation.lng] as [number, number],
        ...(deliveryLocation ? [[deliveryLocation.lat, deliveryLocation.lng] as [number, number]] : []),
        [customerLocation.lat, customerLocation.lng] as [number, number]
    ]

    const handleFullscreen = () => {
        if (!document.fullscreenElement && mapContainerRef.current) {
            mapContainerRef.current.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    return (
        <div ref={mapContainerRef} className="relative h-64 overflow-hidden rounded-lg">
            <MapContainer
                center={[defaultCenter.lat, defaultCenter.lng]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Store Marker */}
                <Marker position={[storeLocation.lat, storeLocation.lng]} icon={storeIcon}>
                    <Popup>
                        <div className="text-center">
                            <p className="font-semibold">Store Location</p>
                            <p className="text-xs text-gray-600">Pickup point</p>
                        </div>
                    </Popup>
                </Marker>

                {/* Customer Marker */}
                <Marker position={[customerLocation.lat, customerLocation.lng]} icon={customerIcon}>
                    <Popup>
                        <div className="text-center">
                            <p className="font-semibold">Delivery Address</p>
                            <p className="text-xs text-gray-600">Your location</p>
                        </div>
                    </Popup>
                </Marker>

                {/* Delivery Partner Marker (if tracking) */}
                {deliveryLocation && (
                    <Marker position={[deliveryLocation.lat, deliveryLocation.lng]} icon={deliveryIcon}>
                        <Popup>
                            <div className="text-center">
                                <p className="font-semibold">Delivery Partner</p>
                                <p className="text-xs text-gray-600">
                                    {isTracking ? 'On the way' : 'Location'}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Route Polyline */}
                <Polyline
                    positions={routePoints}
                    pathOptions={{
                        color: '#16a34a',
                        weight: 4,
                        opacity: 0.7,
                        dashArray: '10, 10'
                    }}
                />
            </MapContainer>

            {/* Map Controls */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                {/* Fullscreen Button */}
                <motion.button
                    className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFullscreen}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                </motion.button>
            </div>

            {/* Tracking Status Indicator */}
            {isTracking && (
                <div className="absolute bottom-3 left-3 z-10 bg-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <motion.div
                        className="w-2 h-2 rounded-full bg-green-500"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span className="text-sm font-medium text-gray-900">Live Tracking</span>
                </div>
            )}
        </div>
    )
}
