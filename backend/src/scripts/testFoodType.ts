/**
 * Isolated tests (no database) for the veg / non-veg product mark.
 *   npx tsx src/scripts/testFoodType.ts
 */
import assert from "node:assert/strict";
import Product from "../models/Product";
import { normalizeFoodType, applyFoodType } from "../utils/foodType";

let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); console.log(`PASS ${name}`); } catch (e: any) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
};

check("VEG variants", () => {
  for (const v of ["VEG", "veg", " Veg ", "vegetarian"]) assert.equal(normalizeFoodType(v), "VEG");
});
check("NON_VEG variants (egg counts as non-veg)", () => {
  for (const v of ["NON_VEG", "non-veg", "Non Veg", "nonveg", "egg", "EGG"]) assert.equal(normalizeFoodType(v), "NON_VEG");
});
check("cleared values → null (not a food item)", () => {
  for (const v of ["", "none", "NA", null, "garbage"]) assert.equal(normalizeFoodType(v as any), null);
});
check("not sent → undefined (keep stored value)", () => {
  assert.equal(normalizeFoodType(undefined), undefined);
  const d: any = { productName: "x" };
  applyFoodType(d);
  assert.equal("foodType" in d, false);
});
check("applyFoodType normalises in place", () => {
  const d: any = { foodType: "non-veg" };
  applyFoodType(d);
  assert.equal(d.foodType, "NON_VEG");
});
check("schema accepts VEG / NON_VEG / null and rejects other values", () => {
  const base = { productName: "Test" };
  for (const ok of ["VEG", "NON_VEG", null]) {
    const err = new Product({ ...base, foodType: ok }).validateSync();
    assert.equal(err?.errors?.foodType, undefined, `should accept ${ok}`);
  }
  const bad = new Product({ ...base, foodType: "EGGY" }).validateSync();
  assert.ok(bad?.errors?.foodType, "should reject EGGY");
});
check("default is null (existing products show no mark)", () => {
  assert.equal(new Product({ productName: "Old" }).foodType, null);
});

console.log(`\nFood type tests: ${failed ? "FAILED" : "all passed"} (${failed} failed)`);
process.exit(failed ? 1 : 0);
