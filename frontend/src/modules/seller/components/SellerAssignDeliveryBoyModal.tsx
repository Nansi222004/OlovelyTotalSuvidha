import React, { useState, useEffect } from 'react';
import {
  getAvailableDeliveryPartners,
  assignDeliveryBoySeller,
  type AvailableDeliveryPartner,
} from '../../../services/api/orderService';
import { useToast } from '../../../context/ToastContext';

interface SellerAssignDeliveryBoyModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  currentDeliveryBoyId?: string;
  onAssignSuccess: (assignedRider?: AvailableDeliveryPartner) => void;
}

export default function SellerAssignDeliveryBoyModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  currentDeliveryBoyId,
  onAssignSuccess,
}: SellerAssignDeliveryBoyModalProps) {
  const { showToast } = useToast();
  const [deliveryBoys, setDeliveryBoys] = useState<AvailableDeliveryPartner[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchDeliveryPartners();
      if (currentDeliveryBoyId) {
        setSelectedRiderId(currentDeliveryBoyId);
      }
    }
  }, [isOpen, orderId, currentDeliveryBoyId]);

  const fetchDeliveryPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAvailableDeliveryPartners(orderId);
      if (res.success && Array.isArray(res.data)) {
        setDeliveryBoys(res.data);
      } else {
        setError(res.message || 'No delivery partners found');
      }
    } catch (err: any) {
      console.error('Error fetching available delivery partners:', err);
      setError(err?.response?.data?.message || 'Failed to load delivery partners');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!selectedRiderId) {
      showToast('Please select a delivery partner', 'error');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await assignDeliveryBoySeller(orderId, selectedRiderId);
      if (res.success) {
        showToast('Delivery partner assigned successfully', 'success');
        const assignedRider = deliveryBoys.find((r) => r._id === selectedRiderId);
        onAssignSuccess(assignedRider);
        onClose();
      } else {
        setError(res.message || 'Failed to assign delivery partner');
        showToast(res.message || 'Failed to assign delivery partner', 'error');
      }
    } catch (err: any) {
      console.error('Error assigning delivery partner:', err);
      const msg = err?.response?.data?.message || 'Failed to assign delivery partner';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredRiders = deliveryBoys.filter((rider) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      rider.name.toLowerCase().includes(q) ||
      rider.mobile.toLowerCase().includes(q) ||
      (rider.vehicleNumber && rider.vehicleNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Assign Delivery Partner</h2>
            <p className="text-xs text-teal-100 mt-0.5">Order #{orderNumber} • Select an active delivery partner</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search & Info Banner */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 space-y-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by rider name, phone, or vehicle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Body / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[50vh]">
          {loading ? (
            <div className="py-12 text-center text-neutral-500 space-y-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium">Finding available delivery partners...</p>
            </div>
          ) : filteredRiders.length === 0 ? (
            <div className="py-10 text-center text-neutral-500 space-y-2">
              <div className="w-12 h-12 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center mx-auto text-xl">
                🛵
              </div>
              <p className="text-sm font-semibold text-neutral-700">No Online Delivery Partners Found</p>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                No active delivery riders are currently online and available in your area. You can also select "Assign by Admin" to let the admin assign a partner.
              </p>
            </div>
          ) : (
            filteredRiders.map((rider) => {
              const isSelected = selectedRiderId === rider._id;
              return (
                <div
                  key={rider._id}
                  onClick={() => setSelectedRiderId(rider._id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/70 shadow-xs ring-2 ring-teal-500/20'
                      : 'border-neutral-200 hover:border-teal-300 hover:bg-neutral-50/50 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        isSelected ? 'bg-teal-600 text-white' : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {rider.profileImage ? (
                        <img
                          src={rider.profileImage}
                          alt={rider.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        rider.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-neutral-900 truncate">{rider.name}</p>
                        {rider.distanceKm !== null && rider.distanceKm !== undefined && (
                          <span className="inline-flex items-center text-[11px] font-medium text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
                            {rider.distanceKm} km away
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                        <span>📞 {rider.mobile}</span>
                        {rider.vehicleNumber && <span>• 🏍️ {rider.vehicleNumber}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Status & Radio */}
                  <div className="flex items-center gap-2 shrink-0">
                    {rider.isBusy ? (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {rider.activeOrdersCount ? `${rider.activeOrdersCount} active` : 'Active'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Available
                      </span>
                    )}

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-neutral-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            {selectedRiderId ? '1 rider selected' : 'Select a rider to confirm'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 bg-neutral-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAssignment}
              disabled={!selectedRiderId || submitting || loading}
              className={`px-5 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-sm ${
                !selectedRiderId || submitting || loading
                  ? 'bg-neutral-300 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700 active:scale-98'
              }`}
            >
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
