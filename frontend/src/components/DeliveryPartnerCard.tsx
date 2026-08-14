import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback } from 'react'

interface DeliveryPartner {
    name?: string
    phone?: string
    profileImage?: string
    vehicleNumber?: string
}

interface DeliveryPartnerCardProps {
    partner: DeliveryPartner | null
    eta: number
    distance: number
    isTracking: boolean
    deliveryOtp?: string
    onCall?: () => void
    onMessage?: () => void
}

export default function DeliveryPartnerCard({
    partner,
    eta,
    distance,
    isTracking,
    deliveryOtp,
    onCall,
    onMessage
}: DeliveryPartnerCardProps) {
    const [isCopied, setIsCopied] = useState(false)

    const handleCopyOtp = useCallback(async () => {
        if (!deliveryOtp) return
        try {
            await navigator.clipboard.writeText(deliveryOtp)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy OTP:', err)
        }
    }, [deliveryOtp])

    if (!partner && !isTracking && !deliveryOtp) return null

    const formatDistance = (meters: number): string => {
        if (meters < 1000) {
            return `${Math.round(meters)}m`
        }
        return `${(meters / 1000).toFixed(1)}km`
    }

    const formatETA = (minutes: number): string => {
        if (minutes < 60) {
            return `${minutes} min`
        }
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return `${hours}h ${mins}m`
    }

    return (
        <motion.div
            className="mx-4 mt-4 bg-white rounded-xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            {/* Delivery Partner Info */}
            <div className="p-4">
                <div className="flex items-center gap-3">
                    {/* Profile Image */}
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center overflow-hidden">
                        {partner?.profileImage ? (
                            <img
                                src={partner.profileImage}
                                alt={partner.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-2xl text-white">🛵</span>
                        )}
                    </div>

                    {/* Partner Details */}
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                            {partner?.name || 'Delivery Partner'}
                        </h3>
                        {partner?.vehicleNumber && (
                            <p className="text-sm text-gray-500">
                                🏍️ {partner.vehicleNumber}
                            </p>
                        )}
                        {isTracking && (
                            <div className="flex items-center gap-1 mt-1">
                                <motion.div
                                    className="w-2 h-2 rounded-full bg-green-500"
                                    animate={{ opacity: [1, 0.3, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <span className="text-xs text-green-600 font-medium">
                                    On the way
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Call Button */}
                    {partner?.phone && onCall && (
                        <motion.button
                            className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center hover:bg-green-200"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onCall}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Live Metrics */}
            {isTracking && (
                <div className="grid grid-cols-2 border-t border-gray-100">
                    {/* ETA */}
                    <div className="p-4 border-r border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <span className="text-xs text-gray-500 font-medium">ETA</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatETA(eta)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Estimated arrival</p>
                    </div>

                    {/* Distance */}
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                            <span className="text-xs text-gray-500 font-medium">Distance</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatDistance(distance)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Away from you</p>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            {isTracking && distance > 0 && (
                <div className="px-4 pb-4">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-green-400 to-green-600"
                            initial={{ width: '0%' }}
                            animate={{ width: `${Math.max(10, Math.min(90, 100 - (distance / 50)))}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>
            )}

            {/* Delivery OTP Section - Permanent OTP, no expiry */}
            {deliveryOtp && (
                <div className="mx-4 mb-4 p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-0.5">Your Delivery OTP</p>
                            <p className="text-[11px] text-neutral-600 leading-tight">Share this with the delivery partner</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-white px-4 py-2.5 rounded-lg border border-neutral-100 shadow-sm flex items-center justify-between group">
                            <span className="text-2xl font-black tracking-[0.25em] text-green-700">{deliveryOtp}</span>
                            <motion.button
                                onClick={handleCopyOtp}
                                className="p-1.5 hover:bg-neutral-50 rounded-md transition-colors relative"
                                whileTap={{ scale: 0.9 }}
                            >
                                <AnimatePresence mode="wait">
                                    {isCopied ? (
                                        <motion.svg
                                            key="check"
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.5 }}
                                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"
                                        >
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </motion.svg>
                                    ) : (
                                        <motion.svg
                                            key="copy"
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.5 }}
                                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"
                                        >
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </motion.svg>
                                    )}
                                </AnimatePresence>
                                {isCopied && (
                                    <motion.span
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap"
                                    >
                                        Copied!
                                    </motion.span>
                                )}
                            </motion.button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    )
}

