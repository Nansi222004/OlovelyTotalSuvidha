import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../../context/ToastContext";
import {
  getCourierCodSummary,
  getCourierCodSettlements,
  getCourierCodRemittances,
  verifyCourierCodRemittance,
  cancelCourierCodSettlement,
  type CourierCodSummary,
  type CourierCodSettlementRow,
  type CourierCodRemittanceRow,
} from "../../../services/api/admin/adminCourierCodService";

const inr = (n?: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/**
 * B-4: Shiprocket COD settlement. Sellers of courier COD items are credited ONLY after an admin
 * verifies a remittance here (Shiprocket "Delivered" is not proof of payment).
 */
export default function AdminCourierCod() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<CourierCodSummary | null>(null);
  const [tab, setTab] = useState<"PENDING_REMITTANCE" | "REMITTED" | "CANCELLED" | "BATCHES">("PENDING_REMITTANCE");
  const [rows, setRows] = useState<CourierCodSettlementRow[]>([]);
  const [batches, setBatches] = useState<CourierCodRemittanceRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    reference: "",
    remittanceDate: new Date().toISOString().slice(0, 10),
    amountReceived: "",
    courierCharges: "0",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        getCourierCodSummary(),
        tab === "BATCHES" ? getCourierCodRemittances() : getCourierCodSettlements(tab),
      ]);
      if (s.success) setSummary(s.data);
      if (tab === "BATCHES") setBatches((list as any).data?.rows || []);
      else setRows((list as any).data?.rows || []);
    } catch (e: any) {
      showToast(e?.response?.data?.message || "Failed to load courier COD data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelected(new Set());
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const selectedGross = useMemo(
    () => rows.filter((r) => selected.has(r.order)).reduce((s, r) => s + r.codAmount, 0),
    [rows, selected],
  );
  const expectedReceived = Math.round((selectedGross - (Number(form.courierCharges) || 0)) * 100) / 100;

  const toggle = (orderId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });

  const submit = async () => {
    if (!form.reference.trim()) return showToast("Enter the UTR / Shiprocket remittance reference", "error");
    if (selected.size === 0) return showToast("Select the orders covered by this remittance", "error");
    setSubmitting(true);
    try {
      const res = await verifyCourierCodRemittance({
        reference: form.reference.trim(),
        remittanceDate: form.remittanceDate,
        amountReceived: Number(form.amountReceived),
        courierCharges: Number(form.courierCharges) || 0,
        orderIds: Array.from(selected),
        notes: form.notes || undefined,
      });
      if (res.success) {
        showToast(
          `Verified ${res.data.orders} order(s). Sellers: ${inr(res.data.sellerCreditedAvailable)} available, ${inr(res.data.sellerHeldInEscrow)} in return-window escrow.`,
          "success",
        );
        setForm({ ...form, reference: "", amountReceived: "", courierCharges: "0", notes: "" });
        setSelected(new Set());
        load();
      } else {
        showToast(res.message || "Verification failed", "error");
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || "Verification failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (orderId: string) => {
    const note = window.prompt("Reason / RTO reference (required):");
    if (!note) return;
    try {
      const res = await cancelCourierCodSettlement(orderId, note);
      if (res.success) {
        showToast("Settlement cancelled", "success");
        load();
      } else showToast(res.message || "Cancel failed", "error");
    } catch (e: any) {
      showToast(e?.response?.data?.message || "Cancel failed", "error");
    }
  };

  const cards: [string, string][] = summary
    ? [
        ["COD collected by courier", inr(summary.codCollectedByCourier)],
        ["Pending from Shiprocket", `${inr(summary.codPendingFromCourier)} (${summary.pendingOrders})`],
        ["Received (bank)", inr(summary.amountReceived)],
        ["Courier charges (platform)", inr(summary.courierCharges)],
        ["Seller payable (pending)", inr(summary.sellerPayablePending)],
        ["Seller payable (remitted)", inr(summary.sellerPayableRemitted)],
        ["Platform earning (remitted, net)", inr(summary.platformEarningRemitted)],
        ["Remittance batches", String(summary.remittanceBatches)],
      ]
    : [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Courier COD Settlement</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Cash collected by Shiprocket stays pending until you verify a remittance. Verifying credits sellers through the
          return-window escrow; courier charges are borne by the platform.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([label, value]) => (
          <div key={label} className="bg-white border border-neutral-200 rounded-lg p-3">
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="text-lg font-semibold text-neutral-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["PENDING_REMITTANCE", "REMITTED", "CANCELLED", "BATCHES"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              tab === t ? "bg-teal-600 text-white border-teal-600" : "bg-white text-neutral-700 border-neutral-300"
            }`}>
            {t === "PENDING_REMITTANCE" ? "Pending" : t === "REMITTED" ? "Remitted" : t === "CANCELLED" ? "Cancelled" : "Remittance batches"}
          </button>
        ))}
      </div>

      {tab === "PENDING_REMITTANCE" && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold text-neutral-900">Verify a Shiprocket remittance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input className="border rounded px-3 py-2 text-sm" placeholder="UTR / remittance reference"
              value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            <input className="border rounded px-3 py-2 text-sm" type="date"
              value={form.remittanceDate} onChange={(e) => setForm({ ...form, remittanceDate: e.target.value })} />
            <input className="border rounded px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="Courier charges deducted"
              value={form.courierCharges} onChange={(e) => setForm({ ...form, courierCharges: e.target.value })} />
            <input className="border rounded px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="Amount received in bank"
              value={form.amountReceived} onChange={(e) => setForm({ ...form, amountReceived: e.target.value })} />
          </div>
          <input className="border rounded px-3 py-2 text-sm w-full" placeholder="Notes (optional)"
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <p className="text-sm text-neutral-700">
            Selected {selected.size} order(s): COD {inr(selectedGross)} − charges {inr(Number(form.courierCharges) || 0)} ={" "}
            <strong>{inr(expectedReceived)}</strong> expected in bank.
            {form.amountReceived !== "" && Math.abs(expectedReceived - Number(form.amountReceived)) > 0.01 && (
              <span className="text-red-600 ml-2">Does not match the amount received.</span>
            )}
          </p>
          <button onClick={submit} disabled={submitting}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
            {submitting ? "Verifying…" : "Verify & settle selected orders"}
          </button>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-neutral-500">Loading…</div>
        ) : tab === "BATCHES" ? (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr>
                <th className="text-left p-3">Reference</th><th className="text-left p-3">Date</th>
                <th className="text-right p-3">Orders</th><th className="text-right p-3">Gross COD</th>
                <th className="text-right p-3">Charges</th><th className="text-right p-3">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.map((b) => (
                <tr key={b._id}>
                  <td className="p-3 font-medium">{b.reference}</td><td className="p-3">{fmtDate(b.remittanceDate)}</td>
                  <td className="p-3 text-right">{b.lines.length}</td><td className="p-3 text-right">{inr(b.grossCodAmount)}</td>
                  <td className="p-3 text-right">{inr(b.courierCharges)}</td><td className="p-3 text-right">{inr(b.amountReceived)}</td>
                </tr>
              ))}
              {batches.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-neutral-500">No remittances yet.</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr>
                {tab === "PENDING_REMITTANCE" && <th className="p-3" />}
                <th className="text-left p-3">Order</th><th className="text-left p-3">AWB</th>
                <th className="text-left p-3">Delivered</th><th className="text-right p-3">COD</th>
                <th className="text-right p-3">Seller payable</th><th className="text-right p-3">Platform</th>
                <th className="text-left p-3">{tab === "REMITTED" ? "Remittance" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r._id}>
                  {tab === "PENDING_REMITTANCE" && (
                    <td className="p-3"><input type="checkbox" checked={selected.has(r.order)} onChange={() => toggle(r.order)} /></td>
                  )}
                  <td className="p-3 font-medium">{r.orderNumber}</td>
                  <td className="p-3 text-xs">{r.awbCodes?.join(", ") || "—"}</td>
                  <td className="p-3">{fmtDate(r.deliveredAt)}</td>
                  <td className="p-3 text-right">{inr(r.codAmount)}</td>
                  <td className="p-3 text-right">{inr(r.sellerPayable)}</td>
                  <td className="p-3 text-right">{inr(r.platformEarning)}</td>
                  <td className="p-3 text-xs">
                    {tab === "REMITTED"
                      ? `${r.remittance?.reference || ""} (${fmtDate(r.remittedAt)})`
                      : tab === "PENDING_REMITTANCE"
                        ? <button onClick={() => cancel(r.order)} className="text-red-600 hover:underline">Cancel (RTO)</button>
                        : r.history?.[r.history.length - 1]?.note || "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-neutral-500">Nothing here.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
