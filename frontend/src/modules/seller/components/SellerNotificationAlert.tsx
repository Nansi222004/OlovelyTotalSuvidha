import React, { useState, useEffect, useRef } from 'react';
import { SellerNotification } from '../hooks/useSellerSocket';
import { updateOrderStatus } from '../../../services/api/orderService';
import { useNavigate } from 'react-router-dom';

interface SellerNotificationAlertProps {
  notification: SellerNotification | null;
  onClose: () => void;
  onResolved?: () => void;
}

const SellerNotificationAlert: React.FC<SellerNotificationAlertProps> = ({ notification, onClose, onResolved }) => {
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [deliveryPreference, setDeliveryPreference] = useState<'Self' | 'Admin' | 'Auto'>('Admin');

  const handleStatusUpdate = async (status: string, pref?: 'Self' | 'Admin' | 'Auto') => {
    if (!notification) return;
    setLoading(true);
    try {
      const payload: any = { status: status as any };
      // For Instant, only send Self when chosen; 'Auto' means don't send preference (backend auto-notifies delivery)
      if (pref && pref !== 'Auto') {
        payload.deliveryPreference = pref;
      }
      await updateOrderStatus(notification.orderId, payload);
      if (onResolved) {
        onResolved();
      } else {
        onClose();
      }
      // Optionally navigate to order detail or just close
      if (status === 'Accepted') {
        navigate(`/seller/orders/${notification.orderId}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (notification) {
      // Play sound when notification arrives
      if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.play().catch(err => console.error('Error playing sound:', err));
      }
    }
  }, [notification]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Default delivery preference when assign popup opens: Instant → Auto (no admin), Standard → Admin
  useEffect(() => {
    if (showAssignPopup && notification) {
      setDeliveryPreference(notification.deliveryOption === 'Instant' ? 'Auto' : 'Admin');
    }
  }, [showAssignPopup, notification?.orderId, notification?.deliveryOption]);

  if (!notification) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
      <audio
        ref={audioRef}
        src="/assets/sound/seller_alert.mp3"
        loop
      />

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between ${notification.type === 'NEW_ORDER' ? 'bg-teal-600' : 'bg-blue-600'} text-white`}>
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-2 rounded-full">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {notification.type === 'NEW_ORDER' ? 'New Order Received!' : 'Order Status Updated'}
              </h2>
              <p className="text-sm opacity-90">#{notification.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-10 p-1 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Volume Control */}
          <div className="mb-6 bg-neutral-50 p-3 rounded-lg flex items-center gap-4">
            <span className="text-neutral-500">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 accent-teal-600"
            />
          </div>

          {/* Customer Info */}
          <section className="mb-6">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">Customer Information</h3>
            <div className="bg-neutral-50 rounded-lg p-4">
              <p className="font-bold text-neutral-800 text-lg">{notification.customer.name}</p>
              <p className="text-neutral-600 flex items-center gap-2 mt-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                {notification.customer.phone}
              </p>
              <div className="text-neutral-600 flex items-start gap-2 mt-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 flex-shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>
                  {notification.customer.address.address}, {notification.customer.address.city}, {notification.customer.address.pincode}
                  {notification.customer.address.landmark && <span className="block text-sm text-neutral-400 mt-0.5">Landmark: {notification.customer.address.landmark}</span>}
                </span>
              </div>
            </div>
          </section>

          {/* Order Info & Delivery Type */}
          <section className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">Delivery Details</h3>
              {notification.deliveryOption && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${notification.deliveryOption === 'Instant'
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                  {notification.deliveryOption} Delivery
                </span>
              )}
            </div>
            {notification.paymentStatus && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-neutral-500">Payment Status:</span>
                <span className={`font-semibold ${notification.paymentStatus === 'Paid' ? 'text-green-600' : 'text-amber-600'}`}>
                  {notification.paymentStatus}
                </span>
              </div>
            )}
          </section>

          {/* Order Details */}
          <section>
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">Order Items</h3>
            <div className="space-y-3">
              {notification.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start py-2 border-b border-neutral-100 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-neutral-800">{item.productName}</p>
                    <p className="text-sm text-neutral-500">
                      Qty: {item.quantity} × ₹{item.price.toFixed(2)}
                      {item.variation && <span className="ml-2 px-1.5 py-0.5 bg-neutral-100 rounded text-[10px]">{item.variation}</span>}
                    </p>
                  </div>
                  <p className="font-bold text-neutral-800">₹{item.total.toFixed(2)}</p>
                </div>
              ))}

              <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-neutral-100">
                <span className="text-lg font-bold text-neutral-800">Total (Your Items)</span>
                <span className="text-2xl font-black text-teal-600">₹{notification.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-neutral-50 border-t border-neutral-200">

          {notification.type === 'NEW_ORDER' ? (
            <div className="flex gap-4">
              <button
                onClick={() => setShowAssignPopup(true)}
                disabled={loading}
                className="flex-1 py-4 rounded-xl font-bold text-white shadow-lg bg-teal-600 hover:bg-teal-700 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Please wait...' : 'Accept Order'}
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to reject this order?')) {
                    handleStatusUpdate('Rejected');
                  }
                }}
                disabled={loading}
                className="flex-1 py-4 rounded-xl font-bold text-white shadow-lg bg-red-600 hover:bg-red-700 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Please wait...' : 'Reject Order'}
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 bg-blue-600 hover:bg-blue-700"
            >
              Acknowledge & Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Delivery Assignment Popup */}
      {showAssignPopup && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 overflow-hidden">
            <h3 className="text-xl font-bold text-neutral-900 mb-4">Assign Delivery</h3>
            <p className="text-neutral-600 mb-6 text-sm">
              {notification.deliveryOption === 'Instant'
                ? 'Instant delivery: choose self-assign or a delivery partner will be notified automatically.'
                : 'Please choose how you want to assign the delivery for this order.'}
            </p>

            <div className="space-y-3 mb-6 flex flex-col items-stretch">
              <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${deliveryPreference === 'Self' ? 'border-teal-500 bg-teal-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                <input
                  type="radio"
                  name="delivery_preference_alert"
                  value="Self"
                  checked={deliveryPreference === 'Self'}
                  onChange={() => setDeliveryPreference('Self')}
                  className="w-4 h-4 text-teal-600 border-neutral-300 focus:ring-teal-500"
                />
                <div className="ml-3 text-left">
                  <span className="block text-sm font-medium text-neutral-900">Self Assign</span>
                  <span className="block text-xs text-neutral-500">I will manage the delivery of this order myself</span>
                </div>
              </label>

              {notification.deliveryOption === 'Instant' ? (
              <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${deliveryPreference === 'Auto' ? 'border-teal-500 bg-teal-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                <input
                  type="radio"
                  name="delivery_preference_alert"
                  value="Auto"
                  checked={deliveryPreference === 'Auto'}
                  onChange={() => setDeliveryPreference('Auto')}
                  className="w-4 h-4 text-teal-600 border-neutral-300 focus:ring-teal-500"
                />
                <div className="ml-3 text-left">
                  <span className="block text-sm font-medium text-neutral-900">Auto-assign to delivery partner</span>
                  <span className="block text-xs text-neutral-500">A delivery partner will be notified and can accept the order</span>
                </div>
              </label>
              ) : (
              <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${deliveryPreference === 'Admin' ? 'border-teal-500 bg-teal-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                <input
                  type="radio"
                  name="delivery_preference_alert"
                  value="Admin"
                  checked={deliveryPreference === 'Admin'}
                  onChange={() => setDeliveryPreference('Admin')}
                  className="w-4 h-4 text-teal-600 border-neutral-300 focus:ring-teal-500"
                />
                <div className="ml-3 text-left">
                  <span className="block text-sm font-medium text-neutral-900">Assigned By Admin</span>
                  <span className="block text-xs text-neutral-500">Let the admin assign a delivery boy for this order</span>
                </div>
              </label>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowAssignPopup(false)}
                className="px-5 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAssignPopup(false);
                  handleStatusUpdate('Accepted', deliveryPreference);
                }}
                className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                disabled={loading}
              >
                Confirm & Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerNotificationAlert;
