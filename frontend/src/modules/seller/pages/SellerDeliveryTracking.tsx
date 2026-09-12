import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getOrders,
  Order,
  GetOrdersParams,
} from "../../../services/api/orderService";
import { useSellerChannel } from "../../../context/SellerChannelContext";

type SortField = "orderId" | "status" | "customerName" | "deliveryBoyName";
type SortDirection = "asc" | "desc";

export default function SellerDeliveryTracking() {
  const navigate = useNavigate();
  const { activeChannel } = useSellerChannel();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState("10");
  const [sortField, setSortField] = useState<SortField>("orderId");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const isEcommerce = activeChannel === "ECOMMERCE";

  // Fetch active orders (On the way, Out for Delivery, or Ecommerce in-transit)
  useEffect(() => {
    const fetchTrackingOrders = async () => {
      setLoading(true);
      setError("");
      try {
        const params: GetOrdersParams = {
          page: currentPage,
          limit: parseInt(entriesPerPage),
          status: "Tracking",
          channel: activeChannel,
          sortBy: sortField,
          sortOrder: sortDirection,
        };

        if (searchQuery) {
          params.search = searchQuery;
        }

        const response = await getOrders(params);
        if (response.success && response.data) {
          setOrders(response.data);
        } else {
          setError(response.message || "Failed to fetch tracking data");
        }
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to fetch tracking data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTrackingOrders();
  }, [activeChannel, searchQuery, currentPage, sortField, sortDirection, entriesPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-800">
              {isEcommerce ? "Courier Shipment Tracking" : "Delivery Tracking"}
            </h1>
            {isEcommerce ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                <span>📦</span> Ecommerce
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span>⚡</span> Quick Commerce
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {isEcommerce
              ? "Live tracking of courier consignments, AWB numbers, and surface/air parcel transit"
              : "Live rider assignment and delivery tracking for local express orders"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center">
          <div className="relative">
            <input
              type="text"
              placeholder={isEcommerce ? "Search by Order ID, AWB, Customer..." : "Search by Order ID, Customer..."}
              className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50">
              {isEcommerce ? (
                <tr>
                  <th
                    className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("orderId")}>
                    Order ID{" "}
                    {sortField === "orderId" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Date & Time
                  </th>
                  <th
                    className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("customerName")}>
                    Customer{" "}
                    {sortField === "customerName" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier Partner
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AWB / Tracking Number
                  </th>
                  <th
                    className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("status")}>
                    Status{" "}
                    {sortField === "status" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              ) : (
                <tr>
                  <th
                    className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("orderId")}>
                    Order ID{" "}
                    {sortField === "orderId" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Date & Time
                  </th>
                  <th
                    className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("customerName")}>
                    Customer{" "}
                    {sortField === "customerName" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer Phone
                  </th>
                  <th
                    className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("deliveryBoyName")}>
                    Delivery Boy{" "}
                    {sortField === "deliveryBoyName" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery Boy Phone
                  </th>
                  <th
                    className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("status")}>
                    Status{" "}
                    {sortField === "status" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={isEcommerce ? 7 : 8}
                    className="px-6 py-10 text-center text-gray-500">
                    Loading tracking data...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={isEcommerce ? 7 : 8}
                    className="px-6 py-10 text-center text-gray-500">
                    {isEcommerce
                      ? "No active courier shipments found."
                      : "No active local deliveries found."}
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const courierGroup = order.fulfillmentGroups?.find(
                    (g: any) => g.fulfillmentType === "COURIER_SHIPPING"
                  );
                  const awb =
                    courierGroup?.courierDetails?.awbNumber ||
                    courierGroup?.courierDetails?.trackingNumber ||
                    order.trackingNumber;
                  const provider =
                    courierGroup?.courierDetails?.provider ||
                    (awb ? "Shiprocket Courier" : "Standard Logistics");

                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-teal-700 font-mono">
                        #{order.orderId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.orderDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.customerName || "N/A"}
                      </td>

                      {isEcommerce ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            <span className="inline-flex items-center gap-1 font-medium">
                              <span>📦</span> {provider}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {awb ? (
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {awb}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-xs">
                                Label Generating
                              </span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {order.customerPhone || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900 text-sm">
                                {order.deliveryBoyName || "Not Assigned"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {order.deliveryBoyPhone || "N/A"}
                          </td>
                        </>
                      )}

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            order.status === "Delivered"
                              ? "bg-green-100 text-green-800"
                              : order.status === "On the way" || order.status === "Shipped"
                                ? "bg-blue-100 text-blue-800"
                                : order.status === "Out for Delivery"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-yellow-100 text-yellow-800"
                          }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => navigate(`/seller/orders/${order.id}`)}
                          className="text-teal-600 hover:text-teal-900 font-semibold">
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination placeholder */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            Showing {orders.length} active {isEcommerce ? "shipments" : "deliveries"}
          </span>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50 text-sm">
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="px-3 py-1 border rounded hover:bg-gray-50 text-sm">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
