import { useState, useEffect, useRef } from "react";
import {
  getInventoryTransactions,
  getLowStockProducts,
  lookupBarcode,
  adjustStock,
  recordDamage,
  addStock,
  sendLowStockAlertToVendor,
  type InventoryTransaction,
  type LowStockProduct,
} from "../../../services/api/admin/adminInventoryService";
import { getProductById } from "../../../services/api/admin/adminProductService";
import { getAllSellers } from "../../../services/api/sellerService";
import { resolveImageUrl } from "../../../utils/imageUrl";

const TRANSACTION_TYPES = ["ALL", "SALE", "RETURN", "ADJUSTMENT", "STOCK_IN", "DAMAGE", "STOCK_OUT"];
const TYPE_COLORS: Record<string, string> = {
  SALE: "bg-red-100 text-red-700",
  RETURN: "bg-green-100 text-green-700",
  ADJUSTMENT: "bg-blue-100 text-blue-700",
  STOCK_IN: "bg-emerald-100 text-emerald-700",
  STOCK_OUT: "bg-orange-100 text-orange-700",
  DAMAGE: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-700",
  TRANSFER_IN: "bg-purple-100 text-purple-700",
  TRANSFER_OUT: "bg-pink-100 text-pink-700",
  OPENING: "bg-yellow-100 text-yellow-700",
};

type Tab = "ledger" | "lowstock" | "barcode" | "adjust";

interface AdjustForm {
  productId: string;
  variationId?: string;
  delta: number;
  note: string;
  mode: "adjust" | "damage" | "stock-in";
}

function isPlatformProduct(product: any): boolean {
  if (!product) return false;
  if (product.ownerType === "PLATFORM") return true;
  if (!product.seller) return true;
  const s = product.seller;
  if (typeof s === "object" && s !== null) {
    return !!(
      s.isPlatform ||
      s.category === "Admin" ||
      s.email === "admin-store@olovely.com" ||
      s.sellerName === "Olovely Admin" ||
      s.storeName === "Olovely Admin Store"
    );
  }
  return false;
}

