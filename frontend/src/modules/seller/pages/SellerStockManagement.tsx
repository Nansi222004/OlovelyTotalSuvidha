import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProducts, updateStock, Product } from '../../../services/api/productService';
import { getCategories } from '../../../services/api/categoryService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

interface StockItem {
    variationId: string;
    productId: string;
    name: string;
    seller: string;
    image: string;
    variation: string;
    stock: number | 'Unlimited';
    status: 'Published' | 'Unpublished';
    category: string;
}

export default function SellerStockManagement() {
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const stockQuery = searchParams.get('stock') || searchParams.get('filter');
    const getInitialStock = (param: string | null) => {
        if (!param) return 'All Products';
        const lower = param.toLowerCase();
        if (lower === 'out_of_stock' || lower === 'sold_out' || lower === 'out of stock') return 'Out of Stock';
        if (lower === 'low_stock' || lower === 'low on stock' || lower === 'low') return 'Low on Stock';
        if (lower === 'in_stock' || lower === 'in stock') return 'In Stock';
        return 'All Products';
    };
    const initialStockFilter = getInitialStock(stockQuery);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [updatingStock, setUpdatingStock] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Category');
    const [statusFilter, setStatusFilter] = useState('All Products');
    const [stockFilter, setStockFilter] = useState(initialStockFilter);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [categories, setCategories] = useState<string[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const { user } = useAuth();

    useEffect(() => {
        const query = searchParams.get('stock') || searchParams.get('filter');
        if (query) {
            setStockFilter(getInitialStock(query));
        }
    }, [searchParams]);

    // Fetch categories for filter
    useEffect(() => {
        const fetchCats = async () => {
            try {
                const res = await getCategories();
                if (res.success) {
                    setCategories(res.data.map(cat => cat.name));
                }
            } catch (err) {
                console.error("Error fetching categories:", err);
            }
        };
        fetchCats();
    }, []);

    // Helper to resolve image URL
    const resolveImageUrl = (url: string | undefined) => {
        if (!url) return '/assets/product-placeholder.jpg';
        if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;

        // Handle relative paths
        const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
        try {
            const urlObj = new URL(apiBase);
            const origin = urlObj.origin;
            const cleanUrl = url.replace(/\\/g, '/'); // Fix windows backslashes
            return `${origin}/${cleanUrl.startsWith('/') ? cleanUrl.slice(1) : cleanUrl}`;
        } catch (e) {
            return url;
        }
    };

    // Fetch products and convert to stock items
    useEffect(() => {
        const fetchStockItems = async () => {
            setLoading(true);
            setError('');
            try {
                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                };

                if (categoryFilter !== 'All Category') {
                    params.category = categoryFilter;
                }
                if (statusFilter === 'Published') {
                    params.status = 'published';
                } else if (statusFilter === 'Unpublished') {
                    params.status = 'unpublished';
                }

                const response = await getProducts(params);
                if (response.success && response.data) {
                    // Convert products to stock items
                    const items: StockItem[] = [];
                    response.data.forEach((product: Product) => {
                        product.variations.forEach((variation, index) => {
                            items.push({
                                variationId: variation._id || `${product._id}-${index}`,
                                productId: product._id,
                                name: product.productName,
                                seller: user?.storeName || '',
                                image: resolveImageUrl(product.mainImage || product.mainImageUrl),
                                variation: variation.title || variation.value || variation.name || 'Default',
                                stock: variation.stock,
                                status: product.publish ? 'Published' : 'Unpublished',
                                category: (product.category as any)?.name || 'Uncategorized',
                            });
                        });
                    });
                    setStockItems(items);
                    if ((response as any).pagination) {
                        setTotalPages((response as any).pagination.pages);
                    }
                } else {
                    setError(response.message || 'Failed to fetch stock items');
                }
            } catch (err: any) {
                setError(err.response?.data?.message || err.message || 'Failed to fetch stock items');
            } finally {
                setLoading(false);
            }
        };

        fetchStockItems();

        // Implement real-time updates by polling every 30 seconds
        const intervalId = setInterval(fetchStockItems, 30000);

        return () => clearInterval(intervalId);
    }, [currentPage, rowsPerPage, categoryFilter, statusFilter, user]);

    // Handle stock update
    const handleStockUpdate = async (productId: string, variationId: string, newStock: number) => {
        setUpdatingStock(variationId);
        try {
            const response = await updateStock(productId, variationId, newStock);
            if (response.success) {
                // Update local state
                setStockItems(prev => prev.map(item =>
                    item.variationId === variationId
                        ? { ...item, stock: newStock }
                        : item
                ));
                showToast('Stock updated successfully', 'success');
            } else {
                showToast(response.message || 'Failed to update stock', 'error');
            }
        } catch (err: any) {
            showToast(err.response?.data?.message || err.message || 'Failed to update stock', 'error');
        } finally {
            setUpdatingStock(null);
        }
    };

    // Copy ID helper
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast(`${label} copied to clipboard`, 'success');
    };

    // Filter items
    let filteredItems = stockItems.filter(item => {
        const q = String(searchTerm || "").toLowerCase();
        const matchesSearch = String(item.name || "").toLowerCase().includes(q) ||
            String(item.seller || "").toLowerCase().includes(q);
        const matchesCategory = categoryFilter === 'All Category' || item.category === categoryFilter;
        const matchesStatus = statusFilter === 'All Products' ||
            (statusFilter === 'Published' && item.status === 'Published') ||
            (statusFilter === 'Unpublished' && item.status === 'Unpublished');
        const matchesStock = stockFilter === 'All Products' ||
            (stockFilter === 'In Stock' && (item.stock === 'Unlimited' || (typeof item.stock === 'number' && item.stock > 0))) ||
            (stockFilter === 'Out of Stock' && typeof item.stock === 'number' && item.stock === 0) ||
            (stockFilter === 'Low on Stock' && (typeof item.stock === 'number' && item.stock > 0 && item.stock < 10)) ||
            (stockFilter === 'Unlimited' && item.stock === 'Unlimited');
        return matchesSearch && matchesCategory && matchesStatus && matchesStock;
    });

    // Sort items
    if (sortColumn) {
        filteredItems.sort((a, b) => {
            let aVal: any = a[sortColumn as keyof typeof a];
            let bVal: any = b[sortColumn as keyof typeof b];
            if (typeof aVal === 'string' || typeof bVal === 'string') {
                aVal = String(aVal ?? "").toLowerCase();
                bVal = String(bVal ?? "").toLowerCase();
            }
            if (sortColumn === 'stock') {
                // Stock is now always a number
                aVal = Number(aVal);
                bVal = Number(bVal);
            }
            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => (
        <span className="text-neutral-400 text-[10px] ml-1">
            {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
        </span>
    );

    return (
        <div className="flex flex-col h-full">
            {/* Page Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-neutral-800">Stock Management</h1>
                <div className="text-sm text-blue-500">
                    <span className="cursor-pointer hover:underline">Home</span> <span className="text-neutral-400">/</span> <span className="text-neutral-600">Dashboard</span>
                </div>
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex-1 flex flex-col">
                <div className="p-4 border-b border-neutral-100 font-medium text-neutral-700">
                    View Stock Management
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 border-b border-neutral-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <div className="w-48">
                            <label className="block text-xs text-neutral-600 mb-1">Filter by Category</label>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                            >
                                <option value="All Category">All Category</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="w-40">
                            <label className="block text-xs text-neutral-600 mb-1">Filter by Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                            >
                                <option value="All Products">All Products</option>
                                <option value="Published">Published</option>
                                <option value="Unpublished">Unpublished</option>
                            </select>
                        </div>

                        <div className="w-40">
                            <label className="block text-xs text-neutral-600 mb-1">Filter by Stock</label>
                            <select
                                value={stockFilter}
                                onChange={(e) => setStockFilter(e.target.value)}
                                className="w-full bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                            >
                                <option value="All Products">All Products</option>
                                <option value="In Stock">In Stock</option>
                                <option value="Out of Stock">Out of Stock</option>
                                <option value="Low on Stock">Low on Stock</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-600">Show</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                                className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>

                        <button
                            onClick={() => {
                                const headers = ['Variation Id', 'Product Id', 'Product Name', 'Seller Name', 'Variation', 'Current Stock', 'Status', 'Category'];
                                const csvContent = [
                                    headers.join(','),
                                    ...filteredItems.map(item => [
                                        item.variationId,
                                        item.productId,
                                        `"${item.name}"`,
                                        `"${item.seller}"`,
                                        `"${item.variation}"`,
                                        item.stock,
                                        item.status,
                                        `"${item.category}"`
                                    ].join(','))
                                ].join('\n');
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', `stock_management_${new Date().toISOString().split('T')[0]}.csv`);
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Export
                        </button>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-3 pr-8 py-1.5 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none w-48"
                            />
                            <svg
                                className="absolute right-2.5 top-2.5 text-neutral-400"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-neutral-50 text-xs font-semibold text-neutral-700 border-b border-neutral-200">
                                <th
                                    className="px-3 py-2.5 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                                    onClick={() => handleSort('variationId')}
                                >
                                    <div className="flex items-center">
                                        Variation ID <SortIcon column="variationId" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2.5 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                                    onClick={() => handleSort('productId')}
                                >
                                    <div className="flex items-center">
                                        Product ID <SortIcon column="productId" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2.5 cursor-pointer hover:bg-neutral-100 transition-colors min-w-[160px]"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center">
                                        Product Name <SortIcon column="name" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2.5 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                                    onClick={() => handleSort('seller')}
                                >
                                    <div className="flex items-center">
                                        Seller Name <SortIcon column="seller" />
                                    </div>
                                </th>
                                <th className="px-3 py-2.5 text-center whitespace-nowrap">
                                    Image
                                </th>
                                <th
                                    className="px-3 py-2.5 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                                    onClick={() => handleSort('variation')}
                                >
                                    <div className="flex items-center">
                                        Variation <SortIcon column="variation" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2.5 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                                    onClick={() => handleSort('stock')}
                                >
                                    <div className="flex items-center">
                                        Current Stock <SortIcon column="stock" />
                                    </div>
                                </th>
                                <th className="px-3 py-2.5 whitespace-nowrap text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item) => (
                                <tr key={item.variationId} className="hover:bg-neutral-50/80 transition-colors text-xs text-neutral-700 border-b border-neutral-100">
                                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(item.variationId, 'Variation ID')}
                                            className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-1.5 py-0.5 rounded border border-neutral-200 transition-colors"
                                            title={`Click to copy: ${item.variationId}`}
                                        >
                                            <span>...{item.variationId.slice(-6)}</span>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                        </button>
                                    </td>
                                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(item.productId, 'Product ID')}
                                            className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-1.5 py-0.5 rounded border border-neutral-200 transition-colors"
                                            title={`Click to copy: ${item.productId}`}
                                        >
                                            <span>...{item.productId.slice(-6)}</span>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                        </button>
                                    </td>
                                    <td className="px-3 py-2.5 align-middle">
                                        <div className="font-medium text-neutral-900 max-w-[180px] line-clamp-2" title={item.name}>
                                            {item.name}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                        <span className="text-neutral-600 text-xs max-w-[120px] truncate block" title={item.seller}>
                                            {item.seller}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 align-middle">
                                        <div className="w-10 h-10 bg-white border border-neutral-200 rounded p-0.5 flex items-center justify-center mx-auto shrink-0 shadow-xs">
                                            <img
                                                src={item.image}
                                                alt={item.name}
                                                className="max-w-full max-h-full object-contain rounded"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://placehold.co/60x40?text=Img';
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">
                                            {item.variation}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                            item.stock === 'Unlimited'
                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                : typeof item.stock === 'number' && item.stock === 0
                                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                                    : typeof item.stock === 'number' && item.stock < 10
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}>
                                            {item.stock === 'Unlimited'
                                                ? 'Unlimited'
                                                : item.stock === 0
                                                    ? '0 (Out of stock)'
                                                    : item.stock < 10
                                                        ? `${item.stock} (Low)`
                                                        : item.stock}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <input
                                                type="number"
                                                min="0"
                                                defaultValue={typeof item.stock === 'number' ? item.stock : 0}
                                                className="w-16 px-2 py-1 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = parseInt((e.target as HTMLInputElement).value);
                                                        if (!isNaN(val)) {
                                                            handleStockUpdate(item.productId, item.variationId, val);
                                                        }
                                                    }
                                                }}
                                            />
                                            <button
                                                disabled={updatingStock === item.variationId}
                                                onClick={(e) => {
                                                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                                    const val = parseInt(input.value);
                                                    if (!isNaN(val)) {
                                                        handleStockUpdate(item.productId, item.variationId, val);
                                                    }
                                                }}
                                                className="p-1.5 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:bg-neutral-300 shrink-0"
                                                title="Save Stock"
                                            >
                                                {updatingStock === item.variationId ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                                        <polyline points="7 3 7 8 15 8"></polyline>
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-neutral-400 border border-neutral-200">
                                        No stock items found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between">
                    <div className="text-sm text-neutral-700">
                        Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredItems.length)} of {filteredItems.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className={`p-2 border border-teal-600 rounded ${currentPage === 1
                                ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                : 'text-teal-600 hover:bg-teal-50'
                                }`}
                            aria-label="Previous page"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 18L9 12L15 6" />
                            </svg>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`px-3 py-1.5 border border-teal-600 rounded font-medium text-sm ${currentPage === page
                                    ? 'bg-teal-600 text-white'
                                    : 'text-teal-600 hover:bg-teal-50'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className={`p-2 border border-teal-600 rounded ${currentPage === totalPages
                                ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                : 'text-teal-600 hover:bg-teal-50'
                                }`}
                            aria-label="Next page"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 18L15 12L9 6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
