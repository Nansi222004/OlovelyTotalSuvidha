import { useState, useEffect } from "react";
import { uploadImage } from "../../../services/api/uploadService";
import {
  validateImageFile,
  createImagePreview,
  compressImage,
} from "../../../utils/imageUpload";
import { getProducts, getCategories, getBrands, getSellers, Product, Category, Brand, Seller } from "../../../services/api/admin/adminProductService";
import {
  getShopByStores,
  createShopByStore,
  updateShopByStore,
  deleteShopByStore,
  ShopByStore
} from "../../../services/api/admin/adminMiscService";
import ConfirmationModal from "../../../components/ConfirmationModal";

// Using ShopByStore from API service instead of local interface

export default function AdminShopByStore() {
  const [storeName, setStoreName] = useState("");
  const [storeImageFile, setStoreImageFile] = useState<File | null>(null);
  const [storeImagePreview, setStoreImagePreview] = useState<string>("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // New State for Selections - Now supports multiple selections
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");

  // Filter States
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterSubcategory, setFilterSubcategory] = useState<string>("");
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [filterSeller, setFilterSeller] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("Active");
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]); // Store all products for filtering
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);

  // Initialize with empty shops - using ShopByStore from API
  const [stores, setStores] = useState<ShopByStore[]>([]);

  // Fetch Initial Data (Stores, Products, Categories, Brands, Sellers)
  useEffect(() => {
    fetchStores();
    fetchProducts();
    fetchCategories();
    fetchBrands();
    fetchSellers();
  }, []);

  const fetchProducts = async () => {
    setLoadingData(true);
    try {
      // Fetch all products (status filtering will be done client-side)
      const params: any = {
        limit: 10000,
        page: 1,
      };

      const res = await getProducts(params);

      if (res.success && res.data) {
        const productList = Array.isArray(res.data) ? res.data : [];
        setAllProducts(productList);
        setProducts(productList);
      } else {
        setAllProducts([]);
        setProducts([]);
      }
    } catch (error) {
      console.error("Failed to fetch products", error);
      setAllProducts([]);
      setProducts([]);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await getCategories({ status: "Active" });
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  };

  const fetchBrands = async () => {
    try {
      const res = await getBrands();
      if (res.success && res.data) {
        setBrands(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch brands", error);
    }
  };

  const fetchSellers = async () => {
    try {
      const res = await getSellers();
      if (res.success && res.data) {
        setSellers(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch sellers", error);
    }
  };



  const fetchStores = async () => {
    setLoadingStores(true);
    try {
      const res = await getShopByStores();
      if (res.success && res.data) {
        setStores(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch stores", error);
      setUploadError("Failed to load stores. Please refresh the page.");
    } finally {
      setLoadingStores(false);
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

  const filteredStores = stores.filter(
    (store) =>
      String(store?.name || "").toLowerCase().includes(String(searchTerm || "").toLowerCase()) ||
      (store?.storeId && String(store.storeId).toLowerCase().includes(String(searchTerm || "").toLowerCase())) ||
      (store?._id && String(store._id).toLowerCase().includes(String(searchTerm || "").toLowerCase()))
  );

  // Sort stores
  const sortedStores = [...filteredStores].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "id":
        aValue = String(a?.storeId || a?._id || "").toLowerCase();
        bValue = String(b?.storeId || b?._id || "").toLowerCase();
        break;
      case "name":
        aValue = String(a?.name || "").toLowerCase();
        bValue = String(b?.name || "").toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedStores.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const displayedStores = sortedStores.slice(startIndex, endIndex);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid image file");
      return;
    }

    setStoreImageFile(file);
    setUploadError("");

    try {
      const preview = await createImagePreview(file);
      setStoreImagePreview(preview);
    } catch (error) {
      setUploadError("Failed to create image preview");
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleAddStore = async () => {
    if (!storeName.trim()) {
      setUploadError("Please enter a store name");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      let imageUrl = "";

      // Upload store image if provided
      if (storeImageFile) {
        const compressedFile = await compressImage(storeImageFile);
        const imageResult = await uploadImage(compressedFile, "olovely/stores");
        imageUrl = imageResult.secureUrl;
      } else if (editingId && !storeImagePreview) {
        // If editing and no new image and no preview, we need at least one image
        setUploadError("Store image is required");
        setUploading(false);
        return;
      }

      const storeData = {
        name: storeName.trim(),
        image: imageUrl || (editingId ? stores.find(s => s._id === editingId)?.image || "" : ""),
        description: "",
        products: selectedProductIds,
        order: stores.length,
        isActive: true,
      };

      if (editingId !== null) {
        // Update existing store
        const res = await updateShopByStore(editingId, storeData);
        if (res.success) {
          await fetchStores(); // Refresh the list
          setSuccessMessage("Store updated successfully!");
          setEditingId(null);
          handleReset();
          // Clear success message after 3 seconds
          setTimeout(() => setSuccessMessage(""), 3000);
        } else {
          setUploadError("Failed to update store. Please try again.");
        }
      } else {
        // Create new store
        if (!imageUrl) {
          setUploadError("Store image is required");
          setUploading(false);
          return;
        }
        const res = await createShopByStore(storeData);
        if (res.success) {
          await fetchStores(); // Refresh the list
          setSuccessMessage("Store added successfully!");
          handleReset();
          // Clear success message after 3 seconds
          setTimeout(() => setSuccessMessage(""), 3000);
        } else {
          setUploadError("Failed to create store. Please try again.");
        }
      }
    } catch (error: any) {
      setUploadError(
        error.response?.data?.message ||
        error.message ||
        "Failed to save store. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (id: string) => {
    const store = stores.find((s) => s._id === id);
    if (store) {
      setStoreName(store.name);
      setSelectedProductIds(store.products || []);

      setSelectedProductIds(store.products || []);

      if (store.image) {
        setStoreImagePreview(store.image);
      } else {
        setStoreImagePreview("");
      }

      setEditingId(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;

    try {
      const res = await deleteShopByStore(id);
      if (res.success) {
        await fetchStores(); // Refresh the list
        if (editingId === id) {
          handleReset();
        }
        setSuccessMessage("Store deleted successfully!");
        setDeleteId(null);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setUploadError("Failed to delete store. Please try again.");
        setDeleteId(null);
      }
    } catch (error: any) {
      setUploadError(error.response?.data?.message || "Failed to delete store. Please try again.");
      setDeleteId(null);
    }
  };

  // Filter products based on all filter criteria
  useEffect(() => {
    let filtered = [...allProducts];

    // Apply search filter
    if (productSearchTerm) {
      filtered = filtered.filter(p =>
        String(p?.productName || "").toLowerCase().includes(String(productSearchTerm || "").toLowerCase())
      );
    }

    // Apply category filter
    if (filterCategory) {
      filtered = filtered.filter(p => {
        const catId = typeof p.category === 'string' ? p.category : (p.category as any)?._id;
        return catId === filterCategory;
      });
    }

    // Apply subcategory filter
    if (filterSubcategory) {
      filtered = filtered.filter(p => {
        if (!p.subcategory) return false;
        const subId = typeof p.subcategory === 'string' ? p.subcategory : (p.subcategory as any)?._id;
        return subId === filterSubcategory;
      });
    }

    // Apply brand filter
    if (filterBrand) {
      filtered = filtered.filter(p => {
        if (!p.brand) return false;
        const brandId = typeof p.brand === 'string' ? p.brand : (p.brand as any)?._id;
        return brandId === filterBrand;
      });
    }

    // Apply seller filter
    if (filterSeller) {
      filtered = filtered.filter(p => {
        const sellerId = typeof p.seller === 'string' ? p.seller : (p.seller as any)?._id;
        return sellerId === filterSeller;
      });
    }

    // Apply status filter
    if (filterStatus) {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    // Apply price filters
    if (filterMinPrice) {
      const minPrice = parseFloat(filterMinPrice);
      if (!isNaN(minPrice)) {
        filtered = filtered.filter(p => p.price >= minPrice);
      }
    }

    if (filterMaxPrice) {
      const maxPrice = parseFloat(filterMaxPrice);
      if (!isNaN(maxPrice)) {
        filtered = filtered.filter(p => p.price <= maxPrice);
      }
    }

    setProducts(filtered);
  }, [allProducts, productSearchTerm, filterCategory, filterSubcategory, filterBrand, filterSeller, filterStatus, filterMinPrice, filterMaxPrice]);

  // Get subcategories for selected category
  const getSubcategoriesForCategory = () => {
    if (!filterCategory) return [];
    const category = categories.find(c => c._id === filterCategory);
    if (!category) return [];

    // Get all subcategories that belong to this category
    // Subcategories are categories with parentId matching the selected category
    return categories.filter(c => {
      const parentId = typeof c.parentId === 'string' ? c.parentId : (c.parentId as any)?._id;
      return parentId === filterCategory;
    });
  };

  const handleReset = () => {
    setStoreName("");
    setStoreImageFile(null);
    setStoreImagePreview("");
    setEditingId(null);
    setUploadError("");
    setSuccessMessage("");
    setSelectedProductIds([]);
    setProductSearchTerm("");
    setFilterCategory("");
    setFilterSubcategory("");
    setFilterBrand("");
    setFilterSeller("");
    setFilterStatus("Active");
    setFilterMinPrice("");
    setFilterMaxPrice("");
  };



  const handleExport = () => {
    setUploadError("Export functionality will be implemented soon.");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-2xl font-semibold text-neutral-800">
          Shop by Store
        </h1>
        <div className="text-sm text-blue-500">
          <span className="text-blue-500 hover:underline cursor-pointer">
            Home
          </span>{" "}
          <span className="text-neutral-400">/</span> Dashboard
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left Panel - Add Store */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">
              {editingId ? "Edit Store" : "Add Store"}
            </h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">

            {/* Store Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Store Name: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Enter Store Name"
                className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>



            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select Products: {selectedProductIds.length} selected
                {products.length > 0 && ` (${products.length} available)`}
              </label>

              {/* Filters Section */}
              <div className="mb-3 space-y-2 p-3 bg-neutral-50 rounded-md border border-neutral-200">
                <div className="text-xs font-semibold text-neutral-600 mb-2">Filters:</div>

                {/* Search */}
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />

                {/* Category and Subcategory */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filterCategory}
                    onChange={(e) => {
                      setFilterCategory(e.target.value);
                      setFilterSubcategory(""); // Reset subcategory when category changes
                    }}
                    className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer bg-white"
                  >
                    <option value="">All Categories</option>
                    {categories.filter(c => !c.parentId).map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterSubcategory}
                    onChange={(e) => setFilterSubcategory(e.target.value)}
                    disabled={!filterCategory}
                    className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer bg-white disabled:bg-neutral-100 disabled:cursor-not-allowed"
                  >
                    <option value="">All Subcategories</option>
                    {getSubcategoriesForCategory().map((sub) => (
                      <option key={sub._id} value={sub._id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Brand and Seller */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filterBrand}
                    onChange={(e) => setFilterBrand(e.target.value)}
                    className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer bg-white"
                  >
                    <option value="">All Brands</option>
                    {brands.map((brand) => (
                      <option key={brand._id} value={brand._id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterSeller}
                    onChange={(e) => setFilterSeller(e.target.value)}
                    className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer bg-white"
                  >
                    <option value="">All Sellers</option>
                    {sellers.map((seller) => (
                      <option key={seller._id} value={seller._id}>
                        {seller.storeName || seller.sellerName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status and Price Range */}
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer bg-white"
                  >
                    <option value="">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Min Price"
                    value={filterMinPrice}
                    onChange={(e) => setFilterMinPrice(e.target.value)}
                    className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />

                  <input
                    type="number"
                    placeholder="Max Price"
                    value={filterMaxPrice}
                    onChange={(e) => setFilterMaxPrice(e.target.value)}
                    className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                {/* Clear Filters Button */}
                {(filterCategory || filterSubcategory || filterBrand || filterSeller || filterStatus !== "Active" || filterMinPrice || filterMaxPrice) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory("");
                      setFilterSubcategory("");
                      setFilterBrand("");
                      setFilterSeller("");
                      setFilterStatus("Active");
                      setFilterMinPrice("");
                      setFilterMaxPrice("");
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="border border-neutral-300 rounded-md max-h-60 overflow-y-auto p-2 bg-neutral-50">
                {loadingData ? (
                  <div className="text-center text-sm text-neutral-500 py-2">
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600 mr-2"></div>
                    Loading products...
                  </div>
                ) : products.length > 0 ? (
                  <>
                    {products.map((product) => (
                      <div key={product._id} className="flex items-center mb-2 hover:bg-neutral-100 p-1 rounded">
                        <input
                          type="checkbox"
                          id={`prod-${product._id}`}
                          checked={selectedProductIds.includes(product._id)}
                          onChange={() => toggleProductSelection(product._id)}
                          className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded cursor-pointer"
                        />
                        <label htmlFor={`prod-${product._id}`} className="ml-2 block text-sm text-gray-900 truncate cursor-pointer flex-1">
                          {product.productName}
                        </label>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center text-sm text-neutral-500 py-2">
                    No products found matching the filters
                  </div>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
                <span>{uploadError}</span>
                <button
                  onClick={() => setUploadError("")}
                  className="text-red-700 hover:text-red-900 ml-4 text-lg font-bold"
                  type="button"
                >
                  Ã—
                </button>
              </div>
            )}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
                <span>{successMessage}</span>
                <button
                  onClick={() => setSuccessMessage("")}
                  className="text-green-700 hover:text-green-900 ml-4 text-lg font-bold"
                  type="button"
                >
                  Ã—
                </button>
              </div>
            )}
            {/* Store Image */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Store Image:
              </label>
              <label className="block border-2 border-dashed border-neutral-300 rounded-lg p-4 text-center cursor-pointer hover:border-teal-500 transition-colors bg-white">
                {storeImagePreview ? (
                  <div className="space-y-2">
                    <img
                      src={storeImagePreview}
                      alt="Store preview"
                      className="max-h-32 mx-auto rounded-lg object-cover"
                    />
                    <p className="text-xs text-neutral-600">
                      {storeImageFile?.name}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setStoreImageFile(null);
                        setStoreImagePreview("");
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

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleAddStore}
                disabled={uploading}
                className={`flex-1 py-2.5 rounded text-sm font-medium transition-colors ${uploading
                  ? "bg-neutral-400 cursor-not-allowed text-white"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
                  }`}>
                {uploading
                  ? "Uploading..."
                  : editingId
                    ? "Update Store"
                    : "Create Store"}
              </button>
              {editingId && (
                <button
                  onClick={handleReset}
                  className="px-4 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 py-2.5 rounded text-sm font-medium transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - View Stores */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">View Stores</h2>
          </div>

          {/* Controls */}
          <div className="p-4 sm:p-6 border-b border-neutral-200">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              {/* Entries Per Page */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-700">Show</span>
                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    setEntriesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 cursor-pointer">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-neutral-700">entries</span>
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
                  placeholder="Search..."
                  className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-w-[150px]"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th
                    className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                    onClick={() => handleSort("id")}>
                    <div className="flex items-center gap-2">
                      ID
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
                    onClick={() => handleSort("name")}>
                    <div className="flex items-center gap-2">
                      Store Name
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
                    Details
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Image
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {loadingStores ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 sm:px-6 py-8 text-center text-sm text-neutral-500">
                      Loading stores...
                    </td>
                  </tr>
                ) : displayedStores.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 sm:px-6 py-8 text-center text-sm text-neutral-500">
                      No stores found
                    </td>
                  </tr>
                ) : (
                  displayedStores.map((store) => (
                    <tr key={store._id} className="hover:bg-neutral-50">
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-mono">
                        {store.storeId || store._id}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-medium">
                        {store.name}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-xs text-neutral-500">
                        {store.products?.length || 0} Products
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="w-12 h-12 bg-neutral-100 rounded overflow-hidden flex items-center justify-center border border-neutral-200">
                          {store.image ? (
                            <img
                              src={store.image}
                              alt={store.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          ) : (
                            <span className="text-[10px] text-neutral-400">
                              No Img
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(store._id)}
                            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
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
                            onClick={() => setDeleteId(store._id)}
                            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
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
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, sortedStores.length)} of {sortedStores.length}{" "}
              entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 border border-neutral-300 rounded ${currentPage === 1
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
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 border border-neutral-300 rounded text-sm ${currentPage === page
                      ? "bg-teal-600 text-white border-teal-600"
                      : "text-neutral-700 hover:bg-neutral-50"
                      }`}>
                    {page}
                  </button>
                )
              )}
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
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-neutral-500 py-4">
        Copyright © 2025. Developed By{" "}
        <a href="#" className="text-teal-600 hover:text-teal-700">
          Olovely Total Suvidha
        </a>
      </div>

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Store"
        message="Are you sure you want to delete this store?"
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

