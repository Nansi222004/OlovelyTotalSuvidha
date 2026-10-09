import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  getOrderById,
  updateOrderStatus,
  getOrderEarningBreakdown,
  markOrderCODPaid,
  Order,
  type EarningBreakdown,
  getAvailableDeliveryPartners,
  assignDeliveryBoyAdmin,
  type AvailableDeliveryPartner,
} from '../../../services/api/admin/adminOrderService';
import SellerAssignDeliveryBoyModal from '../../seller/components/SellerAssignDeliveryBoyModal';
import { useToast } from '../../../context/ToastContext';
import { formatDeliveryAddress } from '../../../utils/addressUtils';
import ConfirmationModal from '../../../components/ConfirmationModal';
import { SellerInvoice } from '../../seller/components/SellerInvoice';
import { exportElementToPdf } from '../../../utils/invoicePdfExport';
import type { OrderDetail } from '../../../services/api/orderService';

const ALLOWED_ORDER_TRANSITIONS: Record<string, string[]> = {
  Received: ['Accepted', 'Cancelled', 'Rejected'],
  Pending: ['Accepted', 'Cancelled', 'Rejected'],
  Accepted: [
    'Processed',
    'Picked up',
    'Shipped',
    'On the way',
    'Out for Delivery',
    'Cancelled',
    'Rejected',
  ],
  Processed: [
    'Picked up',
    'Shipped',
    'On the way',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
  ],
  'Picked up': ['On the way', 'Out for Delivery', 'Delivered', 'Cancelled'],
  Shipped: ['Out for Delivery', 'On the way', 'Delivered', 'Cancelled'],
  'On the way': ['Delivered', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Cancelled'],
  Delivered: ['Returned'],
  Cancelled: [],
  Rejected: [],
  Returned: [],
};

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [earningBreakdown, setEarningBreakdown] = useState<EarningBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [markingCodPaid, setMarkingCodPaid] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const invoicePrintRef = useRef<HTMLDivElement>(null);

  // Fetch order detail from API
  useEffect(() => {
    const fetchOrderDetail = async () => {
      if (!id) return;

      setLoading(true);
      setError('');
      try {
        const response = await getOrderById(id);
        if (response.success && response.data) {
          setOrder(response.data);
        } else {
          setError(response.message || 'Failed to fetch order details');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetail();
  }, [id]);

  // Fetch earning breakdown for any order (COD or Online)
  useEffect(() => {
    const fetchEarningBreakdown = async () => {
      if (!id || !order) return;
      try {
        const res = await getOrderEarningBreakdown(id);
        if (res.success && res.data) setEarningBreakdown(res.data);
      } catch {
        setEarningBreakdown(null);
      }
    };
    fetchEarningBreakdown();
  }, [id, order]);

  const handleMarkCodPaid = async () => {
    if (!id || !order || order.paymentMethod !== 'COD') return;
    setMarkingCodPaid(true);
    try {
      const res = await markOrderCODPaid(id);
      if (res.success && res.data) {
        setOrder({ ...order, codPaidToAdminAt: res.data.codPaidToAdminAt });
        showToast('COD marked as received. This order will no longer appear in seller pending settlement.', 'success');
      } else {
        showToast(res.message || 'Failed to mark COD as paid', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to mark COD as paid', 'error');
    } finally {
      setMarkingCodPaid(false);
    }
  };

  // Handle status update (e.g. Accepted, Rejected, Processed, Shipped, Delivered)
  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;

    setUpdating(true);
    try {
      const response = await updateOrderStatus(order._id, { status: newStatus });
      if (response.success && response.data) {
        setOrder(response.data);
        showToast(`Order status updated to ${newStatus} successfully`, 'success');
      } else {
        showToast('Failed to update order status', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update order status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!invoicePrintRef.current || !order) return;
    setIsExporting(true);
    try {
      const fileName = `Invoice_${order.orderNumber || order._id}.pdf`;
      await exportElementToPdf(invoicePrintRef.current, { fileName });
      showToast('Invoice PDF exported successfully!', 'success');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      showToast('Failed to export invoice PDF. Please try Print instead.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-neutral-500 font-medium">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6 bg-white rounded-xl shadow-sm border border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900 mb-2">{error ? 'Error' : 'Order Not Found'}</h2>
          <p className="text-red-600 mb-6 text-sm">{error || 'The requested order could not be located.'}</p>
          <button
            onClick={() => navigate('/admin/orders/all')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const customer = typeof order.customer === 'object' ? order.customer : null;
  const deliveryBoy = typeof order.deliveryBoy === 'object' ? order.deliveryBoy : null;
  const items: any[] = Array.isArray(order.items) ? order.items : [];

  const isTerminal = ['Delivered', 'Cancelled', 'Rejected', 'Returned'].includes(order.status);
  const rawAllowed = ALLOWED_ORDER_TRANSITIONS[order.status] || [];
  const orderChannel = (order as any).orderType || (items.some((it: any) => it.productType === 'QUICK_COMMERCE') ? 'QUICK_COMMERCE' : 'ECOMMERCE');
  const allowedNextStatuses = rawAllowed.filter((st) => {
    if (orderChannel === 'QUICK_COMMERCE' && st === 'Shipped') return false;
    if (orderChannel === 'ECOMMERCE' && (st === 'Picked up' || st === 'On the way')) return false;
    return true;
  });

  const hasLocalQcItems = items.some(
    (it: any) =>
      it.productType === 'QUICK_COMMERCE' ||
      it.fulfillmentType === 'LOCAL_DELIVERY' ||
      it.ownerType === 'PLATFORM' ||
      !it.seller
  );
  const canAssignDeliveryPartner =
    hasLocalQcItems &&
    !isTerminal &&
    ['Accepted', 'Processed', 'Received', 'Pending'].includes(order.status);

  // Map order snapshot into authoritative OrderDetail for customer/order invoice rendering
  const invoiceOrderDetail: OrderDetail = {
    id: order._id,
    invoiceNumber: (order as any).invoiceNumber || `INV-${order.orderNumber || order._id.slice(-8).toUpperCase()}`,
    orderDate: order.orderDate || (order as any).createdAt,
    deliveryDate: (order as any).deliveryDate || (order as any).estimatedDeliveryDate || '',
    timeSlot: (order as any).deliverySlot || 'Standard Delivery',
    status: order.status,
    customerName: order.customerName || (customer as any)?.name || 'Valued Customer',
    customerEmail: order.customerEmail || (customer as any)?.email || '',
    customerPhone: order.customerPhone || (customer as any)?.phone || '',
    deliveryBoyName: (deliveryBoy as any)?.name || (order.deliveryPreference === 'Self' ? 'Self Assigned' : ''),
    deliveryBoyPhone: (deliveryBoy as any)?.mobile || '',
    items: items.map((it: any, idx: number) => {
      const isPlat = it.ownerType === 'PLATFORM' || !it.seller;
      const sellerObj = typeof it.seller === 'object' ? it.seller : null;
      return {
        id: it._id,
        srNo: String(idx + 1),
        product: it.productName || it.product?.productName || 'Product',
        soldBy: isPlat
          ? 'Olovely Total Suvidha (Platform Central)'
          : (sellerObj?.storeName || sellerObj?.sellerName || 'Olovely Partner Store'),
        unit: 'Unit',
        price: it.unitPrice || 0,
        tax: it.taxAmount || 0,
        taxPercent: it.taxRate || 0,
        qty: it.quantity || 1,
        subtotal: it.total || (it.unitPrice * (it.quantity || 1)),
        productType: it.productType || 'QUICK_COMMERCE',
        fulfillmentType: it.fulfillmentType || 'LOCAL_DELIVERY',
        isWholesale: Boolean(it.isWholesale),
        wholesalePrice: it.wholesalePrice,
        wholesaleMinimumQuantity: it.wholesaleMinimumQuantity,
        ownerType: isPlat ? 'PLATFORM' : 'VENDOR',
        billingEntityName: isPlat
          ? 'Olovely Total Suvidha (Platform Central)'
          : (it.billingEntityName || sellerObj?.storeName || 'Olovely Partner Store'),
        billingEntityGstin: it.billingEntityGstin,
        variation: it.variation || it.variantTitle,
      };
    }),
    subtotal: order.subtotal || 0,
    tax: order.tax || 0,
    shipping: order.shipping || 0,
    discount: order.discount || 0,
    platformFee: (order as any).platformFee || 0,
    couponCode: order.couponCode,
    grandTotal: order.total || 0,
    orderGrandTotal: order.total || 0,
    orderSubtotal: order.subtotal || 0,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    deliveryAddress: {
      name: order.customerName,
      phone: order.customerPhone,
      address: order.deliveryAddress?.address || '',
      city: order.deliveryAddress?.city || '',
      state: order.deliveryAddress?.state || '',
      pincode: order.deliveryAddress?.pincode || '',
      latitude: order.deliveryAddress?.latitude,
      longitude: order.deliveryAddress?.longitude,
    },
    deliveryOption: (order as any).deliveryOption || 'Standard',
  };

  const hasPlatformItems = items.some((it) => it.ownerType === 'PLATFORM' || !it.seller);
  const isPurePlatform = items.every((it) => it.ownerType === 'PLATFORM' || !it.seller);
  const isActionable = ['Received', 'Pending'].includes(order.status);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Hidden Invoice Component for Direct PDF Export */}
      <div className="absolute left-[-9999px] top-[-9999px]">
        <SellerInvoice
          ref={invoicePrintRef}
          orderDetail={invoiceOrderDetail}
        />
      </div>

      {/* Top Header & Actions Bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/admin/orders/all')}
            className="text-emerald-700 hover:text-emerald-800 mb-2 flex items-center gap-2 text-sm font-semibold transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Orders
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900">Order #{order.orderNumber}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
              order.status === 'Delivered'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : order.status === 'Cancelled' || order.status === 'Rejected'
                ? 'bg-red-100 text-red-800 border border-red-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              {order.status}
            </span>
            {hasPlatformItems && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200">
                🏢 Platform Fulfillment
              </span>
            )}
          </div>
          <p className="text-neutral-500 text-xs mt-1">Placed on {formatDate(order.orderDate)}</p>
        </div>

        {/* Invoice & Print Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowInvoiceModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            View Invoice
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {isExporting ? 'Exporting PDF...' : 'Download Invoice'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-black text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Main Order Action Section (For Platform Orders) */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden mb-6">
        <div className="bg-emerald-800 text-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">Admin Order Action Control</span>
            {hasPlatformItems && (
              <span className="text-[10px] bg-amber-400 text-amber-950 font-black px-2 py-0.5 rounded uppercase">
                Platform Actionable
              </span>
            )}
          </div>
          <span className="text-xs opacity-90">Status: {order.status}</span>
        </div>

        <div className="p-4 sm:p-6 bg-neutral-50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {isActionable ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleStatusUpdate('Accepted')}
                  disabled={updating}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Accept Order'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={updating}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  Reject Order
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {canAssignDeliveryPartner && (
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <span>🛵</span>
                    <span>{deliveryBoy ? 'Reassign QC Delivery Partner' : 'Assign QC Delivery Partner'}</span>
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-neutral-600 uppercase">Next Status:</label>
                  {isTerminal || allowedNextStatuses.length === 0 ? (
                    <span className="text-xs font-semibold px-2.5 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg">
                      Terminal ({order.status}) — Completed
                    </span>
                  ) : (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) handleStatusUpdate(e.target.value);
                      }}
                      disabled={updating}
                      className="px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="" disabled>
                        Advance from {order.status}...
                      </option>
                      {allowedNextStatuses.map((st) => (
                        <option key={st} value={st}>
                          → {st}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-neutral-600 font-medium">
            <div>
              <span>Payment: </span>
              <span className={`font-bold ${order.paymentStatus === 'Paid' ? 'text-green-600' : 'text-amber-600'}`}>
                {order.paymentMethod} ({order.paymentStatus})
              </span>
            </div>
            <div>
              <span>Items Total: </span>
              <span className="font-bold text-neutral-900">₹{order.total?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Left Content: Items & Address */}
        <div className="lg:col-span-2 space-y-6">
          {/* Multi-Channel Fulfillment & Logistics (Parity with Vendor Flow) */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5">
            <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>🚚</span>
              <span>Fulfillment & Logistics Channel</span>
              {orderChannel === 'MIXED' ? (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                  Dual Channels (QC + Ecommerce)
                </span>
              ) : orderChannel === 'QUICK_COMMERCE' ? (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  ⚡ Local Quick Commerce
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                  📦 Courier Shipping
                </span>
              )}
            </h3>

            {hasLocalQcItems && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 shadow-2xs mb-3">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-200">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                        Quick Commerce (Local Delivery)
                      </h4>
                      <span className="text-[10px] text-emerald-700 font-medium">
                        Platform Origin Warehouse / Hyperlocal Local Rider
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    {order.deliveryOption === 'Instant' ? '⚡ Instant Express' : '⚡ Local Express'}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-neutral-700">
                  <div className="bg-white p-3 rounded-lg border border-emerald-150 flex items-center justify-between">
                    <div>
                      <span className="text-neutral-500 font-medium block">Delivery Partner:</span>
                      {deliveryBoy ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-bold text-neutral-900 text-sm">🛵 {deliveryBoy.name}</span>
                          <span className="text-neutral-500 font-mono text-xs">({deliveryBoy.mobile})</span>
                          {order.deliveryBoyStatus && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                              {order.deliveryBoyStatus}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-700 font-medium italic">Not Assigned</span>
                      )}
                    </div>

                    {!isTerminal && ['Accepted', 'Processed', 'Received', 'Pending'].includes(order.status) && (
                      <button
                        type="button"
                        onClick={() => setShowAssignModal(true)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        {deliveryBoy ? 'Change Partner' : 'Assign Partner'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {items.some((it) => it.productType === 'ECOMMERCE' || it.fulfillmentType === 'COURIER_SHIPPING') && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📦</span>
                    <div>
                      <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                        Ecommerce (Courier Shipping)
                      </h4>
                      <span className="text-[10px] text-blue-700 font-medium">
                        Standard Courier / Shiprocket Logistics
                      </span>
                    </div>
                  </div>
                  {order.trackingNumber && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-100 text-blue-800">
                      AWB: {order.trackingNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-600">
                  Fulfilled via seller courier dispatch. Quick Commerce local riders do not deliver these parcels.
                </p>
              </div>
            )}
          </div>

          {/* Order Items Table matching Seller Rich Experience */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h2 className="text-base font-bold text-neutral-800">Order Items ({items.length})</h2>
              <span className="text-xs text-neutral-500 font-medium">Authoritative Snapshot</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Item Details</th>
                    <th className="py-3 px-3 text-center">Channel / Type</th>
                    <th className="py-3 px-3 text-right">Price</th>
                    <th className="py-3 px-3 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-sm">
                  {items.map((item: any, index: number) => {
                    const product = typeof item.product === 'object' ? item.product : null;
                    const seller = typeof item.seller === 'object' ? item.seller : null;
                    const isPlat = item.ownerType === 'PLATFORM' || !item.seller;
                    const isCourier = item.productType === 'ECOMMERCE' || item.fulfillmentType === 'COURIER_SHIPPING';

                    return (
                      <tr key={item._id || index} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {(item.productImage || product?.mainImage) ? (
                              <img
                                src={item.productImage || product?.mainImage}
                                alt={item.productName}
                                className="w-12 h-12 object-cover rounded-lg border border-neutral-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 text-xs font-bold">
                                IMG
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-neutral-900">
                                {item.productName || product?.productName || 'Product'}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {isPlat ? (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold border border-emerald-200">
                                    🏢 Platform Central
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-700 rounded text-[10px] font-medium border border-neutral-200">
                                    🏪 Seller: {seller?.storeName || seller?.sellerName || 'Vendor'}
                                  </span>
                                )}

                                {item.isWholesale && (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold border border-amber-200">
                                    Wholesale{item.wholesaleMinimumQuantity ? ` (MOQ ${item.wholesaleMinimumQuantity})` : ''}
                                  </span>
                                )}

                                {item.variation && (
                                  <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[10px]">
                                    {item.variation}
                                  </span>
                                )}

                                {item.sku && (
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    SKU: {item.sku}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          {isCourier ? (
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-semibold">
                              📦 Courier
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold">
                              ⚡ Local QC
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right font-medium text-neutral-700">
                          ₹{(item.unitPrice || 0).toFixed(2)}
                        </td>

                        <td className="py-3.5 px-3 text-center font-bold text-neutral-800">
                          {item.quantity || 1}
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-neutral-900">
                          ₹{(item.total || (item.unitPrice * (item.quantity || 1))).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary inside items section */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="text-xs text-neutral-500">
                GST / Tax is included in items prices snapshot. No double-taxation applied.
              </span>
              <div className="text-right">
                <span className="text-xs text-neutral-600 mr-2">Subtotal:</span>
                <span className="font-bold text-neutral-900 text-base">₹{(order.subtotal || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery & Address Card */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <span>📍</span> Delivery Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-neutral-500 uppercase">Customer & Recipient</p>
                <p className="font-bold text-neutral-900 text-base">{order.customerName}</p>
                <p className="text-neutral-700">{order.customerPhone}</p>
                <p className="text-neutral-600 text-xs">{order.customerEmail}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-bold text-neutral-500 uppercase">Delivery Address</p>
                <p className="text-neutral-800 font-medium">
                  {formatDeliveryAddress(order.deliveryAddress).formatted}
                </p>
                {order.deliveryAddress?.landmark && (
                  <p className="text-xs text-neutral-500">Landmark: {order.deliveryAddress.landmark}</p>
                )}
                {formatDeliveryAddress(order.deliveryAddress).mapsUrl && (
                  <div className="pt-2">
                    <a
                      href={formatDeliveryAddress(order.deliveryAddress).mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
                    >
                      <span>Open in Maps</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Summary, Payment & Financial Breakdown */}
        <div className="space-y-6">
          {/* Order Summary Card */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-4 border-b pb-2">Order Snapshot</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-neutral-700">
                <span>Items Subtotal:</span>
                <span className="font-semibold text-neutral-900">₹{(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-700">
                <span>Delivery / Shipping:</span>
                <span className="font-semibold text-neutral-900">₹{(order.shipping || 0).toFixed(2)}</span>
              </div>
              {(order as any).platformFee > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Platform Fee:</span>
                  <span className="font-semibold text-neutral-900">₹{((order as any).platformFee || 0).toFixed(2)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}:</span>
                  <span className="font-semibold">-₹{order.discount.toFixed(2)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-neutral-500 text-xs">
                  <span>GST (Included in prices):</span>
                  <span>₹{order.tax.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-neutral-200 pt-3 mt-2 flex justify-between font-black text-base text-neutral-900">
                <span>Total Amount:</span>
                <span className="text-emerald-700">₹{(order.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Boy Details if assigned */}
          {(deliveryBoy || order.deliveryPreference === 'Self') && (
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h2 className="text-base font-bold text-neutral-900 mb-3">Delivery Partner</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-neutral-500">Partner: </span>
                  <span className="font-bold text-neutral-900">
                    {order.deliveryPreference === 'Self' ? 'Self Assigned' : (deliveryBoy as any)?.name}
                  </span>
                </div>
                {(deliveryBoy as any)?.mobile && order.deliveryPreference !== 'Self' && (
                  <div>
                    <span className="text-neutral-500">Mobile: </span>
                    <span className="font-medium text-neutral-800">{(deliveryBoy as any)?.mobile}</span>
                  </div>
                )}
                {order.deliveryBoyStatus && order.deliveryPreference !== 'Self' && (
                  <div>
                    <span className="text-neutral-500">Delivery Status: </span>
                    <span className="font-semibold text-emerald-700 capitalize">{order.deliveryBoyStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Earning breakdown for Admin (COD & Online) */}
          {earningBreakdown && (
            <div className="bg-white rounded-xl shadow-sm border border-teal-100 p-6 space-y-4">
              <h2 className="text-base font-bold text-neutral-900 border-b pb-2 flex items-center gap-2">
                <span>💰</span> Financial Settlement Breakdown
              </h2>

              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs space-y-1.5">
                <p className="font-bold text-neutral-600 uppercase tracking-wider mb-1">Customer Collected</p>
                <div className="flex justify-between text-neutral-700">
                  <span>Product Amount:</span>
                  <span className="font-semibold">₹{(order.subtotal || earningBreakdown.productCost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-700">
                  <span>Handling / Platform Fee:</span>
                  <span className="font-semibold">₹{(earningBreakdown.platformFee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-700">
                  <span>Delivery Charge:</span>
                  <span className="font-semibold">₹{(earningBreakdown.totalDeliveryCharge || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-neutral-300 pt-1 flex justify-between font-bold text-neutral-900">
                  <span>Total Paid:</span>
                  <span>₹{(order.total || earningBreakdown.totalOrderAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Admin Net Earnings */}
              <div className="bg-emerald-50 p-3.5 rounded-lg border border-emerald-200 text-xs space-y-1.5">
                <p className="font-bold text-emerald-900 uppercase tracking-wider mb-1">Platform Admin Net</p>
                <div className="flex justify-between text-emerald-800">
                  <span>Product Commission:</span>
                  <span className="font-semibold">₹{(earningBreakdown.adminProductCommission || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>Platform Fee:</span>
                  <span className="font-semibold">₹{(earningBreakdown.platformFee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>Retained Delivery Share:</span>
                  <span className="font-semibold">₹{(earningBreakdown.adminDeliveryCommission || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-emerald-300 pt-1.5 flex justify-between font-black text-sm text-emerald-900">
                  <span>Total Admin Earning:</span>
                  <span>₹{(earningBreakdown.totalAdminEarning || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* COD Settlement action */}
          {order.paymentMethod === 'COD' && (
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h2 className="text-base font-bold text-neutral-900 mb-2">COD Settlement</h2>
              {order.codPaidToAdminAt ? (
                <p className="text-xs text-green-700 font-semibold bg-green-50 p-2.5 rounded-lg border border-green-200">
                  ✓ COD received on {new Date(order.codPaidToAdminAt).toLocaleString('en-IN')}.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-600">
                    When COD cash is remitted to platform, mark as received to clear pending settlements.
                  </p>
                  <button
                    type="button"
                    onClick={handleMarkCodPaid}
                    disabled={markingCodPaid}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {markingCodPaid ? 'Marking...' : 'Mark COD as Received'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">Order Tax Invoice</span>
                <span className="text-xs text-neutral-400">#{invoiceOrderDetail.invoiceNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {isExporting ? 'Exporting...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors text-white"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-neutral-100 flex justify-center">
              <div className="bg-white shadow-md rounded-lg max-w-3xl w-full">
                <SellerInvoice orderDetail={invoiceOrderDetail} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Order Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRejectModal}
        title="Reject Order"
        message="Are you sure you want to reject this order? Platform inventory for rejected items will be restored automatically."
        confirmText="Reject Order"
        variant="danger"
        isLoading={updating}
        onConfirm={async () => {
          setShowRejectModal(false);
          await handleStatusUpdate('Rejected');
        }}
        onCancel={() => setShowRejectModal(false)}
      />

      {/* Delivery Partner Selection Modal (Reused Vendor QC Modal with Admin endpoints) */}
      {order && (
        <SellerAssignDeliveryBoyModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          orderId={order._id}
          orderNumber={order.orderNumber}
          currentDeliveryBoyId={deliveryBoy?._id}
          fetchPartners={getAvailableDeliveryPartners}
          assignPartner={assignDeliveryBoyAdmin}
          onAssignSuccess={(rider) => {
            if (rider) {
              setOrder((prev) =>
                prev
                  ? {
                      ...prev,
                      deliveryBoy: {
                        _id: rider._id,
                        name: rider.name,
                        mobile: rider.mobile,
                        email: rider.email,
                      },
                      deliveryBoyStatus: 'Assigned',
                      status: ['Pending', 'Received', 'Accepted'].includes(prev.status) ? 'Processed' : prev.status,
                    }
                  : null
              );
              showToast(`Assigned ${rider.name} to order`, 'success');
            }
          }}
        />
      )}
    </div>
  );
}
