/**
 * Isolated tests (no database) for delivery partner distance pay.
 *   npx tsx src/scripts/testRiderPay.ts
 */
import assert from "node:assert/strict";
import { computeDistanceRiderPay, effectiveRiderKmRate } from "../services/riderPayService";

const cfg = (c: Record<string, unknown>) => ({ isDistanceBased: true, ...c });

const cases: [string, unknown, number | null | undefined, number | null][] = [
  // New model: own base pay + own base distance + extra per km
  ["₹20 for 3 km + ₹7/km, 5 km ride → 20 + 2×7", cfg({ deliveryBoyBaseCharge: 20, deliveryBoyBaseDistance: 3, deliveryBoyKmRate: 7 }), 5, 34],
  ["₹20 for 3 km + ₹7/km, 2 km ride → base only", cfg({ deliveryBoyBaseCharge: 20, deliveryBoyBaseDistance: 3, deliveryBoyKmRate: 7 }), 2, 20],
  ["₹20 for 3 km + ₹7/km, exactly 3 km → base only", cfg({ deliveryBoyBaseCharge: 20, deliveryBoyBaseDistance: 3, deliveryBoyKmRate: 7 }), 3, 20],
  ["₹20 for 3 km + ₹7/km, 14.72 km road", cfg({ deliveryBoyBaseCharge: 20, deliveryBoyBaseDistance: 3, deliveryBoyKmRate: 7 }), 14.72, 102.04],
  ["base pay only (no per-km)", cfg({ deliveryBoyBaseCharge: 25, deliveryBoyBaseDistance: 5, deliveryBoyKmRate: 0 }), 9, 25],
  // Backward compatible: base fields unset/0 → old distance × rate
  ["old config ₹10/km, 5 km → 50 (unchanged behaviour)", cfg({ deliveryBoyKmRate: 10 }), 5, 50],
  ["old config with explicit zeros", cfg({ deliveryBoyBaseCharge: 0, deliveryBoyBaseDistance: 0, deliveryBoyKmRate: 8 }), 5, 40],
  // Fallback to % commission (null)
  ["no partner pay configured → null (use %)", cfg({}), 5, null],
  ["Fixed Price mode → null", { isDistanceBased: false, deliveryBoyKmRate: 10 }, 5, null],
  // A measured 0 km (customer at the pickup point) still earns the base pay
  ["0 km measured, ₹11 for 1 km + ₹6/km → base ₹11", cfg({ deliveryBoyBaseCharge: 11, deliveryBoyBaseDistance: 1, deliveryBoyKmRate: 6 }), 0, 11],
  ["0 km measured, old per-km-only config → ₹0", cfg({ deliveryBoyKmRate: 10 }), 0, 0],
  ["missing distance → null", cfg({ deliveryBoyKmRate: 10 }), undefined, null],
  ["null distance → null", cfg({ deliveryBoyBaseCharge: 11, deliveryBoyKmRate: 6 }), null, null],
  ["negative distance → null", cfg({ deliveryBoyBaseCharge: 11, deliveryBoyKmRate: 6 }), -1, null],
  ["negative inputs ignored", cfg({ deliveryBoyBaseCharge: -5, deliveryBoyBaseDistance: -2, deliveryBoyKmRate: 6 }), 4, 24],
];

let failed = 0;
for (const [name, config, km, expected] of cases) {
  try {
    assert.equal(computeDistanceRiderPay(config as any, km as any), expected);
    console.log(`PASS ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`FAIL ${name}: ${e.message}`);
  }
}
try {
  assert.equal(effectiveRiderKmRate(34, 5), 6.8);
  assert.equal(effectiveRiderKmRate(34, 0), 0);
  console.log("PASS effective ₹/km for reporting");
} catch (e: any) {
  failed++;
  console.log(`FAIL effective ₹/km: ${e.message}`);
}
console.log(`\nRider pay tests: ${cases.length + 1 - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
