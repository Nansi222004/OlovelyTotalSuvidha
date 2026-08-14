import { useState, useEffect } from 'react';
import { getDeliveryBoys, type DeliveryBoy } from '../../../services/api/admin/adminDeliveryService';
import { assignDeliveryBoy } from '../../../services/api/admin/adminOrderService';

interface AssignDeliveryBoyModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    orderNumber: string;
    currentDeliveryBoy?: { name: string; _id: string } | string;
    onAssignSuccess: () => void;
}

export default function AssignDeliveryBoyModal({
    isOpen,
    onClose,
    orderId,
    orderNumber,
    currentDeliveryBoy,
    onAssignSuccess,
}: AssignDeliveryBoyModalProps) {
    const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
    const [selectedDeliveryBoyId, setSelectedDeliveryBoyId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get current delivery boy ID
    const currentDeliveryBoyId = typeof currentDeliveryBoy === 'object' && currentDeliveryBoy?._id
        ? currentDeliveryBoy._id
        : typeof currentDeliveryBoy === 'string'
            ? currentDeliveryBoy
            : '';

    useEffect(() => {
        if (isOpen) {
            fetchDeliveryBoys();
            // Pre-select current delivery boy if exists
            if (currentDeliveryBoyId) {
                setSelectedDeliveryBoyId(currentDeliveryBoyId);
            }
        }
    }, [isOpen, currentDeliveryBoyId]);

    const fetchDeliveryBoys = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getDeliveryBoys({
                status: 'Active',
                available: 'Available',
                isOnline: true,
                limit: 100, // Get all available & online delivery boys
            });
            if (response.success && response.data) {
                setDeliveryBoys(response.data);
            }
        } catch (err: any) {
            console.error('Error fetching delivery boys:', err);
            setError(err?.response?.data?.message || 'Failed to load delivery boys');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedDeliveryBoyId) {
            setError('Please select a delivery boy');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            const response = await assignDeliveryBoy(orderId, {
                deliveryBoyId: selectedDeliveryBoyId,
            });

            if (response.success) {
                onAssignSuccess();
                onClose();
            } else {
                setError(response.message || 'Failed to assign delivery boy');
            }
        } catch (err: any) {
            console.error('Error assigning delivery boy:', err);
            setError(
                err?.response?.data?.message || 'Failed to assign delivery boy. Please try again.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                    <h2 className="text-lg font-semibold text-neutral-900">
                        Assign Delivery Boy
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-600 transition-colors"
                        disabled={submitting}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M18 6L6 18M6 6l12 12"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4">
                    {/* Order Info */}
                    <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
                        <p className="text-sm text-neutral-600">Order Number</p>
                        <p className="text-base font-semibold text-neutral-900">{orderNumber}</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Delivery Boy Selection */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Select Delivery Boy <span className="text-red-500">*</span>
                        </label>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-sm text-neutral-500">Loading delivery boys...</div>
                            </div>
                        ) : deliveryBoys.length === 0 ? (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    No active delivery boys available. Please add delivery boys first.
                                </p>
                            </div>
                        ) : (
                            <select
                                value={selectedDeliveryBoyId}
                                onChange={(e) => setSelectedDeliveryBoyId(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                disabled={submitting}
                            >
                                <option value="">-- Select Delivery Boy --</option>
                                {deliveryBoys.map((deliveryBoy) => (
                                    <option key={deliveryBoy._id} value={deliveryBoy._id}>
                                        {deliveryBoy.name} - {deliveryBoy.mobile}
                                        {deliveryBoy.available === 'Available' ? ' (Available)' : ' (Not Available)'}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Selected Delivery Boy Details */}
                    {selectedDeliveryBoyId && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            {(() => {
                                const selected = deliveryBoys.find((db) => db._id === selectedDeliveryBoyId);
                                if (!selected) return null;
                                return (
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-blue-900">{selected.name}</p>
                                        <p className="text-xs text-blue-700">Mobile: {selected.mobile}</p>
                                        <p className="text-xs text-blue-700">City: {selected.city}</p>
                                        <p className="text-xs">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${selected.available === 'Available'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {selected.available}
                                            </span>
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={!selectedDeliveryBoyId || submitting || deliveryBoys.length === 0}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${!selectedDeliveryBoyId || submitting || deliveryBoys.length === 0
                            ? 'bg-neutral-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {submitting ? 'Assigning...' : 'Assign Delivery Boy'}
                    </button>
                </div>
            </div>
        </div>
    );
}
