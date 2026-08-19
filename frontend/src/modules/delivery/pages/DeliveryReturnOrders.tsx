import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { useToast } from '../../../context/ToastContext';
import {
  getAssignedReturns,
  generateReturnPickupOtp,
  verifyReturnPickupOtp,
  markReturnInTransit,
  markReturnHandedToSeller,
} from '../../../services/api/delivery/deliveryService';

type ReturnStatus =
  | 'Delivery Partner Assigned'
  | 'Picked Up'
  | 'In Transit'
  | 'Handed To Seller'
  | 'Completed';

interface ReturnPickup {
  _id: string;
  returnId?: string;
  orderNumber?: string;
  productName?: string;
  productImage?: string;
  customerName?: string;
  customerPhone?: string;
  status: ReturnStatus | string;
  pickupOtpVerified?: boolean;
  customer?: { name?: string; phone?: string; address?: string };
  deliveryAddress?: { address?: string; city?: string };
  orderItem?: { product?: { name?: string }; total?: number };
  order?: { orderNumber?: string };
  assignedAt?: string;
  pickedUpAt?: string;
  inTransitAt?: string;
  handedToSellerAt?: string;
}


const STATUS_STEPS: { status: string; label: string; emoji: string }[] = [
  { status: 'Delivery Partner Assigned', label: 'Assigned', emoji: '📋' },
  { status: 'Picked Up', label: 'Picked Up', emoji: '📦' },
  { status: 'In Transit', label: 'In Transit', emoji: '🚗' },
  { status: 'Handed To Seller', label: 'Handed To Seller', emoji: '🤝' },
  { status: 'Completed', label: 'Completed', emoji: '✅' },
];

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'Delivery Partner Assigned': 'bg-blue-100 text-blue-700',
    'Picked Up': 'bg-yellow-100 text-yellow-800',
    'In Transit': 'bg-orange-100 text-orange-700',
    'Handed To Seller': 'bg-purple-100 text-purple-700',
    'Completed': 'bg-green-100 text-green-700',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colorMap[status] || 'bg-neutral-100 text-neutral-700'}`}>
      {status}
    </span>
  );
}

export default function DeliveryReturnOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [returns, setReturns] = useState<ReturnPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // OTP modal state
  const [otpModal, setOtpModal] = useState<{ returnId: string; mode: 'generate' | 'verify' } | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const data = await getAssignedReturns();
      setReturns(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load return pickups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReturns(); }, []);

  const handleGenerateOtp = async (returnId: string) => {
    setOtpMessage('');
    setOtpError('');
    setOtpInput('');
    setActionLoading(returnId);
    try {
      const res = await generateReturnPickupOtp(returnId);
      if (res.success) {
        setOtpMessage(res.message || 'OTP sent to customer. Use 9999 in test mode.');
        setOtpModal({ returnId, mode: 'verify' });
      } else {
        setOtpError(res.message || 'Failed to generate OTP');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Failed to generate OTP');
      setOtpModal({ returnId, mode: 'verify' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpModal || !otpInput.trim()) return;
    setActionLoading(otpModal.returnId);
    setOtpError('');
    try {
      const res = await verifyReturnPickupOtp(otpModal.returnId, otpInput.trim());
      if (res.success) {
        setOtpModal(null);
        setOtpInput('');
        await fetchReturns();
        showToast('✅ OTP verified! Item marked as Picked Up.', 'success');
      } else {
        setOtpError(res.message || 'Invalid OTP. Try again.');
      }
    } catch (err: any) {
      setOtpError(err.message || 'OTP verification failed. Try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkInTransit = async (returnId: string) => {
    setActionLoading(returnId);
    try {
      const res = await markReturnInTransit(returnId);
      if (res.success) {
        showToast('Return marked as In Transit.', 'success');
        await fetchReturns();
      } else {
        showToast('Failed: ' + (res.message || 'Unknown error'), 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleHandedToSeller = async (returnId: string) => {
    setActionLoading(returnId);
    try {
      const res = await markReturnHandedToSeller(returnId);
      if (res.success) {
        await fetchReturns();
        showToast('✅ Item handed to seller. The seller will now confirm receipt.', 'success');
      } else {
        showToast('Failed: ' + (res.message || 'Unknown error'), 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
        <p className="text-neutral-500 text-sm">Loading return pickups...</p>
        <DeliveryBottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center pb-20">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <button onClick={fetchReturns} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          Retry
        </button>
        <DeliveryBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <DeliveryHeader />
      <div className="px-4 py-4">
        {/* Header with Tab Switcher */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="mr-2 p-1.5 hover:bg-neutral-200 rounded-full transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h2 className="text-neutral-900 text-lg font-semibold">Return Pickups</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-neutral-200/80 p-1 rounded-xl gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => navigate("/delivery/orders")}
                className="px-2.5 py-1 rounded-lg text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                📦 Deliveries
              </button>
              <button
                type="button"
                onClick={() => navigate("/delivery/orders/return")}
                className="px-2.5 py-1 rounded-lg bg-white text-neutral-900 shadow-xs"
              >
                ↩ Returns
              </button>
            </div>
            <button onClick={fetchReturns} className="p-1.5 hover:bg-neutral-200 rounded-full transition-colors" title="Refresh">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        </div>


        {/* Legend */}
        <div className="bg-white rounded-xl p-3 mb-4 shadow-sm border border-neutral-200">
          <p className="text-xs font-semibold text-neutral-600 mb-2">Lifecycle Steps</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_STEPS.map(s => (
              <span key={s.status} className="text-xs text-neutral-600">{s.emoji} {s.label}</span>
            ))}
          </div>
        </div>

        {returns.length === 0 ? (
          <div className="bg-white rounded-xl p-8 min-h-[300px] flex items-center justify-center shadow-sm border border-neutral-200">
            <div className="text-center">
              <p className="text-3xl mb-3">📦</p>
              <p className="text-neutral-500 text-sm">No return pickups assigned to you</p>
              <p className="text-neutral-400 text-xs mt-1">Admin assigns you when a customer return needs pickup</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((ret, idx) => {
              const returnId = ret._id || ret.returnId || '';
              const isLoading = actionLoading === returnId;
              const orderNum = ret.orderNumber || ret.order?.orderNumber || (returnId ? returnId.slice(-6).toUpperCase() : 'N/A');
              const productName = ret.productName || ret.orderItem?.product?.name || 'Product';
              const amount = ret.orderItem?.total;
              const customerName = ret.customerName || ret.customer?.name || 'Customer';
              const customerPhone = ret.customerPhone || ret.customer?.phone || '';
              const address = ret.deliveryAddress?.address || ret.customer?.address || '';

              return (
                <div key={returnId || idx} className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                  {/* Card Header */}
                  <div className="flex items-start justify-between p-4 border-b border-neutral-100">
                    <div>
                      <p className="text-neutral-900 font-semibold text-sm">Return #{orderNum}</p>
                      <p className="text-neutral-500 text-xs mt-0.5">{productName}</p>
                    </div>
                    <StatusBadge status={ret.status} />
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400 shrink-0">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                      <p className="text-neutral-700 text-sm">{customerName}</p>
                      {customerPhone && <a href={`tel:${customerPhone}`} className="text-blue-600 text-xs ml-auto">{customerPhone}</a>}
                    </div>
                    {address && (
                      <div className="flex items-start gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400 shrink-0 mt-0.5">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        <p className="text-neutral-600 text-xs">{address}</p>
                      </div>
                    )}
                    {amount !== undefined && (
                      <p className="text-neutral-900 font-bold text-sm">₹{amount.toFixed(2)}</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-4 pt-0">
                    {ret.status === 'Delivery Partner Assigned' && (
                      <div className="space-y-2">
                        <p className="text-xs text-neutral-500 mb-2">
                          Go to the customer's address and generate an OTP to confirm pickup.
                        </p>
                        <button
                          id={`btn-generate-otp-${returnId}`}
                          onClick={() => handleGenerateOtp(returnId)}
                          disabled={isLoading}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {isLoading ? (
                            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          ) : '🔢'}
                          Generate Pickup OTP
                        </button>
                      </div>
                    )}

                    {ret.status === 'Picked Up' && (
                      <div className="space-y-2">
                        <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg mb-2">
                          ✅ Item picked up from customer. Head to the seller's store.
                        </p>
                        <button
                          id={`btn-in-transit-${returnId}`}
                          onClick={() => handleMarkInTransit(returnId)}
                          disabled={isLoading}
                          className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-300 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {isLoading ? 'Updating...' : '🚗 Mark In Transit'}
                        </button>
                      </div>
                    )}

                    {ret.status === 'In Transit' && (
                      <div className="space-y-2">
                        <p className="text-xs text-orange-700 bg-orange-50 px-3 py-2 rounded-lg mb-2">
                          🚗 In transit to seller. Tap below when you have physically handed the item.
                        </p>
                        <button
                          id={`btn-handed-${returnId}`}
                          onClick={() => handleHandedToSeller(returnId)}
                          disabled={isLoading}
                          className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-300 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {isLoading ? 'Updating...' : '🤝 Confirm Handed To Seller'}
                        </button>
                      </div>
                    )}

                    {ret.status === 'Handed To Seller' && (
                      <div className="bg-purple-50 px-3 py-2 rounded-lg">
                        <p className="text-purple-700 text-xs font-medium">🤝 Item handed to seller</p>
                        <p className="text-purple-600 text-xs mt-0.5">Waiting for seller to confirm receipt and complete the return.</p>
                      </div>
                    )}

                    {ret.status === 'Completed' && (
                      <div className="bg-green-50 px-3 py-2 rounded-lg">
                        <p className="text-green-700 text-xs font-medium">✅ Return completed</p>
                        <p className="text-green-600 text-xs mt-0.5">Financial settlement processed. Well done!</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* OTP Modal */}
      {otpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 pb-20">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-md">
            <h3 className="text-neutral-900 font-semibold text-lg mb-1">Enter Pickup OTP</h3>
            <p className="text-neutral-500 text-sm mb-4">
              Ask the customer for the OTP sent to their phone.{' '}
              <span className="text-blue-600 font-medium">Test mode: use 9999</span>
            </p>
            {otpMessage && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                <p className="text-blue-700 text-xs">{otpMessage}</p>
              </div>
            )}
            {otpError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                <p className="text-red-600 text-xs">{otpError}</p>
              </div>
            )}
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpInput}
              onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter OTP (e.g. 9999)"
              className="w-full border-2 border-neutral-300 focus:border-blue-500 rounded-xl px-4 py-3 text-lg text-center tracking-widest font-mono outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setOtpModal(null); setOtpInput(''); setOtpError(''); }}
                className="flex-1 py-2.5 border border-neutral-300 rounded-xl text-neutral-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                id="btn-verify-otp"
                onClick={handleVerifyOtp}
                disabled={!otpInput.trim() || !!actionLoading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {actionLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeliveryBottomNav />
    </div>
  );
}
