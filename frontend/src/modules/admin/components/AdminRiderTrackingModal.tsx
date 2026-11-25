import { useCallback, useEffect, useState } from "react";
import LiveTrackingMap from "../../../components/LiveTrackingMap";
import { getOrderById } from "../../../services/api/admin/adminOrderService";
import { getDeliveryBoyById } from "../../../services/api/admin/adminDeliveryService";
import { getAppSettings } from "../../../services/api/admin/adminSettingsService";

interface Props {
  orderId: string;
  onClose: () => void;
}

type LatLng = { lat: number; lng: number };

const toLatLng = (lat: unknown, lng: unknown): LatLng | null => {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && (a !== 0 || b !== 0) ? { lat: a, lng: b } : null;
};

const kmBetween = (a: LatLng, b: LatLng) => {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const x = r(b.lat - a.lat);
  const y = r(b.lng - a.lng);
  const h = Math.sin(x / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

const minutesAgo = (iso?: string) => {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
};

/**
 * Admin → Delivery Tracking → "Track": where the rider is now (last GPS the rider app sent),
 * plus the pickup point and the customer. Refreshes every 15 seconds.
 */
export default function AdminRiderTrackingModal({ orderId, onClose }: Props) {
  const [order, setOrder] = useState<any>(null);
  const [rider, setRider] = useState<any>(null);
  const [store, setStore] = useState<LatLng | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const orderRes: any = await getOrderById(orderId);
      const o = orderRes?.data?.order || orderRes?.data;
      if (!o) throw new Error("Order not found");
      setOrder(o);

      const riderId = typeof o.deliveryBoy === "object" ? o.deliveryBoy?._id : o.deliveryBoy;
      if (riderId) {
        const riderRes: any = await getDeliveryBoyById(String(riderId));
        setRider(riderRes?.data || null);
      }

      if (!store) {
        const s: any = await getAppSettings();
        const wh = s?.data?.platformQuickCommerceFulfillment;
        setStore(toLatLng(wh?.latitude, wh?.longitude));
      }
      setError("");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Could not load tracking");
    } finally {
      setLoading(false);
    }
  }, [orderId, store]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const addr = order?.deliveryAddress || {};
  const customer = toLatLng(addr.latitude, addr.longitude);
  const coords = rider?.location?.coordinates;
  const riderPos = Array.isArray(coords) && coords.length === 2 ? toLatLng(coords[1], coords[0]) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <h3 className="font-bold text-neutral-900">Live Tracking · {order?.orderNumber || ""}</h3>
            <p className="text-xs text-neutral-500">
              {rider ? `${rider.name} · ${rider.mobile}` : "No rider assigned"} · Status: {order?.status || "-"}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl font-bold px-2">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          {loading && <p className="text-sm text-neutral-500">Loading map…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && !error && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-neutral-100">🏪 Pickup {store ? "" : "(location not set)"}</span>
                <span className="px-2 py-1 rounded bg-neutral-100">📍 Customer {customer ? "" : "(no pin on address)"}</span>
                <span className={`px-2 py-1 rounded ${riderPos ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                  🛵 Rider {riderPos ? `· last update ${minutesAgo(rider?.updatedAt)}` : "· no GPS received yet"}
                </span>
                <span className="px-2 py-1 rounded bg-neutral-50 text-neutral-500">Refreshes every 15 s</span>
              </div>

              {store && customer ? (
                <div className="h-[420px] rounded-lg overflow-hidden border">
                  <LiveTrackingMap
                    storeLocation={store}
                    customerLocation={customer}
                    deliveryLocation={riderPos || undefined}
                    isTracking={Boolean(riderPos)}
                    heightClass="h-full"
                  />
                </div>
              ) : (
                <p className="text-sm text-neutral-600">
                  The map needs both the pickup (warehouse) location and the customer's address pin.
                </p>
              )}

              {riderPos && (store || customer) && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {store && (
                    <div className="rounded-lg bg-neutral-50 px-3 py-2">
                      <p className="text-[11px] text-neutral-500">Rider ↔ pickup</p>
                      <p className="font-semibold">{fmtKm(kmBetween(riderPos, store))}</p>
                    </div>
                  )}
                  {customer && (
                    <div className="rounded-lg bg-neutral-50 px-3 py-2">
                      <p className="text-[11px] text-neutral-500">Rider ↔ customer</p>
                      <p className="font-semibold">{fmtKm(kmBetween(riderPos, customer))}</p>
                    </div>
                  )}
                </div>
              )}

              {riderPos && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${riderPos.lat},${riderPos.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm font-semibold text-blue-600 hover:underline"
                >
                  Open rider location in Google Maps ↗
                </a>
              )}
              <p className="text-[11px] text-neutral-400">
                The rider's position comes from the delivery app's GPS while the order is open on his phone.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
