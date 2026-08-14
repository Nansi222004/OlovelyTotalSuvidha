import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Button from "../../components/ui/button";
import { useOrders } from "../../hooks/useOrders";

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

export default function Invoice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getOrderById, fetchOrderById } = useOrders();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      if (!id) return;

      const existingOrder = getOrderById(id);
      if (existingOrder) {
        setOrder(existingOrder);
        setLoading(false);
        return;
      }

      setLoading(true);
      const fetchedOrder = await fetchOrderById(id);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
      }
      setLoading(false);
    };

    loadOrder();
  }, [id, getOrderById, fetchOrderById]);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
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
      maximumFractionDigits: 0,
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
          <h1 className="text-xl font-bold mb-4">Invoice Not Found</h1>
          <Link to="/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = order.subtotal || 0;
  const deliveryFee = order.fees?.deliveryFee || 0;
  const platformFee = order.fees?.platformFee || 0;
  const totalAmount = order.totalAmount || subtotal + deliveryFee + platformFee;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with actions - hidden when printing */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="flex items-center gap-2">
              <PrinterIcon className="w-4 h-4" />
              Print
            </Button>
            <Link to={`/orders/${id}`}>
              <Button className="flex items-center gap-2">View Order</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 print:py-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm print:shadow-none p-8 print:p-6">
          {/* Invoice Header */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Olovely Total Suvidha
                </h1>
                <p className="text-gray-600">
                  Fast Delivery E-Commerce Platform
                </p>
                <p className="text-gray-600 mt-1">Invoice</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">Invoice Number</p>
                <p className="text-lg font-semibold text-gray-900">
                  {order.id?.split("-").slice(-1)[0] || order.id || "N/A"}
                </p>
                <p className="text-sm text-gray-600 mt-3 mb-1">Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.createdAt ? formatDate(order.createdAt) : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Customer & Order Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                Bill To
              </h2>
              <div className="text-gray-700">
                <p className="font-medium">
                  {order.address?.name || "Customer"}
                </p>
                <p className="mt-1">{order.address?.phone || ""}</p>
                <p className="mt-2">
                  {order.address?.flat && `${order.address.flat}, `}
                  {order.address?.street || order.address?.address || ""}
                </p>
                {order.address?.landmark && <p>{order.address.landmark}</p>}
                <p>
                  {order.address?.city || ""}
                  {order.address?.state && `, ${order.address.state}`}
                  {order.address?.pincode && ` - ${order.address.pincode}`}
                </p>
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                Order Information
              </h2>
              <div className="text-gray-700 space-y-1">
                <p>
                  <span className="font-medium">Order ID:</span>{" "}
                  {order.id || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Status:</span>{" "}
                  <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                    {order.status || "Placed"}
                  </span>
                </p>
                {order.paymentMethod && (
                  <p>
                    <span className="font-medium">Payment:</span>{" "}
                    {order.paymentMethod}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Order Items Table */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">
                    Item
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900">
                    Quantity
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">
                    Unit Price
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item: any, index: number) => {
                  const productName =
                    item.product?.name || item.productName || "Product";
                  const unitPrice =
                    item.product?.price || item.unitPrice || item.price || 0;
                  const quantity = item.quantity || 1;
                  const itemTotal = item.total || unitPrice * quantity;

                  return (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {item.product?.image || item.product?.mainImage ? (
                            <img
                              src={item.product.image || item.product.mainImage}
                              alt={productName}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : null}
                          <div>
                            <p className="font-medium text-gray-900">
                              {productName}
                            </p>
                            {item.variant && (
                              <p className="text-sm text-gray-500">
                                {item.variant}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-4 px-4 text-gray-700">
                        {quantity}
                      </td>
                      <td className="text-right py-4 px-4 text-gray-700">
                        {formatCurrency(unitPrice)}
                      </td>
                      <td className="text-right py-4 px-4 font-medium text-gray-900">
                        {formatCurrency(itemTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="flex justify-end mb-8">
            <div className="w-full md:w-80 space-y-3">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Delivery Fee</span>
                  <span className="font-medium">
                    {formatCurrency(deliveryFee)}
                  </span>
                </div>
              )}
              {platformFee > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Platform Fee</span>
                  <span className="font-medium">
                    {formatCurrency(platformFee)}
                  </span>
                </div>
              )}
              <div className="border-t-2 border-gray-200 pt-3 flex justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-600">
            <p className="mb-2">Thank you for your business!</p>
            <p>For any queries, please contact our customer support.</p>
          </div>
        </motion.div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            margin: 1cm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

