/**
 * READ-ONLY: does delivery pricing really get ROAD distance from Google, or does it silently fall
 * back to straight-line distance? mapService swallows Google errors, so this calls the same Google
 * endpoints directly and prints their error messages.
 *
 *   cd /root/olovelytotal/backend && npx tsx src/scripts/checkRoadDistance.ts
 *   npx tsx src/scripts/checkRoadDistance.ts 23.1137,70.0280 23.0753,70.1337   # from → to (lat,lng)
 */
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import mongoose from "mongoose";
import AppSettings from "../models/AppSettings";
import { calculateDistance as haversineDistance } from "../utils/locationHelper";

const parse = (s: string | undefined, fallback: [number, number]): [number, number] => {
  const [a, b] = String(s || "").split(",").map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : fallback;
};
// Default: Anjar → Gandhidham (≈ 12 km straight line).
const [fromLat, fromLng] = parse(process.argv[2], [23.1137, 70.028]);
const [toLat, toLng] = parse(process.argv[3], [23.0753, 70.1337]);

const mask = (k: string) => (k ? `${k.slice(0, 6)}…${k.slice(-4)} (${k.length} chars)` : "NOT SET");
const gErr = (e: any) =>
  e?.response?.data?.error?.message || e?.response?.data?.error_message || e?.response?.data?.status || e?.message || String(e);

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  const settings: any = await (AppSettings as any).getSettings();
  await mongoose.disconnect();

  const cfg = settings?.deliveryConfig || {};
  const adminKey = String(cfg.googleMapsKey || "").trim();
  const envKey = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  const key = adminKey || envKey;

  console.log(`Delivery mode: ${cfg.isDistanceBased ? "Distance Based" : "Fixed Price"}`);
  console.log(`Key in admin delivery settings: ${mask(adminKey)}`);
  console.log(`Key in server env GOOGLE_MAPS_API_KEY: ${mask(envKey)}`);
  console.log(`Key used for pricing: ${key ? (adminKey ? "admin settings" : "server env") : "NONE → always straight line"}`);

  const straight = haversineDistance(fromLat, fromLng, toLat, toLng);
  console.log(`\nFrom ${fromLat},${fromLng} → ${toLat},${toLng}`);
  console.log(`Straight-line distance: ${straight.toFixed(2)} km`);
  if (!key) process.exit(0);

  let road: number | null = null;
  try {
    const r = await axios.post(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {
        origins: [{ waypoint: { location: { latLng: { latitude: fromLat, longitude: fromLng } } } }],
        destinations: [{ waypoint: { location: { latLng: { latitude: toLat, longitude: toLng } } } }],
        travelMode: "DRIVE",
      },
      { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "originIndex,distanceMeters,status" }, timeout: 8000 }
    );
    const m = Array.isArray(r.data) ? r.data[0]?.distanceMeters : undefined;
    if (m !== undefined) road = m / 1000;
    console.log(`Routes API (route matrix): ${m !== undefined ? `OK → ${(m / 1000).toFixed(2)} km` : `no distance (${JSON.stringify(r.data).slice(0, 200)})`}`);
  } catch (e) {
    console.log(`Routes API (route matrix): FAILED → ${gErr(e)}`);
  }

  if (road === null) {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&key=${encodeURIComponent(key)}`;
      const r = await axios.get(url, { timeout: 8000 });
      const v = r.data?.routes?.[0]?.legs?.[0]?.distance?.value;
      if (r.data?.status === "OK" && v !== undefined) {
        road = v / 1000;
        console.log(`Directions API: OK → ${road.toFixed(2)} km`);
      } else {
        console.log(`Directions API: FAILED → ${r.data?.status} ${r.data?.error_message || ""}`);
      }
    } catch (e) {
      console.log(`Directions API: FAILED → ${gErr(e)}`);
    }
  }

  console.log(
    road !== null
      ? `\n✅ ROAD distance works (${road.toFixed(2)} km vs ${straight.toFixed(2)} km straight line).`
      : "\n❌ Google refused the key from the server → pricing silently uses STRAIGHT-LINE distance."
  );
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e?.message || e);
  process.exit(1);
});
