import { useState, useEffect, useRef } from "react";
import {
  getBanners,
  createBanner,
  updateBanner,
  toggleBanner,
  deleteBanner,
  type Banner,
  type BannerFormData,
} from "../../../services/api/admin/adminBannerService";
import { uploadImage } from "../../../services/api/uploadService";
import ConfirmationModal from "../../../components/ConfirmationModal";

const SECTION_OPTIONS = [
  { value: "ALL", label: "All Sections", icon: "🌐" },
  { value: "QUICK_COMMERCE", label: "Quick Commerce", icon: "⚡" },
  { value: "ECOMMERCE", label: "Ecommerce", icon: "📦" },
  { value: "WHOLESALE", label: "Wholesale", icon: "🏷️" },
];

const TARGET_OPTIONS = [
  { value: "NONE", label: "No Target (Informational)" },
  { value: "CATEGORY", label: "Category Link" },
  { value: "PRODUCT", label: "Product Link" },
  { value: "URL", label: "External URL" },
];

const SECTION_BADGES: Record<string, { label: string; icon: string; className: string }> = {
  ALL: {
    label: "All Sections",
    icon: "🌐",
    className: "bg-purple-50 text-purple-700 border border-purple-200",
  },
  QUICK_COMMERCE: {
    label: "Quick Commerce",
    icon: "⚡",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  ECOMMERCE: {
    label: "Ecommerce",
    icon: "📦",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  WHOLESALE: {
    label: "Wholesale",
    icon: "🏷️",
    className: "bg-amber-50 text-amber-800 border border-amber-200",
  },
};

const defaultForm: BannerFormData = {
  title: "",
  subtitle: "",
  imageUrl: "",
  mobileImageUrl: "",
  commerceSection: "QUICK_COMMERCE",
  targetType: "NONE",
  targetId: "",
  ctaText: "",
  isActive: true,
  startDate: "",
  endDate: "",
  priority: 0,
};

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [filterSection, setFilterSection] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("all");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerFormData>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  // Upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingMobileImage, setUploadingMobileImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 15;

  useEffect(() => {
    fetchBanners();
  }, [page, filterSection, filterActive]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, limit: LIMIT };
      if (filterSection) params.section = filterSection;
      if (filterActive !== "all") params.isActive = filterActive === "active";
      const data = await getBanners(params);
      setBanners(data.data || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isMobile = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file (PNG, JPG, WEBP, etc.)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    try {
      setError("");
      if (isMobile) {
        setUploadingMobileImage(true);
      } else {
        setUploadingImage(true);
      }

      const result = await uploadImage(file, "banners");
      const finalUrl = result.secureUrl || result.url;

      setForm((prev) => ({
        ...prev,
        [isMobile ? "mobileImageUrl" : "imageUrl"]: finalUrl,
      }));
      setSuccess(`${isMobile ? "Mobile image" : "Banner image"} uploaded successfully!`);
    } catch (uploadErr: any) {
      setError(uploadErr.message || "Failed to upload image. You can also paste an image URL directly.");
    } finally {
      if (isMobile) {
        setUploadingMobileImage(false);
        if (mobileFileInputRef.current) mobileFileInputRef.current.value = "";
      } else {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Banner title is required");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      if (editingId) {
        await updateBanner(editingId, form);
        setSuccess("Banner updated successfully");
      } else {
        await createBanner(form);
        setSuccess("Banner created successfully");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(defaultForm);
      fetchBanners();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save banner");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (banner: Banner) => {
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      imageUrl: banner.imageUrl || "",
      mobileImageUrl: banner.mobileImageUrl || "",
      commerceSection: banner.commerceSection,
      targetType: banner.targetType,
      targetId: banner.targetId || "",
      ctaText: banner.ctaText || "",
      isActive: banner.isActive,
      startDate: banner.startDate ? banner.startDate.slice(0, 16) : "",
      endDate: banner.endDate ? banner.endDate.slice(0, 16) : "",
      priority: banner.priority,
    });
    setEditingId(banner._id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleBanner(id);
      setSuccess("Banner status updated");
      fetchBanners();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to toggle banner");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBanner(deleteId);
      setSuccess("Banner deleted");
      setDeleteId(null);
      fetchBanners();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete banner");
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(defaultForm);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Promotional Banners</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage promotional banners displayed on the customer app home screen & commerce mode swiper
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm(defaultForm);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Banner
          </button>
        </div>

        {/* Alerts */}
        {success && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{success}</span>
            <button onClick={() => setSuccess("")} className="ml-auto text-green-600 hover:text-green-800 font-bold">
              ✕
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-red-600 hover:text-red-800 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Banner Create / Edit Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-md mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h2 className="text-base font-semibold text-gray-800">
                  {editingId ? "Edit Promotional Banner" : "Create New Promotional Banner"}
                </h2>
              </div>
              <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* Commerce Mode Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Shopping Commerce Mode <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SECTION_OPTIONS.map((s) => {
                    const isSelected = form.commerceSection === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, commerceSection: s.value as any }))}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm ring-2 ring-indigo-500/20"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-xl mb-1">{s.icon}</span>
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Select which commerce channel / shopping mode this promotional banner belongs to.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Banner Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Quick Commerce / Everyday Essentials / Bulk Savings"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Subtitle */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle / Tagline</label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                    placeholder="e.g. Everyday essentials delivered quickly in 10-30 mins"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Desktop Image Upload & URL */}
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Banner Image (Desktop / Main)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, false)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <>
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          <span>Uploading image...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                          <span>Upload Image File</span>
                        </>
                      )}
                    </button>
                    {form.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                        className="px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="Or paste image URL (https://...)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {form.imageUrl && (
                    <div className="mt-2 relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50 max-h-36">
                      <img
                        src={form.imageUrl}
                        alt="Desktop Preview"
                        className="w-full h-32 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "0.3";
                        }}
                      />
                      <span className="absolute bottom-1 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                        Main Image
                      </span>
                    </div>
                  )}
                </div>

                {/* Mobile Image Upload & URL */}
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Image (Optional)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      ref={mobileFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, true)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingMobileImage}
                      onClick={() => mobileFileInputRef.current?.click()}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {uploadingMobileImage ? (
                        <>
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          <span>Uploading mobile...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          <span>Upload Mobile Image</span>
                        </>
                      )}
                    </button>
                    {form.mobileImageUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, mobileImageUrl: "" }))}
                        className="px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={form.mobileImageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, mobileImageUrl: e.target.value }))}
                    placeholder="Or paste mobile image URL (https://...)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {form.mobileImageUrl && (
                    <div className="mt-2 relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50 max-h-36">
                      <img
                        src={form.mobileImageUrl}
                        alt="Mobile Preview"
                        className="w-full h-32 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "0.3";
                        }}
                      />
                      <span className="absolute bottom-1 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                        Mobile
                      </span>
                    </div>
                  )}
                </div>

                {/* CTA Button Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={form.ctaText}
                    onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))}
                    placeholder="e.g. Shop Quick Commerce / Explore Ecommerce / Shop Wholesale"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority <span className="text-gray-400 text-xs">(higher = shown first)</span>
                  </label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Target Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link Target Type</label>
                  <select
                    value={form.targetType}
                    onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {TARGET_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target ID */}
                {form.targetType !== "NONE" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {form.targetType === "URL" ? "Destination URL" : `${form.targetType} ID`}
                    </label>
                    <input
                      type="text"
                      value={form.targetId}
                      onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))}
                      placeholder={form.targetType === "URL" ? "https://..." : "MongoDB ID"}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Is Active */}
                <div className="flex items-center gap-3 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-2 text-sm font-medium text-gray-700">Active (Visible to customers)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage || uploadingMobileImage}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  {submitting ? "Saving..." : editingId ? "Update Banner" : "Create Banner"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Commerce Mode Filter Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 p-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-xs font-semibold text-gray-500 mr-1.5 uppercase tracking-wider">
              Commerce Mode:
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterSection("");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterSection === ""
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Modes
            </button>
            {SECTION_OPTIONS.slice(1).map((s) => {
              const isSelected = filterSection === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    setFilterSection(s.value);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={filterActive}
              onChange={(e) => {
                setFilterActive(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <span className="text-xs text-gray-400 font-medium">({banners.length} banners)</span>
          </div>
        </div>

        {/* Banners Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : banners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="font-medium text-gray-700">No promotional banners found</p>
              <p className="text-xs text-gray-400 mt-1">
                {filterSection
                  ? `No banners found for ${SECTION_BADGES[filterSection]?.label || filterSection}. Create one!`
                  : "Create a promotional banner to get started."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Preview</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Title & Messaging</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Commerce Mode</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Priority</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Schedule</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {banners.map((banner) => {
                    const badge = SECTION_BADGES[banner.commerceSection] || SECTION_BADGES.ALL;
                    return (
                      <tr key={banner._id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3">
                          {banner.imageUrl ? (
                            <img
                              src={banner.imageUrl}
                              alt={banner.title}
                              className="w-16 h-10 object-cover rounded-lg border border-gray-200 shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://via.placeholder.com/64x40?text=IMG";
                              }}
                            />
                          ) : (
                            <div className="w-16 h-10 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                              No Image
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">{banner.title}</p>
                            {banner.subtitle && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{banner.subtitle}</p>
                            )}
                            {banner.ctaText && (
                              <span className="inline-block mt-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                CTA: {banner.ctaText}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}
                          >
                            <span>{badge.icon}</span>
                            <span>{badge.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{banner.priority}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {banner.startDate || banner.endDate ? (
                            <div className="space-y-0.5">
                              {banner.startDate && (
                                <div>From: {new Date(banner.startDate).toLocaleDateString()}</div>
                              )}
                              {banner.endDate && (
                                <div>To: {new Date(banner.endDate).toLocaleDateString()}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Always active</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggle(banner._id)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                banner.isActive ? "bg-green-500" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                                  banner.isActive ? "translate-x-5" : "translate-x-1"
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs font-medium ${
                                banner.isActive ? "text-green-600" : "text-gray-400"
                              }`}
                            >
                              {banner.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(banner)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteId(banner._id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Promotional Banner"
        message="Are you sure you want to delete this banner? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
