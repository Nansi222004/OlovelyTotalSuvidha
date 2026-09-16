import { useState, useEffect, useRef } from "react";
import {
  getInventoryTransactions,
  getLowStockProducts,
  lookupBarcode,
  adjustStock,
  recordDamage,
  addStock,
  type InventoryTransaction,
  type LowStockProduct,
} from "../../../services/api/admin/adminInventoryService";
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

export default function AdminInventoryLedger() {
  const [activeTab, setActiveTab] = useState<Tab>("ledger");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Ledger tab
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);

  // Low stock tab
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | null>(null);

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

  // Load data on tab change
  useEffect(() => {
    setError("");
    if (activeTab === "ledger") fetchLedger();
    else if (activeTab === "lowstock") fetchLowStock();
    else if (activeTab === "barcode") {
      setTimeout(() => barcodeRef.current?.focus(), 50);
    }
  }, [activeTab, ledgerPage, typeFilter]);

  const fetchLedger = async () => {
    try {
      setLedgerLoading(true);
      setError("");
      const params: Record<string, any> = { page: ledgerPage, limit: 50 };
      if (typeFilter !== "ALL") params.type = typeFilter;
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
      const data = await getLowStockProducts({ page: 1, limit: 100 });
      setLowStock(data.data || []);
      setLowStockThreshold(data.threshold ?? null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load low-stock products");
    } finally {
      setLowStockLoading(false);
    }
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
      if (activeTab === "ledger") fetchLedger();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update stock");
    } finally {
      setAdjustLoading(false);
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
            Track stock movements, view transaction ledger, and perform POS barcode lookups
          </p>
        </div>

        {/* Alerts */}
        {success && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            ✅ {success}
            <button onClick={() => setSuccess("")} className="ml-auto">✕</button>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            ⚠️ {error}
            <button onClick={() => setError("")} className="ml-auto">✕</button>
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
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-center">
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setLedgerPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={fetchLedger}
                className="ml-auto px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
                <p>No transactions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Before</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">After</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Reference</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Note</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map(tx => (
                      <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {tx.product?.mainImage && (
                              <img src={resolveImageUrl(tx.product.mainImage)} alt="" className="w-8 h-8 object-cover rounded border border-gray-100" />
                            )}
                            <div>
                              <p className="font-medium text-gray-900 text-xs leading-tight">
                                {tx.product?.productName || "–"}
                              </p>
                              {tx.variationName && <p className="text-xs text-gray-400">{tx.variationName}</p>}
                            </div>
                          </div>
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
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {lowStockThreshold !== null && (
                  <span>Threshold: <strong>≤ {lowStockThreshold} units</strong> (configurable in App Settings)</span>
                )}
              </span>
              <button onClick={fetchLowStock} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Refresh
              </button>
            </div>
            {lowStockLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : lowStock.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-gray-400">
                <span className="text-4xl mb-2">✅</span>
                <p>No low-stock products</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Seller</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Channel</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lowStock.map(p => (
                      <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {p.mainImage && <img src={resolveImageUrl(p.mainImage)} alt="" className="w-9 h-9 object-cover rounded border border-gray-100" />}
                            <div>
                              <p className="font-medium text-gray-900">{p.productName}</p>
                              {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.category?.name || "–"}</td>
                        <td className="px-4 py-3 text-gray-600">{p.seller?.storeName || "–"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.productType === "QUICK_COMMERCE" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {p.productType === "QUICK_COMMERCE" ? "QC" : "EC"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold font-mono ${p.stock === 0 ? "text-red-600" : "text-orange-600"}`}>
                            {p.stock}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BARCODE TAB */}
        {activeTab === "barcode" && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">POS Barcode Lookup</h2>
              <p className="text-sm text-gray-500 mb-4">Scan or type a barcode to find the product and current stock</p>
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
                          <p className="text-sm text-gray-500">Seller: {barcodeResult.product?.seller || "–"}</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={adjustForm.productId}
                    onChange={e => setAdjustForm(f => ({ ...f, productId: e.target.value }))}
                    placeholder="MongoDB ObjectId of the product"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
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
                  ⚠️ Stock mutations are <strong>permanent and logged</strong>. Ensure the product ID and quantity are correct before submitting.
                </div>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className={`w-full py-2.5 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 ${
                    adjustForm.mode === "damage"
                      ? "bg-red-600 hover:bg-red-700"
                      : adjustForm.mode === "stock-in"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {adjustLoading ? "Processing..." : adjustForm.mode === "stock-in" ? "Add Stock" : adjustForm.mode === "damage" ? "Record Damage" : "Apply Adjustment"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
