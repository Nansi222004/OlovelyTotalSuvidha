import { useState, useEffect } from "react";
import {
  getWalletTransactions,
  createManualTransfer,
  type WalletTransaction,
} from "../../../services/api/admin/adminWalletService";
import { getAllSellers as getSellers } from "../../../services/api/sellerService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

interface Transaction {
  id: string;
  sellerName: string;
  sellerId: string;
  orderId?: string;
  orderItemId?: string;
  productName?: string;
  variation?: string;
  flag: string;
  amount: number;
  remark?: string;
  date: string;
  type: string;
  status: string;
}

interface Seller {
  _id: string;
  sellerName: string;
  storeName: string;
}

export default function AdminSellerTransaction() {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transfer Modal States
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferType, setTransferType] = useState<"Credit" | "Debit">("Credit");
  const [transferRemark, setTransferRemark] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  // Fetch sellers on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchSellers = async () => {
      try {
        // Fetch all sellers (not just approved) as requested
        const response = await getSellers();
        if (response.success && response.data) {
          setSellers(
            response.data.map((seller) => ({
              _id: seller._id,
              sellerName: seller.sellerName,
              storeName: seller.storeName,
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching sellers:", err);
        setError("Failed to load sellers");
      }
    };

    fetchSellers();
  }, [isAuthenticated, token]);

  // Fetch transactions based on selected seller
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch transactions (either all sellers or specific seller)
        const params: any = {
          userType: "SELLER",
          page: 1,      // Frontend holds all state memory, but we can make it dynamic if we rely fully on backend pagination. Wait, existing code buffers it on frontend. Let's fetch a chunk.
          limit: selectedSeller === "all" ? 500 : entriesPerPage,
        };

        if (selectedSeller !== "all") {
          params.userId = selectedSeller;
          params.page = currentPage;
        }

        const response = await getWalletTransactions(params);

        if (response.success && response.data) {
          const fetchedTx: Transaction[] = response.data.map(
            (tx: any) => ({
              id: tx._id,
              sellerName: tx.userName || "Unknown Seller",
              sellerId: tx.userId || selectedSeller,
              amount: tx.amount,
              flag: tx.type, // Credit / Debit
              date: tx.createdAt,
              type: tx.type,
              status: tx.status,
              remark: tx.description,
              orderId: tx.relatedOrder?.orderNumber || undefined
            })
          );

          if (selectedSeller === "all") {
            fetchedTx.sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
          }
          setTransactions(fetchedTx);
        } else {
          setTransactions([]);
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setError("Failed to load transactions. Please try again.");
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedSeller !== "all" || sellers.length > 0) {
      fetchTransactions();
    }
  }, [
    selectedSeller,
    currentPage,
    entriesPerPage,
    isAuthenticated,
    token,
    sellers,
  ]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Filter transactions based on search term
  const filteredTransactions = transactions.filter(
    (transaction) => {
      const matchesSearch =
        String(transaction.sellerName || "").toLowerCase().includes(String(searchTerm || "").toLowerCase()) ||
        (transaction.orderId &&
          String(transaction.orderId).toLowerCase().includes(String(searchTerm || "").toLowerCase())) ||
        (transaction.productName &&
          String(transaction.productName)
            .toLowerCase()
            .includes(String(searchTerm || "").toLowerCase())) ||
        String(transaction.id || "").toLowerCase().includes(String(searchTerm || "").toLowerCase()) ||
        (transaction.remark &&
          String(transaction.remark).toLowerCase().includes(String(searchTerm || "").toLowerCase()));

      const matchesMethod = selectedMethod === "all" ||
        String(transaction.flag || "").toLowerCase() === String(selectedMethod || "").toLowerCase() ||
        (selectedMethod === "Bank Transfer" && String(transaction.type || "").toLowerCase().includes("bank"));

      let matchesDate = true;
      if (fromDate || toDate) {
        const txDate = new Date(transaction.date);
        txDate.setHours(0, 0, 0, 0);
        if (fromDate) {
          const start = new Date(fromDate);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) matchesDate = false;
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) matchesDate = false;
        }
      }

      return matchesSearch && matchesMethod && matchesDate;
    }
  );

  // Sort transactions
  if (sortColumn) {
    filteredTransactions.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "sellerName":
          aValue = a.sellerName;
          bValue = b.sellerName;
          break;
        case "amount":
          aValue = a.amount;
          bValue = b.amount;
          break;
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(filteredTransactions.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const displayedTransactions = filteredTransactions.slice(
    startIndex,
    endIndex
  );

  const handleExport = () => {
    const headers = ["Id", "Seller Name", "Order Id", "Order Item Id", "Product Name", "Variation", "Flag", "Amount", "Remark", "Date"];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") + "\n" +
      filteredTransactions.map(t => [
        t.id,
        `"${t.sellerName.replace(/"/g, '""')}"`,
        t.orderId || "-",
        t.orderItemId || "-",
        `"${(t.productName || t.type).replace(/"/g, '""')}"`,
        `"${(t.variation || "-").replace(/"/g, '""')}"`,
        t.flag,
        t.amount,
        `"${(t.remark || t.status || "").replace(/"/g, '""')}"`,
        `"${new Date(t.date).toLocaleDateString()}"`
      ].join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `seller_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearDate = () => {
    setFromDate("");
    setToDate("");
  };

  const methods = ["All", "Credit", "Debit"];

  const handleFundTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeller === "all") {
      setTransferError("Please select a specific seller from the filter dropdown first.");
      return;
    }
    if (!transferAmount || isNaN(Number(transferAmount)) || Number(transferAmount) <= 0) {
      setTransferError("Please enter a valid amount.");
      return;
    }
    if (!transferRemark) {
      setTransferError("Please enter a remark.");
      return;
    }

    try {
      setIsTransferring(true);
      setTransferError("");

      const res = await createManualTransfer({
        userId: selectedSeller,
        userType: 'SELLER',
        amount: Number(transferAmount),
        type: transferType,
        description: transferRemark,
      });

      if (res.success) {
        setIsTransferModalOpen(false);
        setTransferAmount("");
        setTransferRemark("");

        // Simply reload to fetch fresh transactions
        window.location.reload();
      } else {
        setTransferError(res.message || "Failed to process transfer");
      }
    } catch (err: any) {
      setTransferError(err.response?.data?.message || err.message || "Something went wrong");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-teal-600 px-4 sm:px-6 py-4 rounded-t-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-white text-xl sm:text-2xl font-semibold">
          View Seller List
        </h1>
        <button
          onClick={() => {
            if (selectedSeller === "all") {
              showToast("Please select a specific seller from the dropdown filter first.", "error");
              return;
            }
            setIsTransferModalOpen(true);
          }}
          className="bg-white text-teal-600 border-2 border-teal-600 hover:bg-teal-50 px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Fund Transfer
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
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
                      className="pl-10 pr-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[140px]"
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
                      className="pl-10 pr-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[140px]"
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
                  disabled={loading}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[130px] disabled:bg-neutral-100 disabled:cursor-not-allowed">
                  <option value="all">All Sellers</option>
                  {sellers.map((seller) => (
                    <option key={seller._id} value={seller._id}>
                      {seller.sellerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by Method */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  Filter by Method:
                </label>
                <select
                  value={selectedMethod}
                  onChange={(e) => {
                    setSelectedMethod(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[100px]">
                  {methods.map((method) => (
                    <option
                      key={method}
                      value={method === "All" ? "all" : method}>
                      {method}
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
                  className="px-2 py-1 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors">
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
                  className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[150px]"
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
                  onClick={() => handleSort("id")}>
                  <div className="flex items-center gap-2">
                    Id
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
                  onClick={() => handleSort("sellerName")}>
                  <div className="flex items-center gap-2">
                    Seller Name
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
                  onClick={() => handleSort("orderId")}>
                  <div className="flex items-center gap-2">
                    Order Id
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
                  onClick={() => handleSort("productName")}>
                  <div className="flex items-center gap-2">
                    Product Name
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
                  onClick={() => handleSort("variation")}>
                  <div className="flex items-center gap-2">
                    Variation
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
                  onClick={() => handleSort("flag")}>
                  <div className="flex items-center gap-2">
                    Flag
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
                  onClick={() => handleSort("amount")}>
                  <div className="flex items-center gap-2">
                    Amount
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
                  onClick={() => handleSort("remark")}>
                  <div className="flex items-center gap-2">
                    Remark
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 sm:px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-2"></div>
                      Loading transactions...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 sm:px-6 py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : displayedTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 sm:px-6 py-8 text-center text-sm text-neutral-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-neutral-50">
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                      {transaction.id.slice(-6)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-medium">
                      {transaction.sellerName}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {transaction.orderId || "-"}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {transaction.orderItemId || "-"}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {transaction.productName || transaction.type}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {transaction.variation || "-"}
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${transaction.flag === "credit"
                          ? "bg-green-100 text-green-800"
                          : transaction.flag === "debit"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                          }`}>
                        {transaction.flag.charAt(0).toUpperCase() +
                          transaction.flag.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-medium">
                      ₹{transaction.amount.toFixed(2)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {transaction.remark || transaction.status}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {new Date(transaction.date).toLocaleDateString()}
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
            {Math.min(endIndex, filteredTransactions.length)} of{" "}
            {filteredTransactions.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || totalPages === 0}
              className={`p-2 border border-neutral-300 rounded ${currentPage === 1 || totalPages === 0
                ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                : "text-neutral-700 hover:bg-neutral-50"
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
              className={`p-2 border border-neutral-300 rounded ${currentPage === totalPages || totalPages === 0
                ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                : "text-neutral-700 hover:bg-neutral-50"
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

      {/* Fund Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-neutral-800">Fund Transfer</h2>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleFundTransfer} className="p-4 space-y-4">
              {transferError && (
                <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
                  {transferError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Selected Seller
                </label>
                <input
                  type="text"
                  disabled
                  value={sellers.find(s => s._id === selectedSeller)?.sellerName || ""}
                  className="w-full px-3 py-2 bg-neutral-100 border border-neutral-300 rounded text-sm text-neutral-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Transfer Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferType}
                  onChange={(e) => setTransferType(e.target.value as "Credit" | "Debit")}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="Credit">Credit (Add to Wallet)</option>
                  <option value="Debit">Debit (Deduct from Wallet)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Remark <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={transferRemark}
                  onChange={(e) => setTransferRemark(e.target.value)}
                  placeholder="Reason for transfer..."
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 py-2 px-4 border border-neutral-300 rounded text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="flex-1 py-2 px-4 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                >
                  {isTransferring ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Submit Transfer"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

