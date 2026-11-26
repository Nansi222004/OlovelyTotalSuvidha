/**
 * Isolated tests (no database) for resolveProductTaxRate.
 *   npx tsx src/scripts/testProductTaxRate.ts
 */
import assert from "node:assert/strict";
import Tax from "../models/Tax";
import { resolveProductTaxRate } from "../services/productTaxService";

const GST_ON = { gstEnabled: true, gstRate: 18 };
const GST_OFF = { gstEnabled: false, gstRate: 18 };

const TAX_5 = "6ab66497daf751f70f2155da"; // ends in digits: must never be parsed as "2155%"
const TAX_0 = "6ab66497daf751f70f2155db";
const TAX_INACTIVE = "6ab66497daf751f70f215512";
const TAX_DELETED = "6ab66497daf751f70f215599";

const taxes: Record<string, { percentage: number; status: string }> = {
  [TAX_5]: { percentage: 5, status: "Active" },
  [TAX_0]: { percentage: 0, status: "Active" },
  [TAX_INACTIVE]: { percentage: 12, status: "Inactive" },
};
(Tax as any).findById = (id: string) => {
  const doc = taxes[String(id)] ?? null;
  const q: any = { select: () => q, session: () => q, lean: async () => doc };
  return q;
};

const cases: [string, unknown, any, number][] = [
  ["selected Tax (5%) wins over default 18%", TAX_5, GST_ON, 5],
  ["selected Tax applies even when GST default is off", TAX_5, GST_OFF, 5],
  ["0% Tax (exempt) stays 0%, not 18%", TAX_0, GST_ON, 0],
  ["inactive Tax falls back to default 18% (never parses the id)", TAX_INACTIVE, GST_ON, 18],
  ["deleted Tax falls back to default 18% (never parses the id)", TAX_DELETED, GST_ON, 18],
  ["deleted Tax with GST off → 0", TAX_DELETED, GST_OFF, 0],
  ["no tax → default 18%", undefined, GST_ON, 18],
  ["empty tax → default 18%", "", GST_ON, 18],
  ["no tax, GST off → 0", undefined, GST_OFF, 0],
  ["legacy text '5%'", "5%", GST_ON, 5],
  ["legacy text 'GST 12%'", "GST 12%", GST_ON, 12],
  ["legacy text '0%' → 0", "0%", GST_ON, 0],
  ["populated Tax object", { name: "SPICES ALL PRODUCT", percentage: 5 }, GST_ON, 5],
  ["garbage text → default", "SPICES ALL PRODUCT", GST_ON, 18],
];

(async () => {
  let failed = 0;
  for (const [name, raw, settings, expected] of cases) {
    try {
      assert.equal(await resolveProductTaxRate(raw, settings), expected);
      console.log(`PASS ${name}`);
    } catch (e: any) {
      failed++;
      console.log(`FAIL ${name}: ${e.message}`);
    }
  }
  console.log(`\nProduct tax rate tests: ${cases.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
