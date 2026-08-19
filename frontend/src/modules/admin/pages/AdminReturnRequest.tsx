import { useState, useEffect } from "react";
import {
  getReturnRequests,
  updateReturnRequest,
  assignDeliveryPartnerToReturn,
  getAvailableDeliveryPartnersForReturn,
  type MiscReturnRequest as ReturnRequest,
} from "../../../services/api/admin/adminMiscService";
import { useAuth } from "../../../context/AuthContext";

export default function AdminReturnRequest() {
  const { isAuthenticated, token } = useAuth();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Assign DP modal state ──
  const [assignModal, setAssignModal] = useState<{ returnId: string; returnNum: string } | null>(null);
  const [dpList, setDpList] = useState<Array<{ _id: string; name: string; phone: string; isOnline: boolean }>>([]);
  const [dpLoading, setDpLoading] = useState(false);
  const [selectedDp, setSelectedDp] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Fetch return requests on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchReturnRequests = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: any = {
          page: currentPage,
          limit: entriesPerPage,
        };

        if (selectedStatus !== "all") {
          params.status = selectedStatus;
        }

        if (searchTerm) {
          params.search = searchTerm;
        }

        const response = await getReturnRequests(params);

        if (response.success) {
          setReturnRequests(response.data);
        } else {
          setError("Failed to load return requests");
        }
      } catch (err: any) {
        console.error("Error fetching return requests:", err);
        setError(
          err.response?.data?.message ||
          "Failed to load return requests. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReturnRequests();
  }, [
    isAuthenticated,
    token,
    currentPage,
    entriesPerPage,
    selectedStatus,
    searchTerm,
  ]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Note: Filtering is done server-side, so we just use the returnRequests as is
  const displayedRequests = returnRequests;

  // For pagination display (simplified - in real app, this would come from API)
  const totalPages = Math.ceil(displayedRequests.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;

  const handleApproveReturn = async (requestId: string) => {
    try {
      setUpdating(requestId);
      const response = await updateReturnRequest(requestId, {
        status: "Approved",
      });

      if (response.success) {
        // Update local state
        setReturnRequests((requests) =>
          requests.map((req) =>
            req._id === requestId ? { ...req, status: "Approved" } : req
          )
        );
        alert("Return request approved successfully!");
      } else {
        alert(
          "Failed to approve return request: " +
          (response.message || "Unknown error")
        );
      }
    } catch (err: any) {
      console.error("Error approving return request:", err);
      alert(
        "Failed to approve return request: " +
        (err.response?.data?.message || "Please try again.")
      );
    } finally {
      setUpdating(null);
    }
  };

  const handleRejectReturn = async (requestId: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      setUpdating(requestId);
      const response = await updateReturnRequest(requestId, {
        status: "Rejected",
        adminNotes: reason,
      });

      if (response.success) {
        // Update local state
        setReturnRequests((requests) =>
          requests.map((req) =>
            req._id === requestId ? { ...req, status: "Rejected" } : req
          )
        );
        alert("Return request rejected successfully!");
      } else {
        alert(
          "Failed to reject return request: " +
          (response.message || "Unknown error")
        );
      }
    } catch (err: any) {
      console.error("Error rejecting return request:", err);
      alert(
        "Failed to reject return request: " +
        (err.response?.data?.message || "Please try again.")
      );
    } finally {
      setUpdating(null);
    }
  };

  const handleExport = () => {
    alert("Export functionality will be implemented here");
  };

  const handleClearDate = () => {
    setFromDate("");
    setToDate("");
  };

  const sellers = ["All Seller", "Seller 1", "Seller 2", "Seller 3"];

  const statuses = [
    "All Status",
    "Pending",
    "Approved",
    "Pickup Pending",
    "Delivery Partner Assigned",
    "Picked Up",
    "In Transit",
    "Handed To Seller",
    "Completed",
    "Rejected",
  ];

  const getStatusBadgeClass = (status: string) => {
    const map: Record<string, string> = {
      Pending: 'bg-yellow-100 text-yellow-800',
      Approved: 'bg-blue-100 text-blue-800',
      Rejected: 'bg-red-100 text-red-800',
      'Pickup Pending': 'bg-sky-100 text-sky-800',
      'Delivery Partner Assigned': 'bg-indigo-100 text-indigo-800',
      'Picked Up': 'bg-orange-100 text-orange-800',
      'In Transit': 'bg-amber-100 text-amber-800',
      'Handed To Seller': 'bg-purple-100 text-purple-800',
      Completed: 'bg-green-100 text-green-800',
    };
    return map[status] || 'bg-neutral-100 text-neutral-700';
  };

  const openAssignModal = async (req: ReturnRequest) => {
    setAssignModal({ returnId: req._id, returnNum: req.orderItemId });
    setSelectedDp('');
    setAssignError('');
    setDpLoading(true);
    try {
      const res = await getAvailableDeliveryPartnersForReturn();
      setDpList(res.success ? (res.data || []) : []);
    } catch {
      setDpList([]);
    } finally {
      setDpLoading(false);
    }
  };

  const handleAssignDp = async () => {
    if (!assignModal || !selectedDp) return;
    setAssigning(true);
    setAssignError('');
    try {
      const res = await assignDeliveryPartnerToReturn(assignModal.returnId, selectedDp);
      if (res.success) {
        setReturnRequests(prev =>
          prev.map(r => r._id === assignModal.returnId
            ? { ...r, status: 'Delivery Partner Assigned', deliveryBoy: { _id: selectedDp, name: dpList.find(d => d._id === selectedDp)?.name || '' } }
            : r
          )
        );
        setAssignModal(null);
        alert('✅ Delivery partner assigned! They will receive a notification.');
      } else {
        setAssignError(res.message || 'Assignment failed');
      }
    } catch (err: any) {
      setAssignError(err.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-2xl font-semibold text-neutral-800">
          Return Request
        </h1>
        <div className="text-sm text-neutral-600">
          <span className="text-teal-600 hover:text-teal-700 cursor-pointer">
            Home
          </span>
          <span className="mx-2">/</span>
          <span className="text-neutral-800">Return Request</span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        {/* Green Header Bar */}
        <div className="bg-green-500 px-4 sm:px-6 py-3">
          <h2 className="text-white text-lg font-semibold">
            View Return Request
          </h2>
        </div>

        {/* Filters */}
        <div className="p-4 sm:p-6 border-b border-neutral-200">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left Side Filters */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">
              {/* From - To Date */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  From - To Date:
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400">
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <input
                      type="text"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      placeholder="MM/DD/YYYY"
                      className="pl-10 pr-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[140px]"
                    />
                  </div>
                  <span className="text-neutral-500">-</span>
                  <div className="relative">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400">
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <input
                      type="text"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      placeholder="MM/DD/YYYY"
                      className="pl-10 pr-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[140px]"
                    />
                  </div>
                  <button
                    onClick={handleClearDate}
                    className="px-3 py-2 bg-neutral-700 hover:bg-neutral-800 text-white rounded text-sm transition-colors">
                    Clear
                  </button>
                </div>
              </div>

              {/* Filter by Seller */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  Filter by Seller:
                </label>
                <select
                  value={selectedSeller}
                  onChange={(e) => {
                    setSelectedSeller(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[130px]">
                  {sellers.map((seller) => (
                    <option
                      key={seller}
                      value={seller === "All Seller" ? "all" : seller}>
                      {seller}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by Status */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  Filter by Status:
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[130px]">
                  {statuses.map((status) => (
                    <option
                      key={status}
                      value={status === "All Status" ? "all" : status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Side Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              {/* Per Page */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-700">Per Page:</span>
                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    setEntriesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {/* Search */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700">Search:</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search:"
                  className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[150px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("orderItemId")}>
                  <div className="flex items-center gap-2">
                    Order Item Id
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("user")}>
                  <div className="flex items-center gap-2">
                    User
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("product")}>
                  <div className="flex items-center gap-2">
                    Product
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("variant")}>
                  <div className="flex items-center gap-2">
                    Variant
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("price")}>
                  <div className="flex items-center gap-2">
                    Price
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("discPrice")}>
                  <div className="flex items-center gap-2">
                    Disc Price
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("quantity")}>
                  <div className="flex items-center gap-2">
                    Quantity
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("total")}>
                  <div className="flex items-center gap-2">
                    Total
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("status")}>
                  <div className="flex items-center gap-2">
                    Status
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("date")}>
                  <div className="flex items-center gap-2">
                    Date
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 sm:px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-2"></div>
                      Loading return requests...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 sm:px-6 py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : displayedRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 sm:px-6 py-8 text-center text-sm text-neutral-500">
                    No return requests found
                  </td>
                </tr>
              ) : (
                displayedRequests.map((request) => (
                  <tr key={request._id} className="hover:bg-neutral-50">
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                      {request.orderItemId}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-medium">
                      {request.userName}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {request.productName}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {request.variant || "-"}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                      ₹{request.price.toFixed(2)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                      ₹{(request.discountedPrice || request.price).toFixed(2)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {request.quantity}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-medium">
                      ₹{request.total.toFixed(2)}
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex flex-col gap-1.5">
                        {request.status === "Pending" ? (
                          <>
                            <button
                              onClick={() => handleApproveReturn(request._id)}
                              disabled={updating === request._id}
                              className="p-1.5 bg-green-100 hover:bg-green-200 disabled:bg-neutral-100 disabled:text-neutral-400 text-green-700 rounded transition-colors"
                              title="Approve">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRejectReturn(request._id)}
                              disabled={updating === request._id}
                              className="p-1.5 bg-red-100 hover:bg-red-200 disabled:bg-neutral-100 disabled:text-neutral-400 text-red-700 rounded transition-colors"
                              title="Reject">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </>
                        ) : request.status === "Pickup Pending" ? (
                          <button
                            id={`btn-assign-dp-${request._id}`}
                            onClick={() => openAssignModal(request)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors whitespace-nowrap"
                          >
                            Assign DP
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-500">{request.status}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          <div className="text-xs sm:text-sm text-neutral-700">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, displayedRequests.length)} of{" "}
            {displayedRequests.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || totalPages === 0}
              className={`p-2 border border-green-300 rounded bg-white ${currentPage === 1 || totalPages === 0
                ? "text-neutral-400 cursor-not-allowed"
                : "text-neutral-700 hover:bg-green-50"
                }`}
              aria-label="Previous page">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M15 18L9 12L15 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className={`p-2 border border-green-300 rounded bg-white ${currentPage === totalPages || totalPages === 0
                ? "text-neutral-400 cursor-not-allowed"
                : "text-neutral-700 hover:bg-green-50"
                }`}
              aria-label="Next page">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-neutral-500 py-4">
        Copyright © 2025. Developed By{" "}
        <a href="#" className="text-teal-600 hover:text-teal-700">
          Olovely Total Suvidha
        </a>
      </div>

      {/* Assign Delivery Partner Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-neutral-900 font-semibold text-lg mb-1">Assign Delivery Partner</h3>
            <p className="text-neutral-500 text-sm mb-4">Order Item: <span className="font-medium text-neutral-700">{assignModal.returnNum}</span></p>
            {dpLoading ? (
              <div className="flex items-center gap-2 py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
                <span className="text-neutral-500 text-sm">Loading delivery partners...</span>
              </div>
            ) : dpList.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-yellow-700 text-sm">No active delivery partners available. Make sure DPs are online.</p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Select Delivery Partner</label>
                <select
                  id="select-dp"
                  value={selectedDp}
                  onChange={e => setSelectedDp(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose a delivery partner --</option>
                  {dpList.map(dp => (
                    <option key={dp._id} value={dp._id}>
                      {dp.name} — {dp.phone} {dp.isOnline ? '🟢' : '⚫'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {assignError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-red-600 text-sm">{assignError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 text-sm font-medium hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-assign-dp"
                onClick={handleAssignDp}
                disabled={!selectedDp || assigning}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

