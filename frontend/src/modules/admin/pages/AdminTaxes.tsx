import { useState, useEffect } from "react";
import {
  createTax,
  getTaxes,
  updateTax,
  deleteTax,
  updateTaxStatus,
  type Tax,
  type CreateTaxData,
  type UpdateTaxData,
} from "../../../services/api/admin/adminTaxService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import ConfirmationModal from "../../../components/ConfirmationModal";

export default function AdminTaxes() {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();
  const [taxTitle, setTaxTitle] = useState("");
  const [percentage, setPercentage] = useState("");
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalTaxes, setTotalTaxes] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch taxes on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchTaxes = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getTaxes({
          search: searchTerm,
          page: currentPage,
          limit: rowsPerPage,
          sortBy: sortColumn || undefined,
          sortOrder: sortDirection,
        });

        if (response.success) {
          setTaxes(response.data);
          if (response.pagination) {
            setTotalTaxes(response.pagination.total);
            setTotalPages(response.pagination.pages || 1);
          }
        } else {
          setError("Failed to load taxes");
        }
      } catch (err: any) {
        console.error("Error fetching taxes:", err);
        setError(
          err.response?.data?.message ||
          "Failed to load taxes. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTaxes();
  }, [
    isAuthenticated,
    token,
    searchTerm,
    currentPage,
    rowsPerPage,
    sortColumn,
    sortDirection,
  ]);

  // Note: Filtering is done server-side, so we just use the taxes as is
  const displayedTaxes = taxes;

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => (
    <span className="text-neutral-300 text-[10px]">
      {sortColumn === column ? (sortDirection === "asc" ? "â†‘" : "â†“") : "â‡…"}
    </span>
  );

  const handleAddTax = async () => {
    if (!taxTitle.trim() || !percentage.trim()) {
      showToast("Please fill in all fields", "info");
      return;
    }

    const percentageValue = parseFloat(percentage);
    if (
      isNaN(percentageValue) ||
      percentageValue < 0 ||
      percentageValue > 100
    ) {
      showToast("Please enter a valid percentage (0-100)", "info");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (editingTax) {
        // Update existing tax
        const updateData: UpdateTaxData = {
          name: taxTitle,
          percentage: percentageValue,
        };

        const response = await updateTax(editingTax._id, updateData);

        if (response.success) {
          // Update local state
          setTaxes(
            taxes.map((tax) =>
              tax._id === editingTax._id
                ? { ...tax, name: taxTitle, percentage: percentageValue }
                : tax
            )
          );
          showToast("Tax updated successfully!", "success");
          setEditingTax(null);
        } else {
          showToast(
            "Failed to update tax: " + (response.message || "Unknown error"),
            "error"
          );
        }
      } else {
        // Add new tax
        const taxData: CreateTaxData = {
          name: taxTitle,
          percentage: percentageValue,
        };

        const response = await createTax(taxData);

        if (response.success) {
          // Add to local state
          setTaxes([...taxes, response.data]);
          showToast("Tax added successfully!", "success");
        } else {
          showToast("Failed to add tax: " + (response.message || "Unknown error"), "error");
        }
      }

      // Reset form
      setTaxTitle("");
      setPercentage("");
    } catch (err: any) {
      console.error("Error saving tax:", err);
      showToast(
        "Failed to save tax: " +
        (err.response?.data?.message || "Please try again."),
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tax: Tax) => {
    setTaxTitle(tax.name);
    setPercentage(tax.percentage.toString());
    setEditingTax(tax);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;

    try {
      setSubmitting(true);
      const response = await deleteTax(id);

      if (response.success) {
        // Remove from local state
        setTaxes(taxes.filter((tax) => tax._id !== id));
        showToast("Tax deleted successfully!", "success");
        setDeleteId(null);

        // Reset form if editing this tax
        if (editingTax?._id === id) {
          setEditingTax(null);
          setTaxTitle("");
          setPercentage("");
        }
      } else {
        showToast("Failed to delete tax: " + (response.message || "Unknown error"), "error");
        setDeleteId(null);
      }
    } catch (err: any) {
      console.error("Error deleting tax:", err);
      showToast(
        "Failed to delete tax: " +
        (err.response?.data?.message || "Please try again."),
        "error"
      );
      setDeleteId(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    const headers = ["Sr No", "Tax Name", "Tax Percentage", "Status"];
    const csvContent = [
      headers.join(","),
      ...displayedTaxes.map((tax, index) =>
        [index + 1, `"${tax.name}"`, tax.percentage, tax.status].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `taxes_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Page Content */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left Panel: Add Tax */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-lg font-semibold">Add Tax</h2>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Tax Title
                  </label>
                  <input
                    type="text"
                    value={taxTitle}
                    onChange={(e) => setTaxTitle(e.target.value)}
                    placeholder="Enter Tax Title"
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Percentage
                  </label>
                  <input
                    type="number"
                    value={percentage}
                    onChange={(e) => setPercentage(e.target.value)}
                    placeholder="Enter Percentage"
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={handleAddTax}
                  disabled={submitting}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors flex items-center justify-center">
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingTax ? "Updating..." : "Adding..."}
                    </>
                  ) : editingTax ? (
                    "Update Tax"
                  ) : (
                    "Add Tax"
                  )}
                </button>
                {editingTax && (
                  <button
                    onClick={() => {
                      setEditingTax(null);
                      setTaxTitle("");
                      setPercentage("");
                    }}
                    className="w-full mt-2 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded font-medium transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: View Tax */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-lg font-semibold">View Tax</h2>
            </div>

            {/* Controls */}
            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600">Show</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={handleExport}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors">
                    Export
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-1">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                    Search:
                  </span>
                  <input
                    type="text"
                    className="pl-14 pr-3 py-1.5 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-teal-500 w-48"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder=""
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse border border-neutral-200">
                <thead>
                  <tr className="bg-neutral-50 text-xs font-bold text-neutral-800">
                    <th
                      className="p-4 w-16 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                      onClick={() => handleSort("id")}>
                      <div className="flex items-center justify-between">
                        Sr No <SortIcon column="id" />
                      </div>
                    </th>
                    <th
                      className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                      onClick={() => handleSort("name")}>
                      <div className="flex items-center justify-between">
                        Tax Name <SortIcon column="name" />
                      </div>
                    </th>
                    <th
                      className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                      onClick={() => handleSort("percentage")}>
                      <div className="flex items-center justify-between">
                        Tax Percentage <SortIcon column="percentage" />
                      </div>
                    </th>
                    <th
                      className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                      onClick={() => handleSort("status")}>
                      <div className="flex items-center justify-between">
                        Status <SortIcon column="status" />
                      </div>
                    </th>
                    <th className="p-4 border border-neutral-200">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-2"></div>
                          Loading taxes...
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-red-600">
                        {error}
                      </td>
                    </tr>
                  ) : displayedTaxes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-neutral-400 border border-neutral-200">
                        No taxes found.
                      </td>
                    </tr>
                  ) : (
                    displayedTaxes.map((tax, index) => (
                      <tr
                        key={tax._id}
                        className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700">
                        <td className="p-4 align-middle border border-neutral-200">
                          {startIndex + index + 1}
                        </td>
                        <td className="p-4 align-middle border border-neutral-200">
                          {tax.name}
                        </td>
                        <td className="p-4 align-middle border border-neutral-200">
                          {tax.percentage}%
                        </td>
                        <td className="p-4 align-middle border border-neutral-200">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tax.status === "Active"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                              }`}>
                            {tax.status}
                          </span>
                        </td>
                        <td className="p-4 align-middle border border-neutral-200">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(tax)}
                              disabled={submitting}
                              className="p-1.5 text-teal-600 hover:bg-teal-50 disabled:text-neutral-400 disabled:cursor-not-allowed rounded transition-colors"
                              title="Edit">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteId(tax._id)}
                              disabled={submitting}
                              className="p-1.5 text-red-600 hover:bg-red-50 disabled:text-neutral-400 disabled:cursor-not-allowed rounded transition-colors"
                              title="Delete">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
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
                Showing {totalTaxes > 0 ? startIndex + 1 : 0} to{" "}
                {Math.min(currentPage * rowsPerPage, totalTaxes)} of{" "}
                {totalTaxes} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className={`p-2 border border-teal-600 rounded ${currentPage === 1
                      ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                      : "text-teal-600 hover:bg-teal-50"
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
                <button className="px-3 py-1.5 border border-teal-600 bg-teal-600 text-white rounded font-medium text-sm">
                  {currentPage}
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`p-2 border border-teal-600 rounded ${currentPage === totalPages
                      ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                      : "text-teal-600 hover:bg-teal-50"
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
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
        Copyright © 2025. Developed By{" "}
        <a href="#" className="text-blue-600 hover:underline">
          Olovely Total Suvidha
        </a>
      </footer>

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Tax"
        message="Are you sure you want to delete this tax?"
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

