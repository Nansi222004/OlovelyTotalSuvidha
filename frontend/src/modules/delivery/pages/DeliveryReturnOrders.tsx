import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { getReturnOrders } from '../../../services/api/delivery/deliveryService';

export default function DeliveryReturnOrders() {
  const navigate = useNavigate();
  const [returnOrders, setReturnOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await getReturnOrders();
        setReturnOrders(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load return orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Cancelled':
        return 'bg-red-100 text-red-700';
      case 'Returned':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-neutral-100 text-neutral-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center pb-20">
        <p className="text-neutral-500">Loading return orders...</p>
        <DeliveryBottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center pb-20">
        <p className="text-red-500">{error}</p>
        <DeliveryBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <DeliveryHeader />
      <div className="px-4 py-4">
        <div className="flex items-center mb-4">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-neutral-200 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="text-neutral-900 text-xl font-semibold">Today's Return Orders</h2>
        </div>
        {returnOrders.length > 0 ? (
          <div className="space-y-3">
            {returnOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-neutral-900 font-semibold text-sm mb-1">{order.orderId}</p>
                    <p className="text-neutral-600 text-xs mb-1">{order.customerName}</p>
                    <p className="text-neutral-500 text-xs">{order.customerPhone}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="border-t border-neutral-200 pt-3 mt-3">
                  <p className="text-neutral-600 text-xs mb-2 line-clamp-2">{order.address}</p>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-neutral-500 text-xs">
                      {order.items.length} item{order.items.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-neutral-900 font-bold">₹ {order.totalAmount}</p>
                  </div>
                  {order.distance && (
                    <p className="text-neutral-500 text-xs">
                      Distance: {order.distance}
                    </p>
                  )}
                  <p className="text-neutral-400 text-xs mt-2">
                    {new Date(order.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 min-h-[400px] flex items-center justify-center shadow-sm border border-neutral-200">
            <p className="text-neutral-500 text-sm">No return orders for today</p>
          </div>
        )}
      </div>
      <DeliveryBottomNav />
    </div>
  );
}

