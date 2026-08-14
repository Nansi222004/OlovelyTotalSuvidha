import { useState, useEffect } from "react";
import {
    getLowestPricesProducts,
    createLowestPricesProduct,
    updateLowestPricesProduct,
    deleteLowestPricesProduct,
    type LowestPricesProduct,
    type LowestPricesProductFormData,
} from "../../../services/api/admin/adminLowestPricesService";
import { getProducts, type Product } from "../../../services/api/admin/adminProductService";

export default function AdminLowestPrices() {
    // Form state
    const [selectedProduct, setSelectedProduct] = useState<string>("");
    const [order, setOrder] = useState<number | undefined>(undefined);
    const [isActive, setIsActive] = useState(true);

    // Data state
    const [lowestPricesProducts, setLowestPricesProducts] = useState<LowestPricesProduct[]>([]);
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [productSearchTerm, setProductSearchTerm] = useState("");

    // UI state
    const [loading, setLoading] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Pagination
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Fetch initial data
    useEffect(() => {
        fetchLowestPricesProducts();
        fetchAvailableProducts();
    }, []);

    const fetchLowestPricesProducts = async () => {
        try {
            setLoadingProducts(true);
            const response = await getLowestPricesProducts();
            if (response.success && Array.isArray(response.data)) {
                setLowestPricesProducts(response.data);
            }
        } catch (err) {
            console.error("Error fetching lowest prices products:", err);
            setError("Failed to load lowest prices products");
        } finally {
            setLoadingProducts(false);
        }
    };

    const fetchAvailableProducts = async () => {
        try {
            const response = await getProducts({ limit: 1000, status: "Active" });
            if (response.success && response.data) {
                const productList = Array.isArray(response.data) ? response.data : [];
                setAvailableProducts(productList);
            }
        } catch (err) {
            console.error("Error fetching products:", err);
        }
    };

    // Filter products based on search term and exclude already added products
    const filteredProducts = availableProducts.filter((product) => {
        // Get IDs of products already in lowest prices
        const existingProductIds = lowestPricesProducts.map((lp) =>
            typeof lp.product === "string" ? lp.product : lp.product._id
        );

        // Exclude already added products
        if (existingProductIds.includes(product._id)) {
            return false;
        }

        // Filter by search term
        if (productSearchTerm) {
            const searchLower = String(productSearchTerm || "").toLowerCase();
            return (
                String(product?.productName || "").toLowerCase().includes(searchLower) ||
                String(product?._id || "").toLowerCase().includes(searchLower)
            );
        }

        return true;
    });

    const handleSubmit = async () => {
        setError("");
        setSuccess("");

        // Validation
        if (!selectedProduct) {
            setError("Please select a product");
            return;
        }

        const formData: LowestPricesProductFormData = {
            product: selectedProduct,
            order: order !== undefined ? order : undefined,
            isActive,
        };

        try {
            setLoading(true);

            if (editingId) {
                const response = await updateLowestPricesProduct(editingId, formData);
                if (response.success) {
                    setSuccess("Product updated successfully!");
                    resetForm();
                    fetchLowestPricesProducts();
                } else {
                    setError(response.message || "Failed to update product");
                }
            } else {
                const response = await createLowestPricesProduct(formData);
                if (response.success) {
                    setSuccess("Product added successfully!");
                    resetForm();
                    fetchLowestPricesProducts();
                    fetchAvailableProducts(); // Refresh to update filtered list
                } else {
                    setError(response.message || "Failed to add product");
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to save product");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (lowestPricesProduct: LowestPricesProduct) => {
        const productId = typeof lowestPricesProduct.product === "string"
            ? lowestPricesProduct.product
            : lowestPricesProduct.product._id;
        setSelectedProduct(productId);
        setOrder(lowestPricesProduct.order);
        setIsActive(lowestPricesProduct.isActive);
        setEditingId(lowestPricesProduct._id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to remove this product from lowest prices section?")) {
            return;
        }

        try {
            const response = await deleteLowestPricesProduct(id);
            if (response.success) {
                setSuccess("Product removed successfully!");
                fetchLowestPricesProducts();
                fetchAvailableProducts(); // Refresh to update filtered list
                if (editingId === id) {
                    resetForm();
                }
            } else {
                setError(response.message || "Failed to remove product");
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to remove product");
        }
    };

    const resetForm = () => {
        setSelectedProduct("");
        setOrder(undefined);
        setIsActive(true);
        setEditingId(null);
        setProductSearchTerm("");
    };

    // Pagination
    const totalPages = Math.ceil(lowestPricesProducts.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedProducts = lowestPricesProducts.slice(startIndex, endIndex);

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Page Header */}
            <div className="p-6 pb-0">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-semibold text-neutral-800">
                        Lowest Prices Ever Products
                    </h1>
                    <div className="text-sm text-blue-500">
                        <span className="text-blue-500 hover:underline cursor-pointer">
                            Home
                        </span>{" "}
                        <span className="text-neutral-400">/</span> Lowest Prices Products
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
                            {editingId ? "Edit Product" : "Add Product"}
                        </h2>

                        <div className="space-y-4 flex-1 overflow-y-auto">
                            {/* Product Search and Select */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Product <span className="text-red-500">*</span>
                                </label>
                                {!editingId ? (
                                    <>
                                        <input
                                            type="text"
                                            placeholder="Search products..."
                                            value={productSearchTerm}
                                            onChange={(e) => setProductSearchTerm(e.target.value)}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none mb-2"
                                        />
                                        <div className="border border-neutral-300 rounded max-h-48 overflow-y-auto bg-white">
                                            {filteredProducts.length === 0 ? (
                                                <p className="text-sm text-neutral-400 p-3 text-center">
                                                    {productSearchTerm
                                                        ? "No products found"
                                                        : "No available products"}
                                                </p>
                                            ) : (
                                                filteredProducts.slice(0, 20).map((product) => (
                                                    <button
                                                        key={product._id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedProduct(product._id);
                                                            setProductSearchTerm("");
                                                        }}
                                                        className={`w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-b-0 ${
                                                            selectedProduct === product._id
                                                                ? "bg-teal-50 border-teal-200"
                                                                : ""
                                                        }`}
                                                    >
                                                        <div className="text-sm font-medium text-neutral-900">
                                                            {product.productName}
                                                        </div>
                                                        {product.price && (
                                                            <div className="text-xs text-neutral-500">
                                                                ₹{product.price.toLocaleString("en-IN")}
                                                            </div>
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        {selectedProduct && (
                                            <p className="text-xs text-teal-600 mt-1">
                                                Selected:{" "}
                                                {
                                                    availableProducts.find(
                                                        (p) => p._id === selectedProduct
                                                    )?.productName
                                                }
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <div className="px-3 py-2 border border-neutral-300 rounded bg-neutral-50 text-sm">
                                        {availableProducts.find((p) => p._id === selectedProduct)
                                            ?.productName || "Product not found"}
                                    </div>
                                )}
                            </div>

                            {/* Order */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Display Order
                                </label>
                                <input
                                    type="number"
                                    value={order !== undefined ? order : ""}
                                    onChange={(e) =>
                                        setOrder(e.target.value ? Number(e.target.value) : undefined)
                                    }
                                    placeholder="Auto-assign"
                                    min="0"
                                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                />
                                <p className="text-xs text-neutral-500 mt-1">
                                    Leave empty to auto-assign at the end
                                </p>
                            </div>

                            {/* Active Status */}
                            <div>
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                    />
                                    <span className="ml-2 text-sm font-medium text-neutral-700">
                                        Active (Show on home page)
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-6 space-y-2">
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className={`w-full px-4 py-2 rounded font-medium transition-colors ${
                                    loading
                                        ? "bg-gray-400 cursor-not-allowed text-white"
                                        : "bg-teal-600 hover:bg-teal-700 text-white"
                                }`}
                            >
                                {loading
                                    ? "Saving..."
                                    : editingId
                                    ? "Update Product"
                                    : "Add Product"}
                            </button>
                            {editingId && (
                                <button
                                    onClick={resetForm}
                                    className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Section: View Products Table */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
                        <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
                            <h2 className="text-lg font-semibold">View Products</h2>
                        </div>

                        {/* Controls */}
                        <div className="p-4 border-b border-neutral-100">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-600">Show</span>
                                <input
                                    type="number"
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="w-16 px-2 py-1.5 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                />
                                <span className="text-sm text-neutral-600">entries</span>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
                                        <th className="p-4">Order</th>
                                        <th className="p-4">Product Name</th>
                                        <th className="p-4">Price</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingProducts ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="p-8 text-center text-neutral-400"
                                            >
                                                Loading products...
                                            </td>
                                        </tr>
                                    ) : displayedProducts.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="p-8 text-center text-neutral-400"
                                            >
                                                No products found. Add your first product!
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedProducts.map((item) => {
                                            const product =
                                                typeof item.product === "string"
                                                    ? null
                                                    : item.product;
                                            return (
                                                <tr
                                                    key={item._id}
                                                    className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200"
                                                >
                                                    <td className="p-4">{item.order}</td>
                                                    <td className="p-4 font-medium">
                                                        {product?.productName || "Product not found"}
                                                    </td>
                                                    <td className="p-4">
                                                        {product?.price
                                                            ? `₹${product.price.toLocaleString("en-IN")}`
                                                            : "N/A"}
                                                    </td>
                                                    <td className="p-4">
                                                        <span
                                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                                item.isActive
                                                                    ? "bg-green-100 text-green-800"
                                                                    : "bg-gray-100 text-gray-800"
                                                            }`}
                                                        >
                                                            {item.isActive ? "Active" : "Inactive"}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleEdit(item)}
                                                                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                                                title="Edit"
                                                            >
                                                                <svg
                                                                    width="14"
                                                                    height="14"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                >
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(item._id)}
                                                                className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                                                title="Delete"
                                                            >
                                                                <svg
                                                                    width="14"
                                                                    height="14"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                >
                                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-neutral-100 flex justify-between items-center">
                                <div className="text-sm text-neutral-600">
                                    Showing {startIndex + 1} to{" "}
                                    {Math.min(endIndex, lowestPricesProducts.length)} of{" "}
                                    {lowestPricesProducts.length} entries
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className={`px-3 py-1.5 rounded text-sm border ${
                                            currentPage === 1
                                                ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300"
                                                : "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-300"
                                        }`}
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() =>
                                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                                        }
                                        disabled={currentPage === totalPages}
                                        className={`px-3 py-1.5 rounded text-sm border ${
                                            currentPage === totalPages
                                                ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300"
                                                : "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-300"
                                        }`}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

