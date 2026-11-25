import { useEffect, useState } from "react";
import { getDeliveryBoyById, type DeliveryBoy } from "../../../services/api/admin/adminDeliveryService";
import { resolveImageUrl } from "../../../utils/imageUrl";

interface Props {
  deliveryBoyId: string;
  onClose: () => void;
  /** Approve (Active) / Deactivate (Inactive), reusing the list page's handler. */
  onStatusChange: (id: string, status: "Active" | "Inactive") => Promise<void> | void;
}

const isPdf = (url: string) => /\.pdf(\?|$)/i.test(url);

function DocumentPreview({ label, url }: { label: string; url?: string }) {
  if (!url) {
    return (
      <div className="border rounded-lg p-3 text-xs text-neutral-500">
        <p className="font-semibold text-neutral-700 mb-1">{label}</p>
        Not uploaded
      </div>
    );
  }
  const src = resolveImageUrl(url);
  return (
    <div className="border rounded-lg p-3">
      <p className="font-semibold text-neutral-700 text-xs mb-2">{label}</p>
      {isPdf(url) ? (
        <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 font-semibold hover:underline">
          Open PDF ↗
        </a>
      ) : (
        <a href={src} target="_blank" rel="noopener noreferrer" title="Open full size">
          <img src={src} alt={label} className="w-full max-h-48 object-contain rounded bg-neutral-50" />
        </a>
      )}
    </div>
  );
}

const Row = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100 text-sm">
    <span className="text-neutral-500">{label}</span>
    <span className="font-medium text-neutral-900 text-right break-all">{value || value === 0 ? value : "—"}</span>
  </div>
);

/** Admin → Delivery Boy → eye icon: everything the rider submitted, to check before approving. */
export default function AdminDeliveryBoyDetailsModal({ deliveryBoyId, onClose, onStatusChange }: Props) {
  const [rider, setRider] = useState<(DeliveryBoy & Record<string, any>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getDeliveryBoyById(deliveryBoyId)
      .then((res: any) => alive && setRider(res?.data || null))
      .catch((e: any) => alive && setError(e?.response?.data?.message || e?.message || "Could not load details"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [deliveryBoyId]);

  const changeStatus = async (status: "Active" | "Inactive") => {
    if (!rider) return;
    setSaving(true);
    try {
      await onStatusChange(rider._id, status);
      setRider({ ...rider, status });
    } finally {
      setSaving(false);
    }
  };

  const coords = rider?.location?.coordinates;
  const hasLoc = Array.isArray(coords) && coords.length === 2 && (coords[0] || coords[1]);
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white">
          <h3 className="font-bold text-neutral-900">Delivery Boy Details</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl font-bold px-2">
            ✕
          </button>
        </div>

        {loading && <p className="p-5 text-sm text-neutral-500">Loading…</p>}
        {error && <p className="p-5 text-sm text-red-600">{error}</p>}

        {rider && (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-4">
              {rider.profileImage ? (
                <img src={resolveImageUrl(rider.profileImage)} alt={rider.name} className="w-16 h-16 rounded-full object-cover border" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-2xl font-bold">
                  {rider.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-lg font-bold text-neutral-900">{rider.name}</p>
                <p className="text-sm text-neutral-600">{rider.mobile}{rider.email ? ` · ${rider.email}` : ""}</p>
                <div className="flex gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rider.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                    {rider.status === "Active" ? "Approved / Active" : "Not approved / Inactive"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rider.isOnline ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>
                    {rider.isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-neutral-500 mb-1">Personal</h4>
              <Row label="Date of birth" value={fmtDate(rider.dateOfBirth)} />
              <Row label="Address" value={rider.address} />
              <Row label="City / Pincode" value={[rider.city, rider.pincode].filter(Boolean).join(" · ")} />
              <Row label="Vehicle" value={[rider.vehicleType, rider.vehicleNumber].filter(Boolean).join(" · ")} />
              <Row label="Joined" value={fmtDate(rider.createdAt)} />
              {hasLoc && (
                <div className="py-1.5 text-sm">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Last known location on Google Maps ↗
                  </a>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-neutral-500 mb-2">Documents</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DocumentPreview label="Driving License" url={rider.drivingLicense} />
                <DocumentPreview label="National ID (Aadhaar / other)" url={rider.nationalIdentityCard} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-neutral-500 mb-1">Bank details</h4>
              <Row label="Account holder" value={rider.accountName} />
              <Row label="Bank" value={rider.bankName} />
              <Row label="Account number" value={rider.bankAccountNumber || rider.accountNumber} />
              <Row label="IFSC" value={rider.ifscCode} />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-neutral-500 mb-1">Earnings & cash</h4>
              <Row label="Balance (earnings)" value={`₹${Number(rider.balance || 0).toFixed(2)}`} />
              <Row label="COD cash collected (to hand over)" value={`₹${Number(rider.cashCollected || 0).toFixed(2)}`} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              {rider.status === "Active" ? (
                <button
                  onClick={() => changeStatus("Inactive")}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Deactivate"}
                </button>
              ) : (
                <button
                  onClick={() => changeStatus("Active")}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Approve (Activate)"}
                </button>
              )}
              <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-semibold hover:bg-neutral-50">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
