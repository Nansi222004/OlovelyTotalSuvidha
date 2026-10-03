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
import {
  getAppSettings,
  updateAppSettings,
} from "../../../services/api/admin/adminSettingsService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import ConfirmationModal from "../../../components/ConfirmationModal";
import { GSTIN_PATTERN, INDIAN_STATES, getStateByName, normalizeStateCode } from "../../../utils/indianStates";

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

  // Business GST & Billing Identity State (Centralized Admin/Platform settings)
  const [businessSettingsLoading, setBusinessSettingsLoading] = useState(false);
  const [businessSettingsSaving, setBusinessSettingsSaving] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyState, setCompanyState] = useState("");
  const [companyPincode, setCompanyPincode] = useState("");
  const [gstin, setGstin] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [gstRate, setGstRate] = useState<number | string>(18);
  const [gstEnabled, setGstEnabled] = useState(false);

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

  // Fetch centralized business settings (Admin GSTIN, company address, etc.)
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const fetchBusinessSettings = async () => {
      try {
        setBusinessSettingsLoading(true);
        const res = await getAppSettings();
        if (res?.success && res.data) {
          const d = res.data;
          setBusinessName(d.businessName || d.appName || "");
          setBusinessAddress(d.companyAddress || "");
          setCompanyCity(d.companyCity || "");
          setCompanyState(d.companyState || "");
          setCompanyPincode(d.companyPincode || "");
          setGstin(d.gstin || "");
          setStateCode(normalizeStateCode(d.stateCode));
          setGstRate(d.gstRate ?? 18);
          setGstEnabled(d.gstEnabled ?? false);
        }
      } catch (err) {
        console.error("Failed to load business GST settings:", err);
      } finally {
        setBusinessSettingsLoading(false);
      }
    };
    fetchBusinessSettings();
  }, [isAuthenticated, token]);

  const handleSaveBusinessSettings = async () => {
    const normalizedGstin = gstin.trim().toUpperCase();
    const selectedState = getStateByName(companyState);
    if (!businessName.trim()) {
      showToast("Business name is required", "error");
      return;
    }
    if (!selectedState || selectedState[0] !== stateCode) {
      showToast("Select a valid business state and matching state code", "error");
      return;
    }
    if (gstEnabled && (!normalizedGstin || !businessAddress.trim() || !/^\d{6}$/.test(companyPincode.trim()))) {
      showToast("GSTIN, registered business address, and a 6-digit pincode are required for GST billing", "error");
      return;
    }
    if (normalizedGstin && (!GSTIN_PATTERN.test(normalizedGstin) || normalizedGstin.slice(0, 2) !== stateCode)) {
      showToast("GSTIN is invalid or does not match the selected state", "error");
      return;
    }
    try {
      setBusinessSettingsSaving(true);
      const res = await updateAppSettings({
        businessName: businessName.trim(),
        companyAddress: businessAddress.trim(),
        companyCity: companyCity.trim(),
        companyState: companyState.trim(),
        companyPincode: companyPincode.trim(),
        gstin: normalizedGstin,
        stateCode: stateCode.trim(),
        gstRate: Number(gstRate) || 0,
        gstEnabled,
      });

      if (res?.success) {
        showToast("Business GST & Billing Identity saved successfully!", "success");
      } else {
        showToast(
          "Failed to save business settings: " + (res?.message || "Unknown error"),
          "error"
        );
      }
    } catch (err: any) {
      showToast(
        err.response?.data?.message || "Failed to save business settings",
        "error"
      );
    } finally {
      setBusinessSettingsSaving(false);
    }
  };

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
      {sortColumn === column ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
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
      <div className="flex-1 p-6 space-y-6">
        {/* SECTION 1: BUSINESS GST & BILLING IDENTITY */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-800 to-teal-700 text-white px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏢</span>
                <h2 className="text-lg font-bold tracking-tight">
                  Business GST & Billing Identity
                </h2>
              </div>
              <p className="text-xs text-teal-100 mt-0.5">
                Authoritative platform business details for customer invoices, tax compliance, and POS counter billing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase font-mono ${
                  gstin
                    ? "bg-teal-900/60 text-teal-100 border border-teal-500/50"
                    : "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                }`}
              >
                {gstin ? `GSTIN: ${gstin}` : "GSTIN Not Configured"}
              </span>
            </div>
          </div>

          <div className="p-6">
            {businessSettingsLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Business Legal Name
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Olovely Total Suvidha"
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Legal entity name displayed on invoices
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Business GSTIN
                    </label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="15-character GSTIN (optional)"
                      maxLength={15}
                      className="w-full px-3 py-2 text-sm font-mono tracking-wider border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none uppercase"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      15-character Goods & Services Tax Number
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Default Catalog GST Rate (%)
                    </label>
                    <input
                      type="number"
                      value={gstRate}
                      onChange={(e) => setGstRate(e.target.value)}
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="18"
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Fallback tax rate for products without specific slab
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={gstEnabled}
                        onChange={(e) => setGstEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
                      />
                      Enable GST billing and GST invoices
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Registered Business Address
                    </label>
                    <input
                      type="text"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      placeholder="e.g. Shop 12, Main Commercial Complex"
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={companyCity}
                      onChange={(e) => setCompanyCity(e.target.value)}
                      placeholder="e.g. Indore"
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Pincode
                    </label>
                    <input
                      type="text"
                      value={companyPincode}
                      onChange={(e) => setCompanyPincode(e.target.value)}
                      placeholder="e.g. 452001"
                      maxLength={6}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      State / Province
                    </label>
                    <select
                      value={companyState}
                      onChange={(e) => {
                        const selected = INDIAN_STATES.find(([, name]) => name === e.target.value);
                        setCompanyState(e.target.value);
                        setStateCode(selected?.[0] || "");
                      }}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map(([code, name]) => (
                        <option key={code} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      State Code
                    </label>
                    <input
                      type="text"
                      value={stateCode}
                      readOnly
                      placeholder="Auto-filled"
                      maxLength={2}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-mono"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      2-digit Indian GST State Code
                    </p>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleSaveBusinessSettings}
                      disabled={businessSettingsSaving}
                      className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-neutral-400 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      {businessSettingsSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <span>💾</span>
                          <span>Save Business Details</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: PRODUCT TAX SLABS */}
        <div>
          <div className="mb-3">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>🏷️</span> Product Tax Slabs (Catalog GST Percentages)
            </h3>
            <p className="text-xs text-gray-500">
              Configure product-level GST percentage slabs (e.g., 0%, 5%, 12%, 18%, 28%) selectable during product creation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

