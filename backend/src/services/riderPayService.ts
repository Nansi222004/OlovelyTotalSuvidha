/**
 * Delivery partner pay for distance-based Quick Commerce deliveries — mirrors the customer fee:
 *
 *   pay = deliveryBoyBaseCharge + max(0, distanceKm − deliveryBoyBaseDistance) × deliveryBoyKmRate
 *
 * With base pay and base distance left at 0 this is exactly the old `distanceKm × deliveryBoyKmRate`.
 * Returns null when distance pay does not apply (not distance mode, no distance recorded, or no
 * partner pay configured), so callers keep their existing % commission fallback.
 */
export interface RiderDistancePayConfig {
  isDistanceBased?: boolean;
  deliveryBoyBaseCharge?: number;
  deliveryBoyBaseDistance?: number;
  deliveryBoyKmRate?: number;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const nonNegative = (v: unknown) => Math.max(0, Number(v) || 0);

export function computeDistanceRiderPay(
  config: RiderDistancePayConfig | null | undefined,
  distanceKm: number | null | undefined,
): number | null {
  const distance = Number(distanceKm);
  if (!config?.isDistanceBased || !Number.isFinite(distance) || distance <= 0) return null;

  const basePay = nonNegative(config.deliveryBoyBaseCharge);
  const baseDistance = nonNegative(config.deliveryBoyBaseDistance);
  const kmRate = nonNegative(config.deliveryBoyKmRate);
  if (basePay <= 0 && kmRate <= 0) return null;

  return round2(basePay + Math.max(0, distance - baseDistance) * kmRate);
}

/** Effective ₹/km for reporting (pay ÷ distance). */
export function effectiveRiderKmRate(pay: number, distanceKm: number): number {
  return distanceKm > 0 ? round2(pay / distanceKm) : 0;
}
