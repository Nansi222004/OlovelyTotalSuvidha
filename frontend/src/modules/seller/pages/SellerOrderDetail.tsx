import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { getOrderById, updateOrderStatus, getOrderEarningBreakdown, type OrderDetail, type SellerEarningBreakdown } from '../../../services/api/orderService';
import { useToast } from '../../../context/ToastContext';
import ConfirmationModal from '../../../components/ConfirmationModal';
import { formatDeliveryAddress } from '../../../utils/addressUtils';
import SellerAssignDeliveryBoyModal from '../components/SellerAssignDeliveryBoyModal';
import { SellerInvoice } from '../components/SellerInvoice';
import { exportElementToPdf } from '../../../utils/invoicePdfExport';

export default function SellerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<string>('Out For Delivery');
  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [deliveryPreference, setDeliveryPreference] = useState<'Self' | 'Admin'>('Self');
  const [earningBreakdown, setEarningBreakdown] = useState<SellerEarningBreakdown | null>(null);
  const [isExporting, setIsExporting] = useState(false);
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
          setOrderDetail(response.data);
          setOrderStatus(response.data.status);
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

  // Default delivery preference when assign popup opens: Instant → Auto, Standard → Admin
  useEffect(() => {
    if (showAssignPopup && orderDetail) {
      setDeliveryPreference('Self');
    }
  }, [showAssignPopup, orderDetail?.id]);

  // Fetch earning breakdown (COD or Online): your earning, delivery (Self = you get delivery charge)
  useEffect(() => {
    const fetchEarningBreakdown = async () => {
      if (!id || !orderDetail) return;
      try {
        const res = await getOrderEarningBreakdown(id);
        if (res.success && res.data) setEarningBreakdown(res.data);
      } catch {
        setEarningBreakdown(null);
      }
    };
    fetchEarningBreakdown();
  }, [id, orderDetail]);

  // Handle status update (for Instant, 'Auto' = don't send preference → backend auto-notifies delivery)
  const handleStatusUpdate = async (newStatus: string, pref?: 'Self' | 'Admin' | 'Auto') => {
    if (!orderDetail) return;

    try {
      const payload: any = { status: newStatus as any };
      if (pref && pref !== 'Auto') {
        payload.deliveryPreference = pref;
      }
      const response = await updateOrderStatus(orderDetail.id, payload);
      if (response.success) {
        setOrderStatus(newStatus);
        setOrderDetail({ ...orderDetail, status: newStatus as any });
        showToast(`Order status updated to ${newStatus}`, 'success');
      } else {
        showToast('Failed to update order status', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update order status', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-neutral-500">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/seller/orders')}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!orderDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Order Not Found</h2>
          <button
            onClick={() => navigate('/seller/orders')}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    let suffix = 'th';
    if (day === 1 || day === 21 || day === 31) suffix = 'st';
    else if (day === 2 || day === 22) suffix = 'nd';
    else if (day === 3 || day === 23) suffix = 'rd';
    return `${day}${suffix} ${month}, ${year}`;
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleExportPDF = async () => {
    if (!invoicePrintRef.current || !orderDetail) return;
    setIsExporting(true);
    try {
      const fileName = `Invoice_${orderDetail.invoiceNumber || orderDetail.id}.pdf`;
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-blue-100 text-blue-800 border border-blue-400';
      case 'On the way':
        return 'bg-purple-100 text-purple-800 border border-purple-400';
      case 'Delivered':
        return 'bg-green-100 text-green-800 border border-green-400';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border border-red-400';
      case 'Out For Delivery':
        return 'bg-blue-600 text-white border border-blue-700';
      case 'Received':
        return 'bg-blue-50 text-blue-600 border border-blue-200';
      case 'Payment Pending':
        return 'bg-orange-50 text-orange-600 border border-orange-200';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  };

  const formatUnit = (unit: string, qty: number) => {
    if (!unit || unit === 'N/A') return 'N/A';

    // improved regex to handle decimals and various spacing
    const match = unit.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
    if (match) {
      const val = parseFloat(match[1]);
      const u = match[2];
      // check if val is a valid number
      if (!isNaN(val)) {
        const total = val * qty;
        // Format to remove trailing zeros if integer (e.g. 1.0 -> 1)
        return `${parseFloat(total.toFixed(2))}${u}`;
      }
    }
    return `${unit} x ${qty}`;
  };

  const hasQcGroup = Boolean(
    orderDetail?.hasQcItems !== undefined
      ? orderDetail.hasQcItems
      : (
          orderDetail?.fulfillmentGroups?.some((g: any) => g.fulfillmentType === 'LOCAL_DELIVERY') ||
          orderDetail?.orderType === 'QUICK_COMMERCE'
        )
  );

  const hasEcomGroup = Boolean(
    orderDetail?.hasEcomItems !== undefined
      ? orderDetail.hasEcomItems
      : (
          orderDetail?.fulfillmentGroups?.some((g: any) => g.fulfillmentType === 'COURIER_SHIPPING' || g.fulfillmentType === 'THIRD_PARTY_API') ||
          orderDetail?.orderType === 'ECOMMERCE'
        )
  );

  const isMixedOrder = Boolean(hasQcGroup && hasEcomGroup);
  const isPureEcommerce = hasEcomGroup && !hasQcGroup;
  const isPureQc = hasQcGroup && !hasEcomGroup;

  return (
    <div className="min-h-screen bg-neutral-50 pb-8 print:bg-white print:p-0 print:m-0 print:min-h-0 print:h-auto">
      {/* Dashboard Screen View - Hidden during print */}
      <div className="space-y-6 print:hidden">
        {/* Order Action Section */}
      <div className="bg-white mb-6 rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
          <h2 className="text-base sm:text-lg font-semibold">Order Action Section</h2>
        </div>
        <div className="bg-neutral-50 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 w-full sm:w-auto flex flex-wrap gap-3 items-center">
              {['Received', 'Pending'].includes(orderStatus) ? (
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={async () => {
                      if (isPureEcommerce) {
                        await handleStatusUpdate('Accepted');
                      } else {
                        setShowAssignPopup(true);
                      }
                    }}
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors font-medium shadow-sm"
                  >
                    Accept Order
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors font-medium shadow-sm"
                  >
                    Reject Order
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <select
                    value={orderStatus}
                    onChange={(e) => handleStatusUpdate(e.target.value)}
                    className="w-full sm:w-64 px-4 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    disabled={orderStatus === 'Rejected' || orderStatus === 'Cancelled' || orderStatus === 'Delivered'}
                  >
                    {orderStatus === 'Accepted' && <option value="Accepted">Accepted</option>}
                    {isPureEcommerce ? (
                      <>
                        <option value="Processed">Processed (Packed)</option>
                        <option value="Shipped">Shipped (In Transit)</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                        {orderStatus === 'Rejected' && <option value="Rejected">Rejected</option>}
                      </>
                    ) : isMixedOrder ? (
                      <>
                        <option value="Processed">Processed (Packed)</option>
                        <option value="On the way">Out For Delivery / Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                        {orderStatus === 'Rejected' && <option value="Rejected">Rejected</option>}
                      </>
                    ) : (
                      <>
                        <option value="On the way">On the way</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                        {orderStatus === 'Rejected' && <option value="Rejected">Rejected</option>}
                      </>
                    )}
                  </select>

                  {/* Manual Assignment Button for Seller - QUICK COMMERCE ITEMS */}
                  {hasQcGroup && (!orderDetail?.deliveryBoyName || orderDetail?.deliveryBoyName === 'Self Assign') && ['Accepted', 'Processed', 'Received'].includes(orderStatus) && (
                    <button
                      onClick={() => setShowRiderModal(true)}
                      className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                    >
                      <span>🛵</span> {isMixedOrder ? 'Assign QC Delivery Partner' : 'Assign by Seller'}
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/seller/orders/${orderDetail.id}/invoice`)}
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 px-3 py-2 rounded-lg transition-colors text-sm font-semibold cursor-pointer shadow-xs"
              title="Open full page invoice"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              View Invoice
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              {isExporting ? 'Exporting PDF...' : 'Export Invoice PDF'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold shadow-xs cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Invoice
            </button>
          </div>
        </div>
      </div>

      {/* View Order Details Section */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
          <h2 className="text-base sm:text-lg font-semibold">View Order Details</h2>
        </div>
        <div className="bg-white px-4 sm:px-6 py-6">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row justify-between gap-6 mb-6">
            {/* Left: Company Info */}
            <div className="flex-1 min-w-[250px]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center shadow-inner">
                  <span className="text-white text-sm font-black">O</span>
                </div>
                <div>
                  <div className="text-xs text-green-600 font-semibold">Olovely</div>
                  <div className="text-[10px] text-green-600">Total Suvidha</div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Olovely Total Suvidha</h1>
              <div className="text-sm text-neutral-600 mb-1">
                <span className="font-medium">From:</span> Olovely Total Suvidha
              </div>
              <div className="text-sm text-neutral-600 space-y-1">
                <div>
                  <span className="font-medium">Email:</span> info@olovely.com
                </div>
                <div>
                  <span className="font-medium">Website:</span> https://olovely.com
                </div>
              </div>
            </div>

            {/* Middle: Customer Details */}
            <div className="flex-1 min-w-[280px] bg-neutral-50 p-4 rounded-lg border border-neutral-200/80 shadow-2xs">
              <div className="flex items-center justify-between mb-3 border-b border-neutral-200/60 pb-2">
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">Customer Details</h3>
                <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded">Verified</span>
              </div>
              <div className="space-y-2 text-sm text-neutral-700">
                <div className="flex items-baseline">
                  <span className="text-neutral-500 w-20 text-xs font-semibold">Name:</span>
                  <span className="font-medium text-neutral-900">{orderDetail.customerName || 'N/A'}</span>
                </div>
                <div className="flex items-baseline">
                  <span className="text-neutral-500 w-20 text-xs font-semibold">Email:</span>
                  <span className="font-medium text-neutral-900 break-all">{orderDetail.customerEmail || 'N/A'}</span>
                </div>
                <div className="flex items-baseline">
                  <span className="text-neutral-500 w-20 text-xs font-semibold">Contact:</span>
                  <span className="font-medium text-neutral-900">{orderDetail.customerPhone || 'N/A'}</span>
                </div>
                <div className="pt-2 border-t border-neutral-200/60">
                  <span className="text-neutral-500 text-xs font-semibold block mb-0.5">Delivery Address:</span>
                  <p className="text-xs text-neutral-800 leading-relaxed font-medium bg-white p-2 rounded border border-neutral-200">
                    {formatDeliveryAddress(orderDetail.deliveryAddress).formatted}
                  </p>
                  {orderDetail.deliveryAddress?.latitude && orderDetail.deliveryAddress?.longitude && (
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                      <span className="text-neutral-500 font-mono text-[11px]">
                        📍 {formatDeliveryAddress(orderDetail.deliveryAddress).latitude?.toFixed(6)}, {formatDeliveryAddress(orderDetail.deliveryAddress).longitude?.toFixed(6)}
                      </span>
                      <a
                        href={formatDeliveryAddress(orderDetail.deliveryAddress).mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-semibold text-[11px] transition-colors shadow-2xs"
                      >
                        <span>Open in Maps</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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

            {/* Right: Invoice & Summary */}
            <div className="flex-1 lg:text-right">
              {/* Channel Badge */}
              <div className="mb-2">
                {isMixedOrder ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
                    <span>⚡+📦</span> Mixed Order (Quick Commerce + Courier)
                  </span>
                ) : isPureEcommerce ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                    <span>📦</span> Ecommerce Order (Courier Fulfillment)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                    <span>⚡</span> Quick Commerce Order (Local Delivery)
                  </span>
                )}
              </div>

              <div className="text-sm text-neutral-600 mb-4">
                <span className="font-medium">Date:</span> {formatDate(orderDetail.orderDate)}
              </div>
              <div className="text-lg font-semibold text-neutral-900 mb-1">Invoice #{orderDetail.invoiceNumber}</div>
              <div className="text-sm text-neutral-600 mb-1">
                <span className="font-medium">Order ID:</span> {orderDetail.id}
              </div>
              {orderStatus === 'Delivered' && (
                <div className="text-sm text-neutral-600 mb-1">
                  <span className="font-medium">Delivery Date:</span> {formatDate(orderDetail.deliveryDate)}
                </div>
              )}
              <div className="text-sm text-neutral-600 mb-2">
                <span className="font-medium">Order Time:</span> {formatTime(orderDetail.orderDate)}
              </div>

              <div className="text-sm text-neutral-600 mb-3">
                <span className="font-medium">Payment Method:</span>{' '}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  {orderDetail.paymentMethod}
                </span>
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                <span className="text-sm font-medium text-neutral-700">Order Status:</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(orderStatus)}`}>
                  {orderStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Multi-Channel Fulfillment Sections */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>🚚</span>
              <span>Fulfillment & Logistics Channels</span>
              {isMixedOrder && (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                  Dual Fulfillment Channels
                </span>
              )}
            </h3>

            <div className={`grid grid-cols-1 ${isMixedOrder ? 'md:grid-cols-2' : ''} gap-4`}>
              {/* Quick Commerce Fulfillment Card */}
              {hasQcGroup && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-200">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                          Quick Commerce (Local Delivery)
                        </h4>
                        <span className="text-[10px] text-emerald-700 font-medium">
                          Local Rider / Hyperlocal Delivery
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      {orderDetail.deliveryOption === 'Instant' ? '⚡ Instant Express' : '⚡ Local Express'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-neutral-700">
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-150 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 font-medium">Delivery Partner:</span>
                        {orderDetail.deliveryBoyName && orderDetail.deliveryBoyName !== 'Self Assign' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-800">
                              <span>🛵</span> {orderDetail.deliveryBoyName}
                            </span>
                            {!['Delivered', 'Cancelled', 'Rejected', 'Returned'].includes(orderStatus) && (
                              <button
                                onClick={() => setShowRiderModal(true)}
                                className="text-xs text-teal-700 hover:text-teal-900 underline font-semibold cursor-pointer ml-1"
                              >
                                Change
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-700 font-medium italic">Not Assigned</span>
                            {!['Delivered', 'Cancelled', 'Rejected', 'Returned'].includes(orderStatus) && (
                              <button
                                onClick={() => setShowRiderModal(true)}
                                className="inline-flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1 rounded text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                              >
                                <span>🛵</span> Assign Delivery Boy
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {orderDetail.deliveryBoyPhone && (
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500 font-medium">Partner Contact:</span>
                          <span className="font-mono font-bold text-neutral-900">{orderDetail.deliveryBoyPhone}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 font-medium">Assignment Mode:</span>
                        <span className="font-semibold text-neutral-800">
                          {orderDetail.deliveryPreference === 'Admin' ? 'Assigned by Admin' : 'Assign by Seller'}
                        </span>
                      </div>
                    </div>

                    {/* QC Items Summary */}
                    {isMixedOrder && (
                      <div className="mt-2 text-[11px] text-emerald-800 font-medium">
                        <span className="font-bold">QC Items: </span>
                        {orderDetail.items
                          .filter((it) => it.productType !== 'ECOMMERCE')
                          .map((it) => `${it.product} (×${it.qty})`)
                          .join(', ') || 'Local delivery items'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ecommerce Courier Shipment Card */}
              {hasEcomGroup && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-blue-200">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📦</span>
                      <div>
                        <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                          Ecommerce (Courier Shipping)
                        </h4>
                        <span className="text-[10px] text-blue-700 font-medium">
                          Shiprocket / Courier Surface & Air
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                      📦 Courier Shipping
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-neutral-700">
                    {orderDetail?.fulfillmentGroups?.filter(
                      (g: any) => g.fulfillmentType === 'COURIER_SHIPPING' || g.fulfillmentType === 'THIRD_PARTY_API'
                    ).map((fg: any, idx: number) => {
                      const carrier = fg.shippingDetails?.carrier || fg.courierDetails?.provider || 'Shiprocket';
                      const awb = fg.shippingDetails?.awbNumber || fg.courierDetails?.awbNumber;
                      const trackingNo = fg.shippingDetails?.trackingNumber || fg.courierDetails?.trackingNumber;
                      const trackingUrl = fg.shippingDetails?.trackingUrl || fg.courierDetails?.trackingUrl;
                      const fgStatus = fg.status || 'Active';

                      return (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-blue-150 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500 font-medium">Carrier:</span>
                            <span className="font-bold text-neutral-900">{carrier}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500 font-medium">AWB Number:</span>
                            {awb ? (
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {awb}
                              </span>
                            ) : (
                              <span className="text-neutral-400 italic">Pending Courier Manifest</span>
                            )}
                          </div>

                          {trackingNo && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500 font-medium">Tracking ID:</span>
                              <span className="font-mono text-neutral-800">{trackingNo}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                            <div className="flex items-center gap-1.5">
                              <span className="text-neutral-500 font-medium">Shipment Status:</span>
                              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                {fgStatus}
                              </span>
                            </div>

                            {trackingUrl && (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition-colors shadow-2xs"
                              >
                                <span>Track</span>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Ecommerce Items Summary */}
                    {isMixedOrder && (
                      <div className="mt-2 text-[11px] text-blue-800 font-medium">
                        <span className="font-bold">Ecommerce Items: </span>
                        {orderDetail.items
                          .filter((it) => it.productType === 'ECOMMERCE')
                          .map((it) => `${it.product} (×${it.qty})`)
                          .join(', ') || 'Courier shipping items'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full min-w-[800px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Sr. No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Tax ₹ (%)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Subtotal</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {orderDetail.items.map((item) => (
                  <tr key={item.srNo}>
                    <td className="px-4 py-3 text-sm text-neutral-900">{item.srNo}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900 font-medium">{item.product}</td>
                    <td className="px-4 py-3 text-xs">
                      {item.productType === 'ECOMMERCE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <span>📦</span> Ecommerce
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span>⚡</span> Quick Commerce
                        </span>
                      )}
                      {item.isWholesale && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 ml-1.5">
                          <span>🏷️</span> Wholesale{item.wholesaleMinimumQuantity ? ` (MOQ ${item.wholesaleMinimumQuantity})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{formatUnit(item.unit, item.qty)}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900">₹{item.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {item.tax.toFixed(2)} ({item.taxPercent.toFixed(2)}%)
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{item.qty}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900 font-bold">₹{item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bill Generation Note */}
          <div className="border-t border-dashed border-neutral-300 pt-4">
            <p className="text-sm text-neutral-600 text-center">
              Bill Generated by Olovely Total Suvidha
            </p>
          </div>
        </div>
      </div>

      {/* Earning breakdown */}
      {earningBreakdown && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-teal-100 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">Earning breakdown</h2>
            <p className="text-sm text-teal-100 mt-0.5">Your earning from this order</p>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Admin (commission + platform fee):</span>
              <span className="font-semibold text-teal-700">₹{(earningBreakdown.totalAdminEarning ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Your earning (this order):</span>
              <span className="font-semibold text-green-700">₹{(earningBreakdown.yourEarning ?? 0).toFixed(2)}</span>
            </div>
            {earningBreakdown.note && (
              <p className="text-xs text-neutral-500">{earningBreakdown.note}</p>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-6 px-4 sm:px-6 text-center py-4 bg-neutral-100 rounded-lg">
        <p className="text-xs sm:text-sm text-neutral-600">
          Copyright © 2025. Developed By{' '}
          <span className="font-semibold text-teal-600">Olovely Total Suvidha</span>
        </p>
      </footer>

      {/* Delivery Assignment Mode Popup */}
      {showAssignPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden border border-neutral-200">
            <h3 className="text-xl font-bold text-neutral-900 mb-2">
              {isMixedOrder ? 'Accept Order & Assign QC Delivery' : 'Accept Order & Assign Delivery'}
            </h3>
            <p className="text-neutral-600 mb-6 text-sm">
              {isMixedOrder
                ? 'This mixed order contains Quick Commerce items requiring local delivery. Choose delivery assignment for the Quick Commerce portion. The Ecommerce items will be fulfilled via Courier Shipping.'
                : 'Please choose how you would like to assign the delivery for this order.'}
            </p>

            <div className="space-y-3 mb-6">
              <label
                className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all ${
                  deliveryPreference === 'Self' ? 'border-teal-500 bg-teal-50/70 ring-2 ring-teal-500/20' : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="radio"
                  name="delivery_preference"
                  value="Self"
                  checked={deliveryPreference === 'Self'}
                  onChange={() => setDeliveryPreference('Self')}
                  className="w-4 h-4 mt-0.5 text-teal-600 border-neutral-300 focus:ring-teal-500"
                />
                <div className="ml-3">
                  <span className="block text-sm font-bold text-neutral-900">Assign by Seller</span>
                  <span className="block text-xs text-neutral-500 mt-0.5">
                    {isMixedOrder
                      ? 'Manually select a local delivery partner for the Quick Commerce items.'
                      : 'Manually select a delivery partner from the list of available online riders.'}
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all ${
                  deliveryPreference === 'Admin' ? 'border-teal-500 bg-teal-50/70 ring-2 ring-teal-500/20' : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="radio"
                  name="delivery_preference"
                  value="Admin"
                  checked={deliveryPreference === 'Admin'}
                  onChange={() => setDeliveryPreference('Admin')}
                  className="w-4 h-4 mt-0.5 text-teal-600 border-neutral-300 focus:ring-teal-500"
                />
                <div className="ml-3">
                  <span className="block text-sm font-bold text-neutral-900">Assigned By Admin</span>
                  <span className="block text-xs text-neutral-500 mt-0.5">
                    {isMixedOrder
                      ? 'Let the platform admin assign an eligible delivery partner for Quick Commerce items.'
                      : 'Let the platform admin assign an eligible delivery partner for this order.'}
                  </span>
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowAssignPopup(false)}
                className="px-5 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowAssignPopup(false);
                  if (deliveryPreference === 'Self') {
                    await handleStatusUpdate('Accepted', 'Self');
                    setShowRiderModal(true);
                  } else {
                    await handleStatusUpdate('Accepted', 'Admin');
                  }
                }}
                className="px-5 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-sm"
              >
                {deliveryPreference === 'Self' ? 'Accept & Select Rider' : 'Confirm & Accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Delivery Partner Selection Modal */}
      {orderDetail && (
        <SellerAssignDeliveryBoyModal
          isOpen={showRiderModal}
          onClose={() => setShowRiderModal(false)}
          orderId={orderDetail.id}
          orderNumber={orderDetail.invoiceNumber || orderDetail.id}
          onAssignSuccess={(rider) => {
            setOrderDetail((prev) =>
              prev
                ? {
                    ...prev,
                    deliveryBoyName: rider?.name || 'Assigned Partner',
                    deliveryBoyPhone: rider?.mobile || '',
                    fulfillmentGroups: prev.fulfillmentGroups?.map((fg: any) =>
                      fg.fulfillmentType === 'LOCAL_DELIVERY'
                        ? {
                            ...fg,
                            deliveryBoy: rider ? { _id: rider._id, name: rider.name, mobile: rider.mobile } : fg.deliveryBoy,
                            status: fg.status === 'Pending' ? 'Processing' : fg.status,
                          }
                        : fg
                    ),
                  }
                : null
            );
            setOrderStatus('Processed');
          }}
        />
      )}

        <ConfirmationModal
          isOpen={showRejectModal}
          title="Reject Order"
          message="Are you sure you want to reject this order? This cannot be undone."
          confirmText="Reject Order"
          variant="danger"
          onConfirm={async () => {
            setShowRejectModal(false);
            await handleStatusUpdate('Rejected');
          }}
          onCancel={() => setShowRejectModal(false)}
        />
      </div>

      {/* Dedicated Invoice Print Root - Positioned off-screen for crisp html2canvas rendering, visible during print */}
      <div
        id="seller-invoice-print-root"
        className="print:block"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '850px',
        }}
      >
        {orderDetail && (
          <SellerInvoice ref={invoicePrintRef} orderDetail={orderDetail} />
        )}
      </div>

      {/* Print-specific style rules ensuring clean A4 document print */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all application and dashboard elements */
          body * {
            visibility: hidden !important;
          }
          /* Show ONLY the dedicated invoice container */
          #seller-invoice-print-root,
          #seller-invoice-print-root * {
            visibility: visible !important;
          }
          #seller-invoice-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}


