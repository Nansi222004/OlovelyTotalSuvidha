import { useState, useEffect } from 'react';
import { useToast } from '../../../context/ToastContext';
import { getAppSettings, updateAppSettings, AppSettings } from '../../../services/api/admin/adminSettingsService';
import { motion } from 'framer-motion';

export default function AdminBillingSettings() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<AppSettings | null>(null);

    // Form State
    const [platformFee, setPlatformFee] = useState<number>(0);
    const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<number>(0);
    const [minimumOrderValue, setMinimumOrderValue] = useState<number>(0);
    const [deliveryCharges, setDeliveryCharges] = useState<number>(0);
    const [firstOrderFreeShippingEnabled, setFirstOrderFreeShippingEnabled] = useState<boolean>(false);

    // Distance Based Config
    const [isDistanceBased, setIsDistanceBased] = useState(false);
    const [baseCharge, setBaseCharge] = useState<number>(0);
    const [baseDistance, setBaseDistance] = useState<number>(0);
    const [kmRate, setKmRate] = useState<number>(0);
    // Delivery partner pay (own base distance, independent of the customer's)
    const [deliveryBoyBaseCharge, setDeliveryBoyBaseCharge] = useState<number>(0);
    const [deliveryBoyBaseDistance, setDeliveryBoyBaseDistance] = useState<number>(0);
    const [deliveryBoyKmRate, setDeliveryBoyKmRate] = useState<number>(0);
    const [previewKm, setPreviewKm] = useState<number>(5);
    const [googleMapsKey, setGoogleMapsKey] = useState<string>('');

    // Feature Flags
    const [showSellerDetails, setShowSellerDetails] = useState<boolean>(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await getAppSettings();
            if (response && response.success && response.data) {
                const data = response.data;
                setSettings(data);

                // Initialize State
                setPlatformFee(data.platformFee || 0);
                setFreeDeliveryThreshold(data.freeDeliveryThreshold || 0);
                setMinimumOrderValue(data.minimumOrderValue || 0);
                setDeliveryCharges(data.deliveryCharges || 0);
                setFirstOrderFreeShippingEnabled(data.firstOrderFreeShippingEnabled ?? false);

                if (data.deliveryConfig) {
                    setIsDistanceBased(data.deliveryConfig.isDistanceBased || false);
                    setBaseCharge(data.deliveryConfig.baseCharge || 0);
                    setBaseDistance(data.deliveryConfig.baseDistance || 0);
                    setKmRate(data.deliveryConfig.kmRate || 0);
                    setDeliveryBoyBaseCharge(data.deliveryConfig.deliveryBoyBaseCharge || 0);
                    setDeliveryBoyBaseDistance(data.deliveryConfig.deliveryBoyBaseDistance || 0);
                    setDeliveryBoyKmRate(data.deliveryConfig.deliveryBoyKmRate || 0);
                    setGoogleMapsKey(data.deliveryConfig.googleMapsKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');
                } else {
                    // If no config exists, try to pre-fill from env
                    setGoogleMapsKey(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');
                }

                if (data.features) {
                    setShowSellerDetails(data.features.showSellerDetails ?? true);
                }
            }
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Failed to fetch settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const updatePayload: any = {
                platformFee,
                freeDeliveryThreshold,
                minimumOrderValue,
                deliveryCharges,
                firstOrderFreeShippingEnabled,
                deliveryConfig: {
                    isDistanceBased,
                    baseCharge,
                    baseDistance,
                    kmRate,
                    deliveryBoyBaseCharge,
                    deliveryBoyBaseDistance,
                    deliveryBoyKmRate,
                    googleMapsKey
                },
                features: {
                    ...(settings?.features || {
                        sellerRegistration: true,
                        productApproval: true,
                        orderTracking: true,
                        wallet: true,
                        coupons: true,
                    }),
                    showSellerDetails: showSellerDetails
                }
            };

            const response = await updateAppSettings(updatePayload);
            if (response.success) {
                showToast('Billing settings updated successfully');
                setSettings(response.data);
                window.dispatchEvent(new CustomEvent('appSettingsUpdated'));
            } else {
                showToast('Failed to update settings', 'error');
            }
        } catch (error: any) {
            console.error(error);
            showToast(error.response?.data?.message || 'Error updating settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleFirstOrderFreeShipping = async (enabled: boolean) => {
        setFirstOrderFreeShippingEnabled(enabled);
        try {
            const response = await updateAppSettings({ firstOrderFreeShippingEnabled: enabled });
            if (response && response.success) {
                showToast(`First Order Free Shipping ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');
                window.dispatchEvent(new CustomEvent('appSettingsUpdated'));
            } else {
                setFirstOrderFreeShippingEnabled(!enabled);
                showToast(response?.message || 'Failed to update free shipping setting', 'error');
            }
        } catch (error: any) {
            setFirstOrderFreeShippingEnabled(!enabled);
            showToast(error.response?.data?.message || 'Failed to update free shipping setting', 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
        >
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Billing & Charges</h1>
                    <p className="text-sm text-gray-500">Manage delivery fees, platform charges, and thresholds.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Saving...
                        </>
                    ) : (
                        'Save Changes'
                    )}
                </button>
            </div>

            <div className="space-y-6">
                {/* General Billing Section */}
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">General Charges</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Platform/Handling Fee (₹)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={platformFee === 0 ? '' : platformFee}
                                    onChange={(e) => setPlatformFee(e.target.value === '' ? 0 : Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    placeholder="e.g. 2"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Added to every order as handling charge.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Free Delivery Threshold (₹)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={freeDeliveryThreshold === 0 ? '' : freeDeliveryThreshold}
                                    onChange={(e) => setFreeDeliveryThreshold(e.target.value === '' ? 0 : Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    placeholder="e.g. 499"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Orders above this amount will have free delivery.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Minimum Order Value (₹)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={minimumOrderValue === 0 ? '' : minimumOrderValue}
                                    onChange={(e) => setMinimumOrderValue(e.target.value === '' ? 0 : Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    placeholder="e.g. 99"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                Cart subtotal must reach this amount before an order can be placed. Set 0 to disable.
                            </p>
                        </div>
                    </div>
                </div>

                {/* First Order Free Shipping Section */}
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-gray-900">FREE SHIPPING FOR FIRST ORDER</h2>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    firstOrderFreeShippingEnabled ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                                }`}>
                                    {firstOrderFreeShippingEnabled ? 'ON' : 'OFF'}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                                Give new customers free shipping on their first eligible order.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={firstOrderFreeShippingEnabled}
                                onChange={(e) => handleToggleFirstOrderFreeShipping(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>
                </div>

                {/* Delivery Configuration Section */}
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                    <div className="flex justify-between items-start mb-6 pb-2 border-b">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Delivery Configuration</h2>
                            <p className="text-sm text-gray-500">Choose between fixed or distance-based pricing</p>
                        </div>

                        <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-lg">
                            <button
                                onClick={() => setIsDistanceBased(false)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${!isDistanceBased ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Fixed Price
                            </button>
                            <button
                                onClick={() => setIsDistanceBased(true)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${isDistanceBased ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Distance Based
                            </button>
                        </div>
                    </div>

                    {!isDistanceBased ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="max-w-md"
                        >
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fixed Delivery Charge (₹)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={deliveryCharges === 0 ? '' : deliveryCharges}
                                    onChange={(e) => setDeliveryCharges(e.target.value === '' ? 0 : Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    placeholder="e.g. 40"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Flat fee charged for all deliveries below threshold.</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
                        >
                            <div className="md:col-span-2 -mb-2">
                                <h3 className="text-sm font-semibold text-gray-900">Customer delivery charge</h3>
                                <p className="text-xs text-gray-500">What the customer pays for Instant delivery.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Base Charge (₹)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={baseCharge === 0 ? '' : baseCharge}
                                        onChange={(e) => setBaseCharge(e.target.value === '' ? 0 : Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                        placeholder="0"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Min charge for first X kms.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Base Distance (km)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={baseDistance === 0 ? '' : baseDistance}
                                        onChange={(e) => setBaseDistance(e.target.value === '' ? 0 : Number(e.target.value))}
                                        className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">km</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Distance covered in base charge.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Extra per km Charge (₹)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={kmRate === 0 ? '' : kmRate}
                                        onChange={(e) => setKmRate(e.target.value === '' ? 0 : Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                        placeholder="0"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Charged for every km after base distance.</p>
                            </div>

                            <div className="md:col-span-2 border-t pt-5 -mb-2">
                                <h3 className="text-sm font-semibold text-gray-900">Delivery partner pay</h3>
                                <p className="text-xs text-gray-500">
                                    What the delivery partner earns per delivery, paid by the platform. Has its own base distance.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Delivery Boy Base Pay (₹)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={deliveryBoyBaseCharge === 0 ? '' : deliveryBoyBaseCharge}
                                        onChange={(e) => setDeliveryBoyBaseCharge(e.target.value === '' ? 0 : Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                        placeholder="0"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Fixed pay for the partner's first X km.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Delivery Boy Base Distance (km)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={deliveryBoyBaseDistance === 0 ? '' : deliveryBoyBaseDistance}
                                        onChange={(e) => setDeliveryBoyBaseDistance(e.target.value === '' ? 0 : Number(e.target.value))}
                                        className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">km</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Distance covered by the base pay.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Delivery Boy Extra per km (₹)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={deliveryBoyKmRate === 0 ? '' : deliveryBoyKmRate}
                                        onChange={(e) => setDeliveryBoyKmRate(e.target.value === '' ? 0 : Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                        placeholder="0"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Paid for every km after the partner's base distance
                                    {deliveryBoyBaseCharge === 0 && deliveryBoyBaseDistance === 0 ? ' (with no base set: per km for the whole ride)' : ''}.
                                </p>
                            </div>

                            {/* Live example: what each side pays/earns for a ride of N km */}
                            {(() => {
                                const km = Math.max(0, previewKm || 0);
                                const customerFee = Math.ceil(baseCharge + Math.max(0, km - baseDistance) * kmRate);
                                const partnerConfigured = deliveryBoyBaseCharge > 0 || deliveryBoyKmRate > 0;
                                const partnerPay = Math.round(
                                    (deliveryBoyBaseCharge + Math.max(0, km - deliveryBoyBaseDistance) * deliveryBoyKmRate) * 100
                                ) / 100;
                                const platform = Math.round((customerFee - partnerPay) * 100) / 100;
                                return (
                                    <div className="md:col-span-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="font-medium text-gray-800">Example for a ride of</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.5"
                                                value={previewKm}
                                                onChange={(e) => setPreviewKm(e.target.value === '' ? 0 : Number(e.target.value))}
                                                className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                                            />
                                            <span className="font-medium text-gray-800">km (road distance)</span>
                                        </div>
                                        {partnerConfigured ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <div>
                                                    <p className="text-xs text-gray-500">Customer pays</p>
                                                    <p className="font-semibold text-gray-900">₹{customerFee}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Partner earns</p>
                                                    <p className="font-semibold text-gray-900">₹{partnerPay}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Platform keeps</p>
                                                    <p className={`font-semibold ${platform < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                                        {platform < 0 ? '−' : ''}₹{Math.abs(platform)}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-600">
                                                No partner pay set: partners get their % commission of the order value instead.
                                            </p>
                                        )}
                                        {partnerConfigured && platform < 0 && (
                                            <p className="mt-2 text-xs text-red-600">
                                                The platform pays more to the partner than the customer pays for this distance.
                                            </p>
                                        )}
                                        <p className="mt-2 text-[11px] text-gray-500">
                                            On free-delivery orders the customer pays ₹0 and the platform pays the full partner amount.
                                        </p>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    )}
                </div>

                {/* Display & Visibility Settings Section */}
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Display & Visibility Settings</h2>
                    <p className="text-sm text-gray-500 mb-6">Control what information is visible to the customers on the mobile and web application.</p>
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100/50 transition-all">
                        <div className="flex-1 pr-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Show Seller Details</h3>
                            <p className="text-xs text-gray-500">When enabled, customer can see store/seller info under the product description. Turn off to hide seller info.</p>
                        </div>
                        
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                checked={showSellerDetails}
                                onChange={(e) => setShowSellerDetails(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
