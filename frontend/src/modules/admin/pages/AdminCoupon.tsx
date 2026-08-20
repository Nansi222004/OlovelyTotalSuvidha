import { useState, useEffect } from "react";
import { uploadImage } from "../../../services/api/uploadService";
import {
  validateImageFile,
  createImagePreview,
  compressImage,
} from "../../../utils/imageUpload";
import {
  getCoupons,
  createCoupon,
  deleteCoupon,
  type Coupon,
} from "../../../services/api/admin/adminCouponService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import ConfirmationModal from "../../../components/ConfirmationModal";

export default function AdminCoupon() {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    userType: "",
    numberOfTimes: "Single Time Valid",
    couponImageUrl: "",
    couponExpiryDate: "",
    couponCode: "",
    couponTitle: "",
    couponStatus: "",
    couponMinOrderAmount: "",
    couponValue: "",
    couponType: "Percentage",
    couponDescription: "",
  });

  const [couponImageFile, setCouponImageFile] = useState<File | null>(null);
  const [couponImagePreview, setCouponImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch coupons from API
  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCoupons({ limit: 100 });
      if (response.success) {
        setCoupons(response.data);
      } else {
        setError("Failed to load coupons");
      }
    } catch (err) {
      console.error("Error fetching coupons:", err);
      setError("Failed to load coupons. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    fetchCoupons();
  }, [isAuthenticated, token]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid image file");
      return;
    }

    setCouponImageFile(file);
    setUploadError("");

    try {
      const preview = await createImagePreview(file);
      setCouponImagePreview(preview);
    } catch (error) {
      setUploadError("Failed to create image preview");
    }
  };

  const generateCouponCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, couponCode: code }));
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");

    // Validation
    if (
      !formData.userType ||
      !formData.couponTitle ||
      !formData.couponCode ||
      !formData.couponExpiryDate ||
      !formData.couponStatus ||
      !formData.couponMinOrderAmount ||
      !formData.couponValue ||
      !formData.couponDescription
    ) {
      setUploadError("Please fill in all required fields");
      return;
    }

    setUploading(true);

    try {
      let imageUrl = "";

      // Upload coupon image if provided
      if (couponImageFile) {
        const compressedFile = await compressImage(couponImageFile);
        const imageResult = await uploadImage(compressedFile, "olovely/coupons");
        imageUrl = imageResult.secureUrl;
      }

      // Create coupon via API
      const today = new Date().toISOString().split("T")[0];
      const couponData = {
        code: formData.couponCode.toUpperCase(),
        description: formData.couponDescription,
        discountType: formData.couponType === "Percentage" ? "Percentage" as const : "Fixed" as const,
        discountValue: parseFloat(formData.couponValue),
        minimumPurchase: parseFloat(formData.couponMinOrderAmount),
        startDate: today,
        endDate: formData.couponExpiryDate,
        usageLimit: formData.numberOfTimes === "Single Time Valid" ? 1 : undefined,
        applicableTo: formData.userType === "All Users" ? "All" as const : "All" as const,
      };

      const response = await createCoupon(couponData);

      if (response.success) {
        // Refresh the list
        fetchCoupons();

        // Reset form
        setFormData({
          userType: "",
          numberOfTimes: "Single Time Valid",
          couponImageUrl: "",
          couponExpiryDate: "",
          couponCode: "",
          couponTitle: "",
          couponStatus: "",
          couponMinOrderAmount: "",
          couponValue: "",
          couponType: "Percentage",
          couponDescription: "",
        });
        setCouponImageFile(null);
        setCouponImagePreview("");
      } else {
        setUploadError("Failed to create coupon");
      }
    } catch (error: any) {
      setUploadError(
        error.response?.data?.message ||
        error.message ||
        "Failed to create coupon. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await deleteCoupon(deleteId);
      if (response.success) {
        setCoupons(coupons.filter((coupon) => coupon._id !== deleteId));
        showToast("Coupon deleted successfully!", "success");
        setDeleteId(null);
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || "Failed to delete coupon", "error");
      setDeleteId(null);
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => (
    <span className="text-neutral-400 text-xs ml-1">
      {sortColumn === column ? (sortDirection === "asc" ? "â†‘" : "â†“") : "â‡…"}
    </span>
  );

  // Sort coupons
  let sortedCoupons = [...coupons];
  if (sortColumn) {
    sortedCoupons = [...sortedCoupons].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "code":
          aValue = a.code;
          bValue = b.code;
          break;
        case "discountValue":
          aValue = a.discountValue;
          bValue = b.discountValue;
          break;
        case "endDate":
          aValue = a.endDate;
          bValue = b.endDate;
          break;
        case "isActive":
          aValue = a.isActive ? 1 : 0;
          bValue = b.isActive ? 1 : 0;
          break;
        case "minimumPurchase":
          aValue = a.minimumPurchase || 0;
          bValue = b.minimumPurchase || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(sortedCoupons.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const displayedCoupons = sortedCoupons.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Page Content */}
      <div className="flex-1 p-6">
        {/* Header with Title and Breadcrumb */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800">Coupon</h1>
          <div className="text-sm">
            <span className="text-blue-600 hover:underline cursor-pointer">
              Home
            </span>
            <span className="text-neutral-400 mx-1">/</span>
            <span className="text-neutral-600">Coupon</span>
          </div>
        </div>

        {/* Add Coupon Section */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 mb-6">
          <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
            <h2 className="text-lg font-semibold">Add Coupon</h2>
          </div>

          <form onSubmit={handleAddCoupon} className="p-6">
            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {uploadError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Row 1 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select User Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="userType"
                  value={formData.userType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                  disabled={uploading}>
                  <option value="">Select User Type</option>
                  <option value="All Users">All Users</option>
                  <option value="Specific User">Specific User</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Number of Times <span className="text-red-500">*</span>
                </label>
                <select
                  name="numberOfTimes"
                  value={formData.numberOfTimes}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                  disabled={uploading}>
                  <option value="Single Time Valid">Single Time Valid</option>
                  <option value="Multi Time Valid">Multi Time Valid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Coupon Image
                </label>
                <label className="block border-2 border-dashed border-neutral-300 rounded-lg p-4 text-center cursor-pointer hover:border-teal-500 transition-colors">
                  {couponImagePreview ? (
                    <div className="space-y-2">
                      <img
                        src={couponImagePreview}
                        alt="Coupon preview"
                        className="max-h-24 mx-auto rounded-lg object-cover"
                      />
                      <p className="text-xs text-neutral-600">
                        {couponImageFile?.name}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setCouponImageFile(null);
                          setCouponImagePreview("");
                        }}
                        className="text-xs text-red-600 hover:text-red-700">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="mx-auto mb-2 text-neutral-400">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <p className="text-xs text-neutral-600">Choose File</p>
                      <p className="text-xs text-neutral-500 mt-1">Max 50MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Row 2 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Coupon Expiry Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    name="couponExpiryDate"
                    value={formData.couponExpiryDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Coupon Code <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="couponCode"
                    value={formData.couponCode}
                    onChange={handleInputChange}
                    required
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    placeholder="Enter coupon code"
                  />
                  <button
                    type="button"
                    onClick={generateCouponCode}
                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors"
                    title="Generate Code">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Coupon title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="couponTitle"
                  value={formData.couponTitle}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="Enter coupon title"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* Row 3 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Coupon Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="couponStatus"
                  value={formData.couponStatus}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white">
                  <option value="">Select Coupon Status</option>
                  <option value="Published">Published</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Coupon Min Order Amount{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="couponMinOrderAmount"
                  value={formData.couponMinOrderAmount}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="Enter min order amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Coupon Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="couponValue"
                  value={formData.couponValue}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="Enter coupon value"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Coupon Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="couponType"
                  value={formData.couponType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white">
                  <option value="Percentage">Percentage</option>
                  <option value="Fixed">Fixed</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              {/* Row 4 */}
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Coupon Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="couponDescription"
                value={formData.couponDescription}
                onChange={handleInputChange}
                required
                rows={4}
                className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                placeholder="Enter coupon description"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className={`w-full px-6 py-3 rounded font-medium transition-colors ${uploading
                ? "bg-neutral-400 cursor-not-allowed text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
                }`}>
              {uploading ? "Creating Coupon..." : "Add Coupon"}
            </button>
          </form>
        </div>

        {/* View Coupon Section */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-800">
              View Coupon
            </h2>
          </div>

          {/* Controls */}
          <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
              <span className="text-sm text-neutral-600">entries</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
                  <th className="p-4">Sr No.</th>
                  <th
                    className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("code")}>
                    <div className="flex items-center">
                      Coupon Code <SortIcon column="code" />
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("discountValue")}>
                    <div className="flex items-center">
                      Discount <SortIcon column="discountValue" />
                    </div>
                  </th>
                  <th className="p-4">Discount Type</th>
                  <th
                    className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("minimumPurchase")}>
                    <div className="flex items-center">
                      Min Purchase <SortIcon column="minimumPurchase" />
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("endDate")}>
                    <div className="flex items-center">
                      Expiry Date <SortIcon column="endDate" />
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("isActive")}>
                    <div className="flex items-center">
                      Status <SortIcon column="isActive" />
                    </div>
                  </th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-neutral-400">
                      Loading coupons...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : displayedCoupons.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-neutral-400">
                      No coupons found. Add your first coupon above.
                    </td>
                  </tr>
                ) : (
                  displayedCoupons.map((coupon, index) => (
                    <tr
                      key={coupon._id}
                      className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200">
                      <td className="p-4 align-middle">
                        {startIndex + index + 1}
                      </td>
                      <td className="p-4 align-middle font-medium">
                        {coupon.code}
                      </td>
                      <td className="p-4 align-middle">
                        {coupon.discountType === "Percentage"
                          ? `${coupon.discountValue}%`
                          : `₹${coupon.discountValue}`}
                      </td>
                      <td className="p-4 align-middle">{coupon.discountType}</td>
                      <td className="p-4 align-middle">
                        {coupon.minimumPurchase
                          ? `₹${coupon.minimumPurchase}`
                          : "N/A"}
                      </td>
                      <td className="p-4 align-middle">
                        {new Date(coupon.endDate).toLocaleDateString()}
                      </td>
                      <td className="p-4 align-middle">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${coupon.isActive
                            ? "bg-teal-100 text-teal-800"
                            : "bg-gray-100 text-gray-800"
                            }`}>
                          {coupon.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <button
                          onClick={() => setDeleteId(coupon._id)}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
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
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <div className="text-xs sm:text-sm text-neutral-700">
              Showing {sortedCoupons.length === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(endIndex, sortedCoupons.length)} of{" "}
              {sortedCoupons.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                disabled={currentPage === totalPages || totalPages === 0}
                className={`p-2 border border-teal-600 rounded ${currentPage === totalPages || totalPages === 0
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

      {/* Footer */}
      <footer className="text-center py-4 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
        Copyright © 2025. Developed By{" "}
        <a href="#" className="text-blue-600 hover:underline">
          Olovely Total Suvidha
        </a>
      </footer>

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Coupon"
        message="Are you sure you want to delete this coupon?"
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

