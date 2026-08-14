import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSettlementOrders, type SettlementOrderItem } from '../../../services/api/admin/adminOrderService';

export default function AdminSettlement() {
  const [orders, setOrders] = useState<SettlementOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getSettlementOrders({
          page,
          limit: 15,
        });
        if (res.success && res.data) {
          setOrders(res.data.orders);
          setTotal(res.data.total);
          setPages(res.data.pages);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [page]);

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Settlement</h1>
          <p className="text-neutral-600 mt-1">Only <strong>delivered</strong> COD orders appear here. Orders in Accepted/On the way do not show until marked Delivered.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">No delivered orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">Order</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">Payment</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">Total</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">Delivery</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">Admin earning</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map(({ order, codBreakdown }) => (
                  <tr key={order._id} className="hover:bg-neutral-50/50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-neutral-900">{order.orderNumber}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-600">{formatDate(order.orderDate)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${order.paymentMethod === 'COD' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">₹{order.total?.toFixed(2) ?? '0.00'}</td>
                    <td className="py-3 px-4 text-sm">
                      {order.deliveryPreference === 'Self' ? (
                        <span className="text-amber-700 font-medium">Self</span>
                      ) : order.deliveryBoy ? (
                        <span className="text-neutral-600">{(order.deliveryBoy as any)?.name ?? '—'}</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {order.paymentMethod === 'COD' && codBreakdown ? (
                        <span className="font-semibold text-teal-700">₹{(codBreakdown.totalAdminEarning ?? 0).toFixed(2)}</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/admin/orders/${order._id}`}
                        className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
            <p className="text-sm text-neutral-600">
              Page {page} of {pages} ({total} orders)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border border-neutral-300 rounded-lg text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1 border border-neutral-300 rounded-lg text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
