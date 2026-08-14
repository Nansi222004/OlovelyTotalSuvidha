import { useState, useEffect } from "react";
import {
  getPromoStrips,
  createPromoStrip,
  updatePromoStrip,
  deletePromoStrip,
  type PromoStrip,
  type PromoStripFormData,
  type CategoryCard,
} from "../../../services/api/admin/adminPromoStripService";
import { getCategories, type Category } from "../../../services/api/categoryService";
import { getHeaderCategoriesAdmin, type HeaderCategory } from "../../../services/api/headerCategoryService";
import { getProducts as getAdminProducts, type Product } from "../../../services/api/admin/adminProductService";

export default function AdminPromoStrip() {
  // Form state
  const [headerCategorySlug, setHeaderCategorySlug] = useState("");
  const [heading, setHeading] = useState("");
  const [saleText, setSaleText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<string[]>([]);
  const [crazyDealsTitle, setCrazyDealsTitle] = useState("CRAZY DEALS");
  const [isActive, setIsActive] = useState(true);
  const [order, setOrder] = useState(0);

  // Data state
  const [promoStrips, setPromoStrips] = useState<PromoStrip[]>([]);
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingPromoStrips, setLoadingPromoStrips] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch initial data
  useEffect(() => {
    fetchPromoStrips();
    fetchHeaderCategories();
    fetchCategories();
  }, []);

  // Fetch products when search changes
  useEffect(() => {
    if (productSearch.length > 2) {
      const timeoutId = setTimeout(() => {
        fetchProducts(productSearch);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (productSearch.length === 0) {
      // Load initial products when search is cleared
      fetchProducts("");
    } else {
      setProducts([]);
    }
  }, [productSearch]);

  const fetchPromoStrips = async () => {
    try {
      setLoadingPromoStrips(true);
      const data = await getPromoStrips();
      setPromoStrips(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch PromoStrips");
    } finally {
      setLoadingPromoStrips(false);
    }
  };

  const fetchHeaderCategories = async () => {
    try {
      const data = await getHeaderCategoriesAdmin();
      setHeaderCategories(data);
    } catch (err: any) {
      console.error("Failed to fetch header categories:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await getCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch categories:", err);
      setCategories([]);
    }
  };

  const fetchProducts = async (search: string) => {
    try {
      const response = await getAdminProducts({ search, limit: 20 });
      if (response.success && response.data) {
        // Admin products API returns data directly as array
        setProducts(Array.isArray(response.data) ? response.data : []);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch products:", err);
      setProducts([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!headerCategorySlug || !heading || !saleText || !startDate || !endDate) {
      setError("Please fill in all required fields");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setError("End date must be after start date");
      return;
    }

    // Validate at least 4 featured products for carousel
    if (featuredProducts.length < 4) {
      setError("Please select at least 4 products for the CRAZY DEALS carousel section");
      return;
    }

    const formData: PromoStripFormData = {
      headerCategorySlug,
      heading,
      saleText,
      startDate,
      endDate,
      categoryCards: categoryCards.map((card) => ({
        categoryId: card.categoryId,
        title: card.title,
        badge: card.badge,
        discountPercentage: card.discountPercentage,
        order: card.order,
      })),
      featuredProducts,
      isActive,
      order,
    };

    try {
      setLoading(true);

      if (editingId) {
        await updatePromoStrip(editingId, formData);
        setSuccess("PromoStrip updated successfully!");
        resetForm();
        fetchPromoStrips();
      } else {
        await createPromoStrip(formData);
        setSuccess("PromoStrip created successfully!");
        resetForm();
        fetchPromoStrips();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save PromoStrip");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (promoStrip: PromoStrip) => {
    setHeaderCategorySlug(promoStrip.headerCategorySlug);
    setHeading(promoStrip.heading);
    setSaleText(promoStrip.saleText);
    setStartDate(promoStrip.startDate.split("T")[0]);
    setEndDate(promoStrip.endDate.split("T")[0]);
    setCategoryCards(
      promoStrip.categoryCards.map((card) => {
        const categoryIdValue = typeof card.categoryId === "string"
          ? card.categoryId
          : (card.categoryId as any)?._id || card.categoryId;
        const categoryObj = typeof card.categoryId === "object" ? card.categoryId as any : null;
        return {
          categoryId: categoryIdValue,
          title: categoryObj?.name || card.title || "",
          badge: card.badge || "",
          discountPercentage: card.discountPercentage || 0,
          order: card.order || 0,
          _id: card._id,
        };
      })
    );
    setFeaturedProducts(
      promoStrip.featuredProducts.map((p) => {
        if (typeof p === "string") {
          return p;
        }
        return (p as any)?._id || p;
      })
    );
    setCrazyDealsTitle(promoStrip.crazyDealsTitle || "CRAZY DEALS");
    setIsActive(promoStrip.isActive);
    setOrder(promoStrip.order);
    setEditingId(promoStrip._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this PromoStrip?")) {
      return;
    }

    try {
      await deletePromoStrip(id);
      setSuccess("PromoStrip deleted successfully!");
      fetchPromoStrips();
      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete PromoStrip");
    }
  };

  const resetForm = () => {
    setHeaderCategorySlug("");
    setHeading("");
    setSaleText("");
    setStartDate("");
    setEndDate("");
    setCategoryCards([]);
    setFeaturedProducts([]);
    setCrazyDealsTitle("CRAZY DEALS");
    setIsActive(true);
    setOrder(0);
    setEditingId(null);
  };

  const addCategoryCard = () => {
    setCategoryCards([
      ...categoryCards,
      {
        categoryId: "",
        title: "",
        badge: "",
        discountPercentage: 0,
        order: categoryCards.length,
      },
    ]);
  };

  const updateCategoryCard = (index: number, field: keyof CategoryCard, value: any) => {
    const updated = [...categoryCards];
    // Ensure categoryId is always a string when setting it
    if (field === 'categoryId' && typeof value !== 'string') {
      value = typeof value === 'object' && value?._id ? value._id : String(value);
    }
    updated[index] = { ...updated[index], [field]: value };
    setCategoryCards(updated);
  };

  const removeCategoryCard = (index: number) => {
    setCategoryCards(categoryCards.filter((_, i) => i !== index));
  };

  const addFeaturedProduct = (productId: string) => {
    if (!featuredProducts.includes(productId)) {
      setFeaturedProducts([...featuredProducts, productId]);
    }
    setProductSearch("");
    setProducts([]);
  };

  const removeFeaturedProduct = (productId: string) => {
    setFeaturedProducts(featuredProducts.filter((id) => id !== productId));
  };

  // Pagination
  const totalPages = Math.ceil(promoStrips.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const displayedPromoStrips = promoStrips.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Page Header */}
      <div className="p-6 pb-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800">Promo Strips</h1>
          <div className="text-sm text-blue-500">
            <span className="text-blue-500 hover:underline cursor-pointer">Home</span>{" "}
            <span className="text-neutral-400">/</span> Promo Strips
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {(success || error) && (
        <div className="px-6">
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Page Content */}
      <div className="flex-1 px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left Sidebar: Add/Edit Form */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-neutral-800 mb-4">
              {editingId ? "Edit PromoStrip" : "Add PromoStrip"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto">
              {/* Header Category Slug */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Header Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={headerCategorySlug}
                  onChange={(e) => setHeaderCategorySlug(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  required
                >
                  <option value="">Select header category</option>
                  <option value="all">All</option>
                  {headerCategories
                    .filter((hc) => hc.status === "Published")
                    .map((hc) => (
                      <option key={hc._id} value={hc.slug}>
                        {hc.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Heading */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Heading <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  placeholder="e.g., HOUSEFULL SALE"
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  required
                />
              </div>

              {/* Sale Text */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Sale Text <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={saleText}
                  onChange={(e) => setSaleText(e.target.value)}
                  placeholder="e.g., SALE"
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  required
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Category Cards */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Category Cards
                  </label>
                  <button
                    type="button"
                    onClick={addCategoryCard}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    + Add Card
                  </button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {categoryCards.map((card, index) => (
                    <div key={index} className="border border-neutral-200 rounded p-3 bg-neutral-50">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium text-neutral-600">Card {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeCategoryCard(index)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                        <select
                          value={typeof card.categoryId === 'string' ? card.categoryId : (card.categoryId as any)?._id || ''}
                          onChange={(e) => updateCategoryCard(index, "categoryId", e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-neutral-300 rounded bg-white"
                          required
                        >
                          <option value="">Select category</option>
                          {Array.isArray(categories) && categories.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={card.title}
                          onChange={(e) => updateCategoryCard(index, "title", e.target.value)}
                          placeholder="Custom title"
                          className="w-full px-2 py-1 text-sm border border-neutral-300 rounded bg-white"
                        />
                        <input
                          type="text"
                          value={card.badge}
                          onChange={(e) => updateCategoryCard(index, "badge", e.target.value)}
                          placeholder="Badge (e.g., Up to 55% OFF)"
                          className="w-full px-2 py-1 text-sm border border-neutral-300 rounded bg-white"
                          required
                        />
                        <input
                          type="number"
                          value={card.discountPercentage}
                          onChange={(e) => updateCategoryCard(index, "discountPercentage", parseFloat(e.target.value) || 0)}
                          placeholder="Discount %"
                          min="0"
                          max="100"
                          className="w-full px-2 py-1 text-sm border border-neutral-300 rounded bg-white"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CRAZY DEALS Title */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  CRAZY DEALS Title
                </label>
                <input
                  type="text"
                  value={crazyDealsTitle}
                  onChange={(e) => setCrazyDealsTitle(e.target.value)}
                  placeholder="e.g., CRAZY DEALS, SPECIAL OFFERS"
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Custom title for the featured products section (default: "CRAZY DEALS")
                </p>
              </div>

              {/* Featured Products */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Featured Products <span className="text-red-500">*</span>
                  <span className="text-xs text-neutral-500 font-normal ml-2">
                    (Minimum 4 required for carousel)
                  </span>
                </label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products (type at least 3 characters)..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none mb-2"
                />
                {productSearch.length > 0 && productSearch.length < 3 && (
                  <p className="text-xs text-neutral-500 mb-2">Type at least 3 characters to search</p>
                )}
                {products.length > 0 && (
                  <div className="border border-neutral-300 rounded max-h-40 overflow-y-auto mb-2">
                    {products.map((product) => (
                      <div
                        key={product._id}
                        onClick={() => addFeaturedProduct(product._id)}
                        className="p-2 hover:bg-neutral-50 cursor-pointer text-sm"
                      >
                        {product.productName}
                      </div>
                    ))}
                  </div>
                )}
                {productSearch.length >= 3 && products.length === 0 && (
                  <p className="text-xs text-neutral-500 mb-2">No products found</p>
                )}
                <div className="flex flex-wrap gap-2 mb-2">
                  {featuredProducts.map((productId) => {
                    const product = products.find((p) => p._id === productId);
                    return (
                      <div
                        key={productId}
                        className="flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-1 rounded text-sm"
                      >
                        <span>{product?.productName || productId}</span>
                        <button
                          type="button"
                          onClick={() => removeFeaturedProduct(productId)}
                          className="text-teal-700 hover:text-teal-900"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${
                    featuredProducts.length >= 4 ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {featuredProducts.length} / 4 products selected
                  </span>
                  {featuredProducts.length < 4 && (
                    <span className="text-xs text-orange-600">
                      (Need {4 - featuredProducts.length} more)
                    </span>
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-neutral-700">
                  Active
                </label>
              </div>

              {/* Order */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Order</label>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-neutral-300 rounded text-neutral-700 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right Side: List */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-neutral-800">Promo Strips List</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600">Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-neutral-300 rounded text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {loadingPromoStrips ? (
              <div className="text-center py-8 text-neutral-500">Loading...</div>
            ) : displayedPromoStrips.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">No PromoStrips found</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-2 px-3 text-sm font-medium text-neutral-700">Header Category</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-neutral-700">Heading</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-neutral-700">Date Range</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-neutral-700">Status</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-neutral-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPromoStrips.map((promoStrip) => (
                        <tr key={promoStrip._id} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="py-2 px-3 text-sm text-neutral-700">{promoStrip.headerCategorySlug}</td>
                          <td className="py-2 px-3 text-sm text-neutral-700">{promoStrip.heading}</td>
                          <td className="py-2 px-3 text-sm text-neutral-700">
                            {new Date(promoStrip.startDate).toLocaleDateString()} - {new Date(promoStrip.endDate).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                promoStrip.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {promoStrip.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(promoStrip)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(promoStrip._id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-neutral-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, promoStrips.length)} of {promoStrips.length} entries
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-neutral-300 rounded text-sm disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-neutral-300 rounded text-sm disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