export default function AdminInventoryLedger() {
  const [activeTab, setActiveTab] = useState<Tab>("ledger");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Sellers list for dropdown filters
  const [sellersList, setSellersList] = useState<{ id: string; name: string }[]>([]);

  // Ledger tab
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [ledgerOwnerFilter, setLedgerOwnerFilter] = useState("ALL");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);

  // Low stock tab
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | null>(null);
  const [lowStockOwnerFilter, setLowStockOwnerFilter] = useState("ALL");
  const [lowStockStatusFilter, setLowStockStatusFilter] = useState("ALL");
  const [lowStockSearch, setLowStockSearch] = useState("");
  const [lowStockPage, setLowStockPage] = useState(1);
  const [lowStockTotalPages, setLowStockTotalPages] = useState(1);
  const [sendingAlertIds, setSendingAlertIds] = useState<Set<string>>(new Set());
  const [sentAlertIds, setSentAlertIds] = useState<Set<string>>(new Set());

  // Barcode lookup tab
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeResult, setBarcodeResult] = useState<any>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Adjust tab
  const [adjustForm, setAdjustForm] = useState<AdjustForm>({
    productId: "",
    variationId: "",
    delta: 0,
    note: "",
    mode: "adjust",
  });
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any | null>(null);
  const [adjustProductLoading, setAdjustProductLoading] = useState(false);

  // Auto-lookup product details in Adjust tab
  useEffect(() => {
    const pid = adjustForm.productId.trim();
    if (pid.length === 24) {
      let cancelled = false;
      setAdjustProductLoading(true);
      getProductById(pid)
        .then((res) => {
          if (!cancelled && res.success && res.data) {
            setAdjustProduct(res.data);
            const variations = (res.data as any)?.variations;
            if (Array.isArray(variations) && variations.length > 0) {
              setAdjustForm((f) => ({
                ...f,
                variationId: f.variationId || (variations[0] as any)._id || (variations[0] as any).id || "",
              }));
            } else {
              setAdjustForm((f) => ({ ...f, variationId: "" }));
            }
          }
        })
        .catch(() => {
          if (!cancelled) setAdjustProduct(null);
        })
        .finally(() => {
          if (!cancelled) setAdjustProductLoading(false);
        });
      return () => {
        cancelled = true;
      };
    } else {
      setAdjustProduct(null);
    }
  }, [adjustForm.productId]);

  // Load sellers list on mount
  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const res = await getAllSellers();
        if (res.success && Array.isArray(res.data)) {
          const vendors = res.data
            .filter((s) => s.sellerName !== "Olovely Admin" && s.category !== "Admin")
            .map((s) => ({
              id: s._id,
              name: s.storeName ? `${s.storeName} (${s.sellerName})` : s.sellerName,
            }));
          setSellersList(vendors);
        }
      } catch (err) {
        console.error("Failed to load sellers for inventory filter:", err);
      }
    };
    fetchSellers();
  }, []);

  // Load data on tab change and filter change
  useEffect(() => {
    setError("");
    if (activeTab === "ledger") {
      fetchLedger();
    } else if (activeTab === "lowstock") {
      fetchLowStock();
    } else if (activeTab === "barcode") {
      setTimeout(() => barcodeRef.current?.focus(), 50);
    }
  }, [
    activeTab,
    ledgerPage,
    typeFilter,
    ledgerOwnerFilter,
    lowStockPage,
    lowStockOwnerFilter,
    lowStockStatusFilter,
  ]);

  const fetchLedger = async () => {
    try {
      setLedgerLoading(true);
      setError("");
      const params: Record<string, any> = { page: ledgerPage, limit: 50 };
      if (typeFilter !== "ALL") params.type = typeFilter;
      if (ledgerOwnerFilter === "PLATFORM") {
        params.ownerType = "PLATFORM";
      } else if (ledgerOwnerFilter !== "ALL") {
        params.sellerId = ledgerOwnerFilter;
      }
      const data = await getInventoryTransactions(params);
      setTransactions(data.data || []);
      setLedgerTotalPages(data.pagination?.pages || 1);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load transactions");
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchLowStock = async () => {
    try {
      setLowStockLoading(true);
      setError("");
      const params: Record<string, any> = { page: lowStockPage, limit: 50 };
      if (lowStockOwnerFilter === "PLATFORM") {
        params.ownerType = "PLATFORM";
      } else if (lowStockOwnerFilter !== "ALL") {
        params.sellerId = lowStockOwnerFilter;
      }
      if (lowStockStatusFilter !== "ALL") {
        params.status = lowStockStatusFilter;
      }
      if (lowStockSearch.trim()) {
        params.search = lowStockSearch.trim();
      }
      const data = await getLowStockProducts(params);
      setLowStock(data.data || []);
      setLowStockThreshold(data.threshold ?? null);
      setLowStockTotalPages(data.pagination?.pages || 1);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load low-stock products");
    } finally {
      setLowStockLoading(false);
    }
  };

  const handleLowStockSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLowStockPage(1);
    fetchLowStock();
  };

  const handleBarcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    try {
      setBarcodeLoading(true);
      setBarcodeResult(null);
      setError("");
      const result = await lookupBarcode(barcodeInput.trim());
      setBarcodeResult(result);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setBarcodeResult({ notFound: true });
      } else {
        setError(err.response?.data?.message || "Barcode lookup failed");
      }
    } finally {
      setBarcodeLoading(false);
      setTimeout(() => {
        barcodeRef.current?.focus();
        barcodeRef.current?.select();
      }, 50);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.productId.trim()) {
      setError("Product ID is required");
      return;
    }
    if (adjustProduct && !isPlatformProduct(adjustProduct)) {
      const vName = typeof adjustProduct.seller === "object"
        ? adjustProduct.seller?.storeName || adjustProduct.seller?.sellerName || "the assigned vendor"
        : "the assigned vendor";
      setError(
        `Cannot adjust stock for vendor-owned inventory. "${adjustProduct.productName}" is managed by vendor "${vName}" directly through the Vendor Panel (/seller/product/stock). To notify this vendor regarding inventory, use the Send Alert action in the Low Stock Alert tab.`
      );
      return;
    }
    try {
      setAdjustLoading(true);
      setError("");
      const payload = {
        productId: adjustForm.productId,
        variationId: adjustForm.variationId || undefined,
        note: adjustForm.note,
      };
      if (adjustForm.mode === "adjust") {
        if (adjustForm.delta === 0) { setError("Delta cannot be zero"); return; }
        await adjustStock({ ...payload, delta: adjustForm.delta });
      } else if (adjustForm.mode === "damage") {
        if (adjustForm.delta <= 0) { setError("Damage quantity must be positive"); return; }
        await recordDamage({ ...payload, quantity: adjustForm.delta });
      } else {
        if (adjustForm.delta <= 0) { setError("Stock-in quantity must be positive"); return; }
        await addStock({ ...payload, quantity: adjustForm.delta });
      }
      setSuccess(`Stock ${adjustForm.mode === "stock-in" ? "added" : adjustForm.mode === "damage" ? "damage recorded" : "adjusted"} successfully`);
      setAdjustForm(f => ({ ...f, productId: "", variationId: "", delta: 0, note: "" }));
      setAdjustProduct(null);
      if (activeTab === "ledger") fetchLedger();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update stock");
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleSendVendorAlert = async (product: LowStockProduct) => {
    if (!product.seller?._id) {
      setError(`Cannot send alert: No vendor assigned to product "${product.displayName}".`);
      return;
    }
    if (product.ownerType === "PLATFORM") {
      setError(`Cannot send alert: "${product.displayName}" is Platform inventory.`);
      return;
    }

    const alertKey = product._id;
    setSendingAlertIds(prev => new Set(prev).add(alertKey));
    setError("");

    try {
      const res = await sendLowStockAlertToVendor({
        productId: product.productId,
        variationId: product.variationId,
      });

      if (res.success) {
        setSentAlertIds(prev => new Set(prev).add(alertKey));
        const deliveryNote = res.data?.pushDelivered
          ? "In-app and push notification delivered."
          : "In-app notification created.";
        setSuccess(`Alert sent to ${res.data?.recipientName || product.ownerLabel || "vendor"} for "${product.displayName}". ${deliveryNote}`);
      } else {
        setError(res.message || "Failed to send alert to vendor.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to send alert to vendor.");
    } finally {
      setSendingAlertIds(prev => {
        const next = new Set(prev);
        next.delete(alertKey);
        return next;
      });
    }
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "ledger", label: "Transaction Ledger", icon: "📋" },
    { key: "lowstock", label: "Low Stock Alert", icon: "⚠️" },
    { key: "barcode", label: "POS Barcode", icon: "🔍" },
    { key: "adjust", label: "Stock Adjustment", icon: "✏️" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track stock movements, view platform & vendor ledger, monitor low-stock variations, and lookup POS barcodes.
          </p>
        </div>

        {/* Alerts */}
        {success && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            ✅ {success}
            <button onClick={() => setSuccess("")} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            ⚠️ {error}
            <button onClick={() => setError("")} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* LEDGER TAB */}
        {activeTab === "ledger" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                {/* Transaction Type Filter */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Type</label>
                  <select
                    value={typeFilter}
                    onChange={e => { setTypeFilter(e.target.value); setLedgerPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Owner Filter */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Inventory Owner</label>
                  <select
                    value={ledgerOwnerFilter}
                    onChange={e => { setLedgerOwnerFilter(e.target.value); setLedgerPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">All Inventory (Platform & Vendors)</option>
                    <option value="PLATFORM">Admin / Platform Inventory</option>
                    {sellersList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={fetchLedger}
                className="px-3.5 py-1.5 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm self-end"
              >
                Refresh
              </button>
            </div>

            {ledgerLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-gray-400">
                <span className="text-4xl mb-2">📋</span>
                <p className="font-medium text-gray-500">No transactions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600">
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-left px-4 py-3">Owner / Seller</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-right px-4 py-3">Qty</th>
                      <th className="text-right px-4 py-3">Before</th>
                      <th className="text-right px-4 py-3">After</th>
                      <th className="text-left px-4 py-3">Reference</th>
                      <th className="text-left px-4 py-3">Note</th>
                      <th className="text-left px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map(tx => (
                      <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {tx.product?.mainImage && (
                              <img
                                src={resolveImageUrl(tx.product.mainImage)}
                                alt=""
                                className="w-8 h-8 object-cover rounded border border-gray-100"
                              />
                            )}
                            <div>
                              <p className="font-medium text-gray-900 text-xs leading-tight">
                                {tx.product?.productName || "–"}
                              </p>
                              {tx.variationName && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-medium">
                                  {tx.variationName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {tx.ownerType === "PLATFORM" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Admin / Platform Inventory
                            </span>
                          ) : (
                            <div>
                              <p className="font-medium text-gray-900 text-xs leading-tight">
                                {tx.ownerLabel || tx.seller?.storeName || tx.seller?.sellerName || "Vendor"}
                              </p>
                              {tx.seller?.sellerName && tx.seller?.storeName && tx.seller.sellerName !== tx.seller.storeName && (
                                <p className="text-[11px] text-gray-500">{tx.seller.sellerName}</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tx.type] || "bg-gray-100 text-gray-700"}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${tx.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                          {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">{tx.previousStock}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 font-medium">{tx.newStock}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {tx.referenceType && <span className="font-medium">{tx.referenceType}</span>}
                          {tx.referenceId && <div className="text-gray-400 font-mono text-xs truncate max-w-[100px]">{tx.referenceId.slice(-8)}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[120px] truncate">{tx.note || "–"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleDateString()}<br />
                          <span className="text-gray-400">{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {ledgerTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">Page {ledgerPage} of {ledgerTotalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setLedgerPage(p => Math.max(1, p - 1))} disabled={ledgerPage === 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
                  <button onClick={() => setLedgerPage(p => Math.min(ledgerTotalPages, p + 1))} disabled={ledgerPage === ledgerTotalPages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOW STOCK TAB */}
        {activeTab === "lowstock" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Filters Bar */}
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-end justify-between">
              <div className="flex flex-wrap gap-3 items-end">
                {/* Search */}
                <form onSubmit={handleLowStockSearchSubmit} className="flex gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Search Item / Seller</label>
                    <input
                      type="text"
                      value={lowStockSearch}
                      onChange={e => setLowStockSearch(e.target.value)}
                      placeholder="Product, variant, or vendor..."
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg font-medium transition-colors self-end"
                  >
                    Search
                  </button>
                </form>

                {/* Owner Filter */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Inventory Owner</label>
                  <select
                    value={lowStockOwnerFilter}
                    onChange={e => { setLowStockOwnerFilter(e.target.value); setLowStockPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">All Inventory (Platform & Vendors)</option>
                    <option value="PLATFORM">Admin / Platform Inventory</option>
                    {sellersList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Stock Status</label>
                  <select
                    value={lowStockStatusFilter}
                    onChange={e => { setLowStockStatusFilter(e.target.value); setLowStockPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">All Low Stock & Out of Stock</option>
                    <option value="LOW_STOCK">Low on Stock (1 to Threshold)</option>
                    <option value="OUT_OF_STOCK">Out of Stock (0 units)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {lowStockThreshold !== null && (
                  <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg">
                    Current Threshold: <strong>≤ {lowStockThreshold} units</strong>
                  </span>
                )}
                <button
                  onClick={fetchLowStock}
                  className="px-3.5 py-1.5 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Refresh
                </button>
              </div>
            </div>

            {lowStockLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : lowStock.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-gray-400">
                <span className="text-4xl mb-2">✅</span>
                <p className="font-medium text-gray-600">No low-stock products found</p>
                <p className="text-xs text-gray-400 mt-1">All eligible stock items are currently above threshold.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600">
                      <th className="text-left px-4 py-3">Product / Variation</th>
                      <th className="text-left px-4 py-3">Category</th>
                      <th className="text-left px-4 py-3">Owner / Seller</th>
                      <th className="text-left px-4 py-3">Channel</th>
                      <th className="text-right px-4 py-3">Current Stock</th>
                      <th className="text-center px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lowStock.map(p => (
                      <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.mainImage && (
                              <img
                                src={resolveImageUrl(p.mainImage)}
                                alt=""
                                className="w-10 h-10 object-cover rounded-lg border border-gray-100"
                              />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-gray-900 leading-tight">{p.productName}</p>
                                {p.variationTitle && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    {p.variationTitle}
                                  </span>
                                )}
                              </div>
                              {p.sku && <p className="text-xs text-gray-400 mt-0.5 font-mono">SKU: {p.sku}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.category?.name || "–"}</td>
                        <td className="px-4 py-3">
                          {p.ownerType === "PLATFORM" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Admin / Platform Inventory
                            </span>
                          ) : (
                            <div>
                              <p className="font-semibold text-gray-900 text-xs leading-tight">
                                {p.ownerLabel || p.seller?.storeName || p.seller?.sellerName}
                              </p>
                              {p.seller?.sellerName && p.seller?.storeName && p.seller.sellerName !== p.seller.storeName && (
                                <p className="text-[11px] text-gray-500">{p.seller.sellerName}</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.productType === "QUICK_COMMERCE" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {p.productType === "QUICK_COMMERCE" ? "QC" : "EC"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div>
                            <span className={`font-bold font-mono text-base ${p.stock === 0 ? "text-red-600" : "text-amber-600"}`}>
                              {p.stock}
                            </span>
                            {p.stock === 0 && (
                              <span className="block text-[10px] font-semibold text-red-500 uppercase tracking-wider">
                                Sold out
                              </span>
                            )}
                            <p className="text-[10px] text-gray-400 font-medium">Threshold: ≤ {p.threshold ?? lowStockThreshold ?? 10}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {p.ownerType === "PLATFORM" ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                              Platform Inventory
                            </span>
                          ) : !p.seller?._id ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200">
                              No Vendor Info
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              {sentAlertIds.has(p._id) ? (
                                <div className="inline-flex items-center gap-1">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ✓ Alert Sent
                                  </span>
                                  <button
                                    onClick={() => handleSendVendorAlert(p)}
                                    disabled={sendingAlertIds.has(p._id)}
                                    title="Resend low stock alert"
                                    className="p-1 text-gray-400 hover:text-amber-600 rounded transition-colors disabled:opacity-40"
                                  >
                                    🔄
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleSendVendorAlert(p)}
                                  disabled={sendingAlertIds.has(p._id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  title="Send low-stock push notification to vendor"
                                >
                                  {sendingAlertIds.has(p._id) ? (
                                    <>
                                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>Sending...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>🔔</span>
                                      <span>Send Alert</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {lowStockTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">Page {lowStockPage} of {lowStockTotalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setLowStockPage(p => Math.max(1, p - 1))} disabled={lowStockPage === 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
                  <button onClick={() => setLowStockPage(p => Math.min(lowStockTotalPages, p + 1))} disabled={lowStockPage === lowStockTotalPages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BARCODE TAB */}
        {activeTab === "barcode" && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">POS Barcode Lookup</h2>
              <p className="text-sm text-gray-500 mb-4">Scan or type a barcode to find the product, variant, and authoritative stock</p>
              <form onSubmit={handleBarcodeSearch} className="flex gap-2">
                <input
                  ref={barcodeRef}
                  type="text"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode or type and press Enter..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={barcodeLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {barcodeLoading ? "..." : "Lookup"}
                </button>
              </form>

              {barcodeResult && (
                <div className="mt-5">
                  {barcodeResult.notFound ? (
                    <div className="flex flex-col items-center py-8 text-gray-400">
                      <span className="text-4xl mb-2">🔍</span>
                      <p className="font-medium">No product found</p>
                      <p className="text-sm mt-1">Barcode: <code className="font-mono bg-gray-100 px-1 rounded">{barcodeInput}</code></p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-4 p-4 bg-gray-50 border-b border-gray-100">
                        {barcodeResult.product?.mainImage && (
                          <img src={resolveImageUrl(barcodeResult.product.mainImage)} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{barcodeResult.product?.productName}</p>
                          <p className="text-sm text-gray-500 font-medium">
                            Owner: <span className="text-gray-900">{barcodeResult.product?.ownerLabel || barcodeResult.product?.sellerName || barcodeResult.product?.seller || "–"}</span>
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${barcodeResult.product?.productType === "QUICK_COMMERCE" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {barcodeResult.product?.productType}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-4">
                        <div className="bg-indigo-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-indigo-600 font-medium mb-1">Current Stock</p>
                          <p className="text-2xl font-bold text-indigo-700">{barcodeResult.currentStock ?? "–"}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 font-medium mb-1">Price</p>
                          <p className="text-2xl font-bold text-gray-700">₹{barcodeResult.product?.price ?? "–"}</p>
                        </div>
                        {barcodeResult.selectedVariation && (
                          <div className="col-span-2 bg-amber-50 rounded-lg p-3">
                            <p className="text-xs text-amber-700 font-medium mb-1">Matched Variation</p>
                            <p className="text-sm font-medium text-amber-900">
                              {barcodeResult.selectedVariation.name}: {barcodeResult.selectedVariation.value}
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              Variation Stock: <strong>{barcodeResult.selectedVariation.stock}</strong>
                              {barcodeResult.selectedVariation.sku && ` | SKU: ${barcodeResult.selectedVariation.sku}`}
                            </p>
                          </div>
                        )}
                        {barcodeResult.product?.wholesaleEnabled && (
                          <div className="col-span-2 bg-orange-50 rounded-lg p-3">
                            <p className="text-xs text-orange-700 font-medium mb-1">🏭 Wholesale</p>
                            <p className="text-sm text-orange-800">
                              Price: ₹{barcodeResult.product.wholesalePrice} | MOQ: {barcodeResult.product.wholesaleMinimumQuantity} units
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hardware Barcode Scanner Guide Box */}
              <div className="mt-6 border-t border-gray-100 pt-4 bg-gray-50/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <span>📟</span> How Hardware Barcode Scanners Work
                </p>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li><strong>Plug & Play (HID Keyboard):</strong> Connect your USB cable or wireless 2.4G/Bluetooth scanner dongle. No special software is needed.</li>
                  <li><strong>Instant Auto-Lookup:</strong> With this tab open, aim the scanner at any product barcode and pull the trigger. The scanner automatically types the digits and presses <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Enter</kbd>.</li>
                  <li><strong>Continuous Hands-Free Scanning:</strong> The input automatically re-selects after each scan, allowing rapid sequential item lookups.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ADJUST TAB */}
        {activeTab === "adjust" && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Manual Stock Adjustment</h2>
              <p className="text-sm text-gray-500 mb-4">
                Use this to correct stock discrepancies, record damage, or add new stock arrivals.
                All mutations are recorded in the immutable inventory ledger.
              </p>

              {/* Mode selector */}
              <div className="flex gap-2 mb-5">
                {[
                  { key: "adjust", label: "Adjust", color: "indigo" },
                  { key: "damage", label: "Damage", color: "red" },
                  { key: "stock-in", label: "Stock In", color: "green" },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setAdjustForm(f => ({ ...f, mode: m.key as any, delta: 0 }))}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      adjustForm.mode === m.key
                        ? m.key === "damage"
                          ? "bg-red-600 border-red-600 text-white"
                          : m.key === "stock-in"
                            ? "bg-green-600 border-green-600 text-white"
                            : "bg-indigo-600 border-indigo-600 text-white"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Product ID <span className="text-red-500">*</span></label>
                    {adjustProductLoading && (
                      <span className="text-xs text-indigo-600 animate-pulse font-medium">Checking product...</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={adjustForm.productId}
                    onChange={e => setAdjustForm(f => ({ ...f, productId: e.target.value }))}
                    placeholder="MongoDB ObjectId of the product"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>

                {/* Product lookup feedback card */}
                {adjustProduct && (
                  <div>
                    {!isPlatformProduct(adjustProduct) ? (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 flex flex-col gap-1.5">
                        <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                          <span>⚠️</span>
                          <span>Vendor-Owned Item: {adjustProduct.productName}</span>
                        </div>
                        <p>
                          This product belongs to vendor <strong>{typeof adjustProduct.seller === 'object' ? adjustProduct.seller?.storeName || adjustProduct.seller?.sellerName : 'Vendor'}</strong>.
                          Vendors manage their incoming stock directly through the <strong>Vendor Panel</strong> (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono">/seller/product/stock</code>).
                        </p>
                        <p className="text-amber-800 font-medium">
                          Generic admin stock adjustments on vendor inventory are blocked to prevent stock discrepancies. If stock is low, please use the <strong>Low Stock Alert</strong> tab to notify the vendor.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-emerald-800 flex items-center gap-1">
                            <span>✓</span> Platform Inventory
                          </p>
                          <p className="text-emerald-950 font-medium">{adjustProduct.productName}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-medium text-[11px]">
                          Admin Controlled
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Variation selection */}
                {adjustProduct && isPlatformProduct(adjustProduct) && Array.isArray((adjustProduct as any).variations) && (adjustProduct as any).variations.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Variation <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={adjustForm.variationId}
                      onChange={e => setAdjustForm(f => ({ ...f, variationId: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      required
                    >
                      <option value="" disabled>-- Select a variation --</option>
                      {((adjustProduct as any).variations as any[]).map((v: any) => (
                        <option key={v._id || v.id} value={v._id || v.id}>
                          {v.name || "Variant"}: {v.value || v.title} — Current Stock: {v.stock ?? 0} {v.sku ? `(SKU: ${v.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : adjustProduct && isPlatformProduct(adjustProduct) ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-600 flex items-center justify-between">
                    <span>Simple Product (No Variations)</span>
                    <span className="font-semibold text-gray-800">Current Stock: {adjustProduct.stock ?? 0}</span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Variation ID <span className="text-gray-400 text-xs">(optional — leave blank for simple product)</span></label>
                    <input
                      type="text"
                      value={adjustForm.variationId}
                      onChange={e => setAdjustForm(f => ({ ...f, variationId: e.target.value }))}
                      placeholder="Variation ObjectId (if applicable)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {adjustForm.mode === "adjust" ? "Delta (±)" : "Quantity"}
                    {adjustForm.mode === "adjust" && <span className="text-gray-400 text-xs ml-1">(use negative to decrease)</span>}
                  </label>
                  <input
                    type="number"
                    value={adjustForm.delta}
                    onChange={e => setAdjustForm(f => ({ ...f, delta: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note / Reason</label>
                  <input
                    type="text"
                    value={adjustForm.note}
                    onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="e.g. Physical count correction, damaged goods"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  ⚠️ Stock mutations are <strong>permanent and logged</strong> in the immutable ledger.
                </div>
                <button
                  type="submit"
                  disabled={adjustLoading || (!!adjustProduct && !isPlatformProduct(adjustProduct))}
                  className={`w-full py-2.5 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    adjustForm.mode === "damage"
                      ? "bg-red-600 hover:bg-red-700"
                      : adjustForm.mode === "stock-in"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {adjustLoading
                    ? "Processing..."
                    : adjustProduct && !isPlatformProduct(adjustProduct)
                      ? "Vendor Item — Managed in Vendor Panel"
                      : adjustForm.mode === "stock-in"
                        ? "Add Stock"
                        : adjustForm.mode === "damage"
                          ? "Record Damage"
                          : "Apply Adjustment"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
