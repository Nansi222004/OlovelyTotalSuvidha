import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Button from "../../components/ui/button";
import { useOrders } from "../../hooks/useOrders";
import { exportElementToPdf } from "../../utils/invoicePdfExport";

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const PrinterIcon = ({ className }: { className?: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

const ReceiptIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="16" y2="15" />
  </svg>
);

export default function Invoice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getOrderById, fetchOrderById } = useOrders();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadOrder = async () => {
      if (!id) return;

      const existingOrder = getOrderById(id);
      if (existingOrder) {
        setOrder(existingOrder);
      }

      setLoading(!existingOrder);
      try {
        const fetchedOrder = await fetchOrderById(id);
        if (fetchedOrder) {
          setOrder(fetchedOrder);
        }
      } catch (err) {
        console.error("Failed to fetch order for invoice:", err);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [id, getOrderById, fetchOrderById]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    try {
      setDownloadingPdf(true);
      const invoiceNum = order?.invoiceNumber || (order?.id ? `INV-${order.id.slice(-8).toUpperCase()}` : "Customer-Invoice");
      await exportElementToPdf(invoiceRef.current, {
        fileName: `${invoiceNum}.pdf`,
      });
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <p className="text-sm text-neutral-500">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ReceiptIcon className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-sm text-gray-600 mb-6">
            We could not find the order you are looking for or you may not have permission to view it.
          </p>
          <Link to="/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Business Rule Check: Invoices are only available once the order is delivered/completed and payment is satisfied
  const isInvoiceEligible = Boolean(order.invoiceEnabled);

  if (!isInvoiceEligible) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="w-5 h-5" />
              <span>Back</span>
            </button>
            <Link to={`/orders/${id}`}>
              <Button variant="outline">View Order</Button>
            </Link>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ReceiptIcon className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Invoice Not Available Yet
            </h1>
            <p className="text-gray-600 text-sm mb-6">
              {order.status === "Cancelled"
                ? "Tax invoices are not generated for cancelled orders."
                : "Tax invoices are officially generated and available for download after your order is successfully delivered and payment is completed."}
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left text-sm space-y-2 border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500">Order Number:</span>
                <span className="font-semibold text-gray-900">{order.orderNumber || order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Status:</span>
                <span className="font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs">
                  {order.status || "Received"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment:</span>
                <span className="font-medium text-gray-800">
                  {order.paymentMethod || "COD"} ({order.paymentStatus || "Pending"})
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to={`/orders/${id}`} className="flex-1">
                <Button className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white">
                  Track Order
                </Button>
              </Link>
              <Link to="/orders" className="flex-1">
                <Button variant="outline" className="w-full border-gray-300">
                  All Orders
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Invoice calculations and data mapping
  const addr = order.deliveryAddress || order.address || {};
  const subtotal = order.subtotal || 0;
  const deliveryFee = order.shipping ?? order.fees?.deliveryFee ?? 0;
  const platformFee = order.platformFee ?? order.fees?.platformFee ?? 0;
  const discount = order.discount || 0;
  const tax = order.tax || 0;
  const totalAmount = order.totalAmount ?? order.total ?? Math.max(0, subtotal + deliveryFee + platformFee + tax - discount);
  const customerName = order.customerName || addr.name || "Valued Customer";
  const customerPhone = order.customerPhone || addr.phone || "";
  const invoiceNumber = order.invoiceNumber || (order.id ? `INV-${order.id.slice(-8).toUpperCase()}` : "N/A");

  // Separate items for Hybrid order support (Quick Commerce vs E-Commerce)
  const qcItems: any[] = [];
  const ecommerceItems: any[] = [];

  (order.items || []).forEach((item: any) => {
    const pType = item.productType || item.product?.productType;
    const isCourier = pType === "ECOMMERCE" || item.fulfillmentType === "COURIER_SHIPPING";
    if (isCourier) {
      ecommerceItems.push(item);
    } else {
      qcItems.push(item);
    }
  });

  const isHybrid = qcItems.length > 0 && ecommerceItems.length > 0;

  const renderItemRow = (item: any, index: number) => {
    const productName = item.product?.productName || item.productName || item.product?.name || "Product";
    const unitPrice = item.unitPrice ?? item.price ?? item.wholesalePrice ?? item.product?.price ?? 0;
    const quantity = item.quantity || 1;
    const itemTotal = item.total || unitPrice * quantity;
    const isWholesale = Boolean(item.isWholesale || item.wholesalePrice != null);
    const productImage = item.productImage || item.product?.mainImage || item.product?.image;
    const packOrVariant = item.variant || item.pack || item.product?.pack || item.product?.packageDetails;

    return (
      <tr key={item._id || index} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
        <td className="py-3 px-4">
          <div className="flex items-center gap-3">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="w-10 h-10 object-cover rounded border border-gray-100 flex-shrink-0"
              />
            ) : null}
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {productName}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {packOrVariant && (
                  <span className="text-xs text-gray-500">
                    {packOrVariant}
                  </span>
                )}
                {isWholesale && (
                  <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-semibold">
                    Wholesale (Qty: {quantity})
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="text-center py-3 px-4 text-gray-700 text-sm font-medium">
          {quantity}
        </td>
        <td className="text-right py-3 px-4 text-gray-700 text-sm">
          {formatCurrency(unitPrice)}
        </td>
        <td className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">
          {formatCurrency(itemTotal)}
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header bar with actions (hidden when printing or PDF rendering) */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="font-medium text-sm">Back</span>
          </button>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs sm:text-sm border-gray-300">
              <PrinterIcon className="w-4 h-4 text-gray-600" />
              <span>Print</span>
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white">
              <DownloadIcon className="w-4 h-4" />
              <span>{downloadingPdf ? "Generating..." : "Download PDF"}</span>
            </Button>
            <Link to={`/orders/${id}`}>
              <Button variant="outline" className="border-gray-300 text-xs sm:text-sm">
                View Order
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Printable Invoice Container */}
      <div className="max-w-4xl mx-auto px-4 py-8 print:py-0 print:px-0">
        <motion.div
          ref={invoiceRef}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 print:border-none print:shadow-none p-8 print:p-6 text-gray-800">
          
          {/* Header Section */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  Olovely Total Suvidha
                </h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  Fast Delivery E-Commerce & Quick Commerce Platform
                </p>
                <div className="inline-block mt-2 px-2.5 py-0.5 bg-green-50 border border-green-200 rounded text-xs font-bold text-green-700 uppercase tracking-wider">
                  Customer Tax Invoice
                </div>
              </div>
              <div className="text-left sm:text-right space-y-1">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  Invoice Number
                </p>
                <p className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                  {invoiceNumber}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Order Date:{" "}
                  <span className="font-semibold text-gray-800">
                    {order.orderDate ? formatDate(order.orderDate) : formatDate(order.createdAt)}
                  </span>
                </p>
                {order.deliveredAt && (
                  <p className="text-xs text-gray-500">
                    Delivered Date:{" "}
                    <span className="font-semibold text-green-700">
                      {formatDate(order.deliveredAt)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Order Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 bg-gray-50/70 p-5 rounded-lg border border-gray-100">
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Billed & Delivered To
              </h2>
              <p className="font-bold text-gray-900 text-base">{customerName}</p>
              {customerPhone && (
                <p className="text-sm text-gray-600 mt-0.5">{customerPhone}</p>
              )}
              <div className="text-sm text-gray-700 mt-2 leading-relaxed">
                {addr.flat && <span>{addr.flat}, </span>}
                {addr.street || addr.address || ""}
                {addr.landmark && <p className="text-xs text-gray-500 mt-0.5">Landmark: {addr.landmark}</p>}
                <p className="font-medium text-gray-800 mt-0.5">
                  {addr.city || ""}
                  {addr.state ? `, ${addr.state}` : ""}
                  {addr.pincode ? ` - ${addr.pincode}` : ""}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Order Information
              </h2>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Order ID:</span>
                  <span className="font-semibold text-gray-900 font-mono">{order.orderNumber || order.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Order Fulfillment:</span>
                  <span className="font-medium text-gray-800">
                    {order.orderType === "MIXED"
                      ? "Hybrid (Quick Commerce + E-Commerce)"
                      : order.orderType === "ECOMMERCE"
                      ? "Standard E-Commerce Courier"
                      : "Express Quick Commerce"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Order Status:</span>
                  <span className="font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">
                    {order.status || "Delivered"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Method:</span>
                  <span className="font-medium text-gray-800">
                    {order.paymentMethod || "COD"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Status:</span>
                  <span className="font-semibold text-green-700">
                    {order.paymentStatus || "Paid"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items Table(s) - Hybrid Support */}
          {isHybrid ? (
            <div className="space-y-6 mb-8">
              {/* Quick Commerce Section */}
              {qcItems.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-amber-50/60 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                      ⚡ Quick Commerce Items (Local Express Delivery)
                    </span>
                    <span className="text-xs text-gray-500 font-medium">{qcItems.length} {qcItems.length === 1 ? "item" : "items"}</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/80 text-xs font-bold text-gray-600 uppercase">
                        <th className="text-left py-2.5 px-4">Item</th>
                        <th className="text-center py-2.5 px-4 w-20">Qty</th>
                        <th className="text-right py-2.5 px-4 w-28">Price</th>
                        <th className="text-right py-2.5 px-4 w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody>{qcItems.map(renderItemRow)}</tbody>
                  </table>
                </div>
              )}

              {/* E-Commerce Section */}
              {ecommerceItems.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-50/60 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                      📦 E-Commerce Items (Standard Courier Shipping)
                    </span>
                    <span className="text-xs text-gray-500 font-medium">{ecommerceItems.length} {ecommerceItems.length === 1 ? "item" : "items"}</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/80 text-xs font-bold text-gray-600 uppercase">
                        <th className="text-left py-2.5 px-4">Item</th>
                        <th className="text-center py-2.5 px-4 w-20">Qty</th>
                        <th className="text-right py-2.5 px-4 w-28">Price</th>
                        <th className="text-right py-2.5 px-4 w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody>{ecommerceItems.map(renderItemRow)}</tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                <span className="font-bold text-sm text-gray-800">
                  {ecommerceItems.length > 0
                    ? "📦 E-Commerce Items (Standard Courier Shipping)"
                    : "⚡ Ordered Items (Local Express Delivery)"}
                </span>
                <span className="text-xs text-gray-500 font-medium">{(order.items || []).length} {order.items?.length === 1 ? "item" : "items"}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-xs font-bold text-gray-600 uppercase">
                    <th className="text-left py-2.5 px-4">Item</th>
                    <th className="text-center py-2.5 px-4 w-20">Qty</th>
                    <th className="text-right py-2.5 px-4 w-28">Unit Price</th>
                    <th className="text-right py-2.5 px-4 w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map(renderItemRow)}
                </tbody>
              </table>
            </div>
          )}

          {/* Financial Summary & Payment Breakdown */}
          <div className="flex justify-end mb-8">
            <div className="w-full sm:w-88 bg-gray-50/80 p-5 rounded-lg border border-gray-200 space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
              </div>

              {/* Delivery Fee with First Order Free Shipping snapshot support */}
              {order.firstOrderFreeShippingApplied ? (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Standard Shipping</span>
                    <span>{formatCurrency(order.normalShippingAmount ?? deliveryFee ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-green-700 font-medium">
                    <span>First Order Free Shipping</span>
                    <span>- {formatCurrency(order.shippingDiscount ?? order.normalShippingAmount ?? deliveryFee ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 font-medium">
                    <span>Final Delivery Fee</span>
                    <span className="text-green-700 font-bold uppercase text-xs">Free (₹0)</span>
                  </div>
                </>
              ) : deliveryFee > 0 ? (
                <div className="flex justify-between text-gray-600">
                  <span>Delivery / Shipping Fee</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(deliveryFee)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Fee</span>
                  <span className="text-green-700 font-semibold">Free</span>
                </div>
              )}

              {/* Platform Fee */}
              {platformFee > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Platform / Handling Fee</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(platformFee)}</span>
                </div>
              )}

              {/* Coupon / Promo Discount */}
              {discount > 0 && (
                <div className="flex justify-between text-green-700 font-medium">
                  <span>Discount {order.couponCode ? `(${order.couponCode})` : ""}</span>
                  <span>- {formatCurrency(discount)}</span>
                </div>
              )}

              {/* Taxes */}
              {tax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax (Included/Calculated)</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(tax)}</span>
                </div>
              )}

              {/* Wallet Amount Used */}
              {Boolean(order.walletAmountUsed && order.walletAmountUsed > 0) && (
                <div className="flex justify-between text-blue-700 font-medium">
                  <span>Wallet Balance Used</span>
                  <span>- {formatCurrency(order.walletAmountUsed)}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="border-t-2 border-gray-300 pt-3 flex justify-between text-base font-extrabold text-gray-900">
                <span>Total Amount</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>

              {/* Payment Settlement Snapshot */}
              <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
                {order.paymentMethod === "COD" ? (
                  <p className="text-gray-700">
                    Payment: <span className="font-semibold">Cash on Delivery (Settled)</span>
                  </p>
                ) : (
                  <p className="text-gray-700">
                    Payment: <span className="font-semibold">Prepaid via {order.paymentMethod || "Online"} (Paid)</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-600">
              This is a computer-generated tax invoice and requires no physical signature.
            </p>
            <p>
              Thank you for shopping with <span className="font-semibold text-gray-700">Olovely Total Suvidha</span>!
            </p>
            <p className="text-gray-400">
              For queries or return assistance, please reach out via Customer Support in your order dashboard.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Print stylesheet */}
      <style>{`
        @media print {
          @page {
            margin: 10mm;
            size: A4 portrait;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:py-0 {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
          .print\\:px-0 {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
