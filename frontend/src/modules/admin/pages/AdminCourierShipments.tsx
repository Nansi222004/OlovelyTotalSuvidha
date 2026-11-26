import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../../../context/ToastContext";
import {
  getCourierShipments,
  type CourierShipmentRow,
  type CourierShipmentStage,
} from "../../../services/api/admin/adminOrderService";

type Tab = CourierShipmentStage | "all";

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: "awaiting_pickup", label: "Awaiting pickup", hint: "Booked with the courier; the courier will come to the pickup address." },
  { key: "in_transit", label: "In transit", hint: "Picked up by the courier and on the way (includes NDR / action required)." },
  { key: "not_booked", label: "Booking failed", hint: "The app tried to book a courier but got no Shiprocket order back. No courier will come." },
  { key: "delivered", label: "Delivered", hint: "Delivered by the courier." },
  { key: "rto", label: "RTO", hint: "Returned to origin by the courier." },
  { key: "cancelled", label: "Cancelled", hint: "Booking cancelled; no pickup." },
  { key: "all", label: "All", hint: "Every courier booking." },
];

const STAGE_BADGE: Record<CourierShipmentStage, string> = {
  awaiting_pickup: "bg-amber-50 text-amber-800 border-amber-200",
  in_transit: "bg-blue-50 text-blue-800 border-blue-200",
  not_booked: "bg-neutral-100 text-neutral-700 border-neutral-300",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rto: "bg-purple-50 text-purple-800 border-purple-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STAGE_LABEL: Record<CourierShipmentStage, string> = {
  awaiting_pickup: "Awaiting pickup",
  in_transit: "In transit",
  not_booked: "Booking failed",
  delivered: "Delivered",
  rto: "RTO",
  cancelled: "Cancelled",
};

const inr = (n?: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDateTime = (d?: string) =>
  d
    ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

export default function AdminCourierShipments() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("awaiting_pickup");
  const [rows, setRows] = useState<CourierShipmentRow[]>([]);
  const [counts, setCounts] = useState<Partial<Record<CourierShipmentStage, number>>>({});
  const [warnings, setWarnings] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getCourierShipments({ stage: tab, page, limit: 20, search: search || undefined });
      if (res.success && res.data) {
        setRows(res.data.rows);
        setCounts(res.data.counts);
        setWarnings(res.data.warnings);
        setPages(res.data.pagination.pages);
        setTotal(res.data.pagination.total);
      } else {
        showToast(res.message || "Failed to load courier shipments", "error");
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || "Failed to load courier shipments", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, search]);

  const allCount = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
  const activeHint = TABS.find((t) => t.key === tab)?.hint;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Courier Shipments</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Every order booked with Shiprocket. <strong>Awaiting pickup</strong> means a courier is scheduled to come to the
            pickup address.
          </p>
        </div>
        <input
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72"
          placeholder="Search order no., AWB, Shiprocket ID, customer"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {warnings > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          ⚠️ <strong>{warnings}</strong> shipment(s) belong to orders that are cancelled in the app but are still live at
          Shiprocket — a courier may still come. Cancel them in the Shiprocket dashboard (rows marked “Order cancelled”).
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n = t.key === "all" ? allCount : counts[t.key as CourierShipmentStage] || 0;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border flex items-center gap-2 ${
                active ? "bg-teal-600 text-white border-teal-600" : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              {t.label}
              <span
                className={`text-xs px-1.5 rounded-full ${
                  active
                    ? "bg-white/20"
                    : t.key === "awaiting_pickup" && n > 0
                      ? "bg-amber-100 text-amber-800"
                      : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
      {activeHint && <p className="text-xs text-neutral-500 -mt-2">{activeHint}</p>}

      <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-neutral-500">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Pickup from</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Courier / AWB</th>
                <th className="text-left p-3">Shipment status</th>
                <th className="text-right p-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={`${r.orderId}-${r.groupId}`} className="align-top hover:bg-neutral-50/60">
                  <td className="p-3">
                    <Link to={`/admin/orders/${r.orderId}`} className="font-mono text-xs font-semibold text-teal-700 hover:underline">
                      {r.orderNumber}
                    </Link>
                    <div className="text-xs text-neutral-500 mt-0.5">{fmtDateTime(r.createdAt)}</div>
                    <div className="text-xs text-neutral-500">Order: {r.orderStatus}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-neutral-800">
                      {r.seller?.storeName || "—"}
                      {r.seller?.isPlatform && (
                        <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                          PLATFORM
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {[r.seller?.pickupCity, r.seller?.pickupPincode].filter(Boolean).join(" - ") || "—"}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-neutral-800">{r.customerName || "—"}</div>
                    <div className="text-xs text-neutral-500">{r.customerPhone || ""}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-neutral-800">{r.carrier || "—"}</div>
                    {r.awbNumber ? (
                      <a
                        href={r.trackingUrl || `https://shiprocket.co/tracking/${r.awbNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-700 hover:underline"
                      >
                        {r.awbNumber}
                      </a>
                    ) : (
                      <div className="text-xs text-neutral-400">No AWB</div>
                    )}
                    {r.externalOrderId && <div className="text-[11px] text-neutral-500">Shiprocket #{r.externalOrderId}</div>}
                  </td>
                  <td className="p-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${STAGE_BADGE[r.stage]}`}>
                      {STAGE_LABEL[r.stage]}
                    </span>
                    {r.carrierStatus && (
                      <div className="text-[11px] text-neutral-500 mt-1">Courier status: {r.carrierStatus}</div>
                    )}
                    {r.orderClosedButShipmentLive && (
                      <div className="text-[11px] font-semibold text-red-700 mt-1">
                        ⚠️ Order {r.orderStatus.toLowerCase()} — cancel in Shiprocket
                      </div>
                    )}
                    {r.lastError && <div className="text-[11px] text-red-600 mt-1 max-w-xs">{r.lastError}</div>}
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-semibold">{inr(r.total)}</div>
                    <div className="text-xs text-neutral-500">
                      {r.paymentMethod}
                      {r.codAmount ? ` · COD ${inr(r.codAmount)}` : ""}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-neutral-500">
                    {tab === "awaiting_pickup" ? "No courier pickups scheduled." : "Nothing here."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">
            Page {page} of {pages} · {total} shipment(s)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
