/**
 * Isolated tests (no database) for the small cart fee and courier shipping rules.
 *   npx tsx src/scripts/testCartCharges.ts
 */
import assert from "node:assert/strict";
import { evaluateSmallCart, evaluateCourierShipping } from "../services/cartChargesService";

let failed = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`FAIL ${name}: ${e.message}`);
  }
};

const feeOn = { minimumOrderValue: 99, smallCartFeeEnabled: true, smallCartFee: 40 };
const feeOff = { minimumOrderValue: 99, smallCartFeeEnabled: false, smallCartFee: 40 };

// ── Small cart fee ─────────────────────────────────────────────────────────────
check("fee mode: ₹20 QC cart → ₹40 fee, not blocked, ₹79 to avoid", () => {
  const r = evaluateSmallCart(feeOn, { qcSubtotal: 20, cartSubtotal: 20 });
  assert.equal(r.blocked, false);
  assert.equal(r.fee, 40);
  assert.equal(r.amountToAvoid, 79);
});
check("fee mode: exactly ₹99 → no fee", () => {
  assert.equal(evaluateSmallCart(feeOn, { qcSubtotal: 99, cartSubtotal: 99 }).fee, 0);
});
check("fee mode: courier-only cart → never a fee, never blocked", () => {
  const r = evaluateSmallCart(feeOn, { qcSubtotal: 0, cartSubtotal: 30 });
  assert.equal(r.fee, 0);
  assert.equal(r.blocked, false);
});
check("fee mode: mixed cart ₹20 QC + ₹800 courier → fee (QC part counts)", () => {
  assert.equal(evaluateSmallCart(feeOn, { qcSubtotal: 20, cartSubtotal: 820 }).fee, 40);
});
check("fee mode ON but fee ₹0 → behaves as blocking (old rule)", () => {
  const r = evaluateSmallCart({ ...feeOn, smallCartFee: 0 }, { qcSubtotal: 20, cartSubtotal: 20 });
  assert.equal(r.blocked, true);
  assert.equal(r.fee, 0);
});
check("fee mode OFF: ₹20 cart → blocked, no fee (old behaviour)", () => {
  const r = evaluateSmallCart(feeOff, { qcSubtotal: 20, cartSubtotal: 20 });
  assert.equal(r.blocked, true);
  assert.equal(r.fee, 0);
  assert.equal(r.amountToAvoid, 79);
});
check("fee mode OFF: ₹150 cart → allowed", () => {
  assert.equal(evaluateSmallCart(feeOff, { qcSubtotal: 150, cartSubtotal: 150 }).blocked, false);
});
check("threshold 0 → nothing blocked, no fee", () => {
  const r = evaluateSmallCart({ ...feeOn, minimumOrderValue: 0 }, { qcSubtotal: 5, cartSubtotal: 5 });
  assert.equal(r.blocked, false);
  assert.equal(r.fee, 0);
});

// ── Courier shipping ───────────────────────────────────────────────────────────
const courier = { ecommerceShippingFee: 40, ecommerceFreeShippingThreshold: 499, freeDeliveryThreshold: 149 };
check("courier ₹300 below courier threshold ₹499 → ₹40, ₹199 to free", () => {
  const r = evaluateCourierShipping(courier, { ecomSubtotal: 300, cartSubtotal: 300 });
  assert.equal(r.fee, 40);
  assert.equal(r.amountToFree, 199);
});
check("courier ₹499 → free", () => {
  assert.equal(evaluateCourierShipping(courier, { ecomSubtotal: 499, cartSubtotal: 499 }).fee, 0);
});
check("courier threshold uses courier items only, not QC items", () => {
  assert.equal(evaluateCourierShipping(courier, { ecomSubtotal: 300, cartSubtotal: 900 }).fee, 40);
});
check("courier threshold 0 → old rule: whole cart vs global threshold", () => {
  const legacy = { ...courier, ecommerceFreeShippingThreshold: 0 };
  assert.equal(evaluateCourierShipping(legacy, { ecomSubtotal: 100, cartSubtotal: 100 }).fee, 40);
  assert.equal(evaluateCourierShipping(legacy, { ecomSubtotal: 100, cartSubtotal: 150 }).fee, 0);
});
check("admin courier fee ₹60 is used", () => {
  assert.equal(evaluateCourierShipping({ ...courier, ecommerceShippingFee: 60 }, { ecomSubtotal: 100, cartSubtotal: 100 }).fee, 60);
});
check("no courier items → ₹0", () => {
  assert.equal(evaluateCourierShipping(courier, { ecomSubtotal: 0, cartSubtotal: 500 }).fee, 0);
});
check("courier fee unset → ₹40 default", () => {
  assert.equal(evaluateCourierShipping({}, { ecomSubtotal: 100, cartSubtotal: 100 }).fee, 40);
});

console.log(`\nCart charge tests: ${failed ? "FAILED" : "all passed"} (${failed} failed)`);
process.exit(failed ? 1 : 0);
