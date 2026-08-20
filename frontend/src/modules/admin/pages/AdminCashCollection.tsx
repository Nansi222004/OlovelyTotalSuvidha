import { useState, useEffect } from "react";
import {
  getCashCollections,
  createCashCollection,
  confirmCashCollection,
  type CashCollection,
  type CreateCashCollectionData,
} from "../../../services/api/admin/adminDeliveryService";
import { getDeliveryBoys } from "../../../services/api/admin/adminDeliveryService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import ConfirmationModal from "../../../components/ConfirmationModal";

export default function AdminCashCollection() {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cashCollections, setCashCollections] = useState<CashCollection[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "Pending" | "Collected">("Pending");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add Cash Collection Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<CreateCashCollectionData>({
    deliveryBoyId: "",
    orderId: "",
    amount: 0,
    remark: "",
  });
  const [addError, setAddError] = useState<string | null>(null);

  // Fetch delivery boys and cash collections on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch delivery boys for the dropdown
        const deliveryBoysResponse = await getDeliveryBoys({
          status: "Active",
          limit: 100,
        });
        if (deliveryBoysResponse.success) {
          setDeliveryBoys(deliveryBoysResponse.data);
        }

        // Fetch cash collections
        const params: any = {
          page: currentPage,
          limit: entriesPerPage,
        };

        if (selectedDeliveryBoy !== "all") {
          params.deliveryBoyId = selectedDeliveryBoy;
        }

        if (selectedStatus !== "all") {
          params.status = selectedStatus;
        }

        if (fromDate) {
          params.fromDate = fromDate;
        }

        if (toDate) {
          params.toDate = toDate;
        }

        if (searchTerm) {
          params.search = searchTerm;
        }

        const cashResponse = await getCashCollections(params);

        if (cashResponse.success) {
          setCashCollections(cashResponse.data);
          // Use server-side pagination total
          if ((cashResponse as any).pagination?.total !== undefined) {
            setTotalEntries((cashResponse as any).pagination.total);
          } else {
            setTotalEntries(cashResponse.data.length);
          }
        } else {
          setError("Failed to load cash collections");
        }
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(
          err.response?.data?.message ||
          "Failed to load data. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    isAuthenticated,
    token,
    currentPage,
    entriesPerPage,
    selectedDeliveryBoy,
    selectedStatus,
    fromDate,
    toDate,
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

  const totalPages = Math.ceil(totalEntries / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = Math.min(startIndex + entriesPerPage, totalEntries);

  const handleAddCollection = () => {
    setAddForm({ deliveryBoyId: "", orderId: "", amount: 0, remark: "" });
    setAddError(null);
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.deliveryBoyId || !addForm.orderId || !addForm.amount) {
      setAddError("Delivery Boy, Order ID, and Amount are required.");
      return;
    }

    try {
      setSubmitting(true);
      setAddError(null);

      const response = await createCashCollection(addForm);
      if (response.success) {
        setShowAddModal(false);
        // Refresh the list
        setCurrentPage(1);
        setSelectedStatus("Collected"); // Switch to collected to see the new manual entry
      } else {
        setAddError("Failed to create cash collection. Please try again.");
      }
    } catch (err: any) {
      console.error("Error creating cash collection:", err);
      setAddError(
        err.response?.data?.message ||
        "Failed to create cash collection. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmAction = async () => {
    if (!confirmId) return;
    const id = confirmId;

    try {
      setLoading(true);
      const response = await confirmCashCollection(id);
      if (response.success) {
        showToast("Cash collection confirmed successfully!", "success");
        setConfirmId(null);
        // Refresh current view
        const params: any = {
          page: currentPage,
          limit: entriesPerPage,
          status: selectedStatus,
          deliveryBoyId: selectedDeliveryBoy !== "all" ? selectedDeliveryBoy : undefined
        };
        const refreshResponse = await getCashCollections(params);
        if (refreshResponse.success) {
          setCashCollections(refreshResponse.data);
          if ((refreshResponse as any).pagination?.total !== undefined) {
            setTotalEntries((refreshResponse as any).pagination.total);
          }
        }
      } else {
        showToast("Failed to confirm collection", "error");
        setConfirmId(null);
      }
    } catch (err: any) {
      console.error("Error confirming collection:", err);
      showToast(err.response?.data?.message || "Failed to confirm collection", "error");
      setConfirmId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "ID",
      "Delivery Boy",
      "Order ID",
      "Total",
      "Amount Collected",
      "Remark",
      "Status",
      "Date",
    ];
    const csvContent = [
      headers.join(","),
      ...cashCollections.map((collection) =>
        [
          collection._id.slice(-6),
          `"${collection.deliveryBoyName}"`,
          collection.orderId,
          collection.total.toFixed(2),
          collection.amount.toFixed(2),
          `"${collection.remark || ""}"`,
          collection.status,
          collection.collectedAt ? new Date(collection.collectedAt).toLocaleDateString() : 'N/A',
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `cash_collections_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearDate = () => {
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-teal-600 px-4 sm:px-6 py-4 rounded-t-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-white text-xl sm:text-2xl font-semibold">
          Delivery Boy Cash Collection List
        </h1>
        <button
          onClick={handleAddCollection}
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
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Manual Collection
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        {/* Filters */}
        <div className="p-4 sm:p-6 border-b border-neutral-200">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left Side Filters */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">
              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  Date:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[140px]"
                  />
                  <span className="text-neutral-500">-</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[140px]"
                  />
                  <button
                    onClick={handleClearDate}
                    className="px-3 py-2 bg-neutral-700 hover:bg-neutral-800 text-white rounded text-sm transition-colors">
                    Clear
                  </button>
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  Status:
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[130px]">
                  <option value="all">All Records</option>
                  <option value="Pending">Pending (Due)</option>
                  <option value="Collected">Collected (Paid)</option>
                </select>
              </div>

              {/* Delivery Boy Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  Delivery Boy:
                </label>
                <select
                  value={selectedDeliveryBoy}
                  onChange={(e) => {
                    setSelectedDeliveryBoy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[150px]">
                  <option value="all">All Delivery Boys</option>
                  {deliveryBoys.map((boy) => (
                    <option key={boy._id} value={boy._id}>
                      {boy.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Side Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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

              <button
                onClick={handleExport}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Export
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search order ID..."
                  className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[150px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading/Error States */}
        {loading && <div className="px-6 py-8 text-center text-sm text-neutral-500">Loading...</div>}
        {error && !loading && <div className="px-6 py-4 text-center text-sm text-red-600 bg-red-50">{error}</div>}

        {/* Table */}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Delivery Boy</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Remark</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {cashCollections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-neutral-500">
                      No {selectedStatus === 'Pending' ? 'pending' : ''} cash collection records found.
                    </td>
                  </tr>
                ) : (
                  cashCollections.map((collection) => (
                    <tr key={collection._id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm text-neutral-900 font-medium">
                        {collection.deliveryBoyName}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {collection.orderId}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900 font-semibold">
                        ₹{collection.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {collection.remark || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${collection.status === 'Pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                          }`}>
                          {collection.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {collection.status === 'Pending' ? (
                          <button
                            onClick={() => setConfirmId(collection._id)}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                          >
                            Mark Collected
                          </button>
                        ) : (
                          <span className="text-neutral-400 text-xs italic">
                            Confirmed at {collection.collectedAt ? new Date(collection.collectedAt).toLocaleDateString() : 'N/A'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-neutral-200 flex items-center justify-between">
          <div className="text-xs text-neutral-700">
            Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndex} of {totalEntries} entries
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 border rounded disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1 border rounded disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-neutral-800 text-white text-center text-sm py-4">
        Copyright © 2025. Olovely Total Suvidha
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-teal-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-white text-lg font-semibold">Add Manual Collection</h2>
              <button onClick={() => setShowAddModal(false)} className="text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {addError && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{addError}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Delivery Boy *</label>
                <select
                  className="w-full border rounded p-2 text-sm"
                  value={addForm.deliveryBoyId}
                  onChange={e => setAddForm({ ...addForm, deliveryBoyId: e.target.value })}
                  required
                >
                  <option value="">Select Delivery Boy</option>
                  {deliveryBoys.map(boy => <option key={boy._id} value={boy._id}>{boy.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Order ID *</label>
                <input
                  type="text" className="w-full border rounded p-2 text-sm"
                  value={addForm.orderId}
                  onChange={e => setAddForm({ ...addForm, orderId: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
                <input
                  type="number" className="w-full border rounded p-2 text-sm"
                  value={addForm.amount || ''}
                  onChange={e => setAddForm({ ...addForm, amount: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Remark</label>
                <textarea
                  className="w-full border rounded p-2 text-sm" rows={3}
                  value={addForm.remark}
                  onChange={e => setAddForm({ ...addForm, remark: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-teal-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-teal-700">
                  {submitting ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!confirmId}
        title="Confirm Cash Collection"
        message="Are you sure you have received this cash from the delivery boy?"
        confirmText="Confirm Received"
        isLoading={loading}
        onConfirm={confirmAction}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
