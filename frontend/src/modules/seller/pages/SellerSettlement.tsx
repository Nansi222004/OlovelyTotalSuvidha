import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettlementOrders, markOrderCODPaid, type SettlementOrderItem } from '../../../services/api/orderService';

export default function SellerSettlement() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SettlementOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [settlementFilter, setSettlementFilter] = useState<'pending' | 'settled' | 'all'>('pending'); // pending = only unpaid COD (hat jata hai after pay)
  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMarkPaidToAdmin = async (orderId: string) => {
    setMarkingId(orderId);
    try {
      const res = await markOrderCODPaid(orderId);
      if (res.success) {
        setOrders((prev) => prev.filter(({ order }) => order._id !== orderId));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        alert(res.message || 'Failed to mark as paid');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark as paid');
    } finally {
      setMarkingId(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getSettlementOrders({
          page,
          limit: 15,
          settlementStatus: settlementFilter,
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
  }, [page, settlementFilter]);

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Settlement</h1>
          <p className="text-neutral-600 mt-1">Only <strong>delivered</strong> COD orders appear here. If an order is missing, mark it as &quot;Delivered&quot; first from the order detail page. Pending = not yet paid to admin — use &quot;Mark paid to admin&quot; after you pay.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={settlementFilter}
            onChange={(e) => { setSettlementFilter(e.target.value as 'pending' | 'settled' | 'all'); setPage(1); }}
            className="px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white"
          >
            <option value="pending">Pending payment (COD not paid to admin)</option>
            <option value="settled">Settled (COD already paid to admin)</option>
            <option value="all">All COD</option>
          </select>
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
                  <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">Pay admin (COD)</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">Your earning</th>
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
                    <td className="py-3 px-4 text-right">
                      {order.paymentMethod === 'COD' && codBreakdown ? (
                        <span className="font-semibold text-teal-700">₹{(codBreakdown.totalAdminEarning ?? 0).toFixed(2)}</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {codBreakdown ? (
                        <span className="font-semibold text-green-700">₹{(codBreakdown.yourEarning ?? 0).toFixed(2)}</span>
                      ) : order.paymentMethod === 'Online' ? (
                        <span className="text-neutral-500 text-sm">Credited to wallet</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {settlementFilter === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleMarkPaidToAdmin(order._id)}
                            disabled={markingId === order._id}
                            className="px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
                          >
                            {markingId === order._id ? '…' : 'Mark paid to admin'}
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/seller/orders/${order._id}`)}
                          className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                        >
                          View
                        </button>
                      </div>
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
