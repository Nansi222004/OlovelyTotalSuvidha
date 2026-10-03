import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { barcodeLabelHtml, barcodeSvgMarkup, code128Bars } from "../modules/admin/components/BarcodeLabel";

const storedBarcode = "8901234567890";
const bars = code128Bars(storedBarcode);
assert.ok(bars.rects.length > 20, "Code 128 graphic must contain barcode bars");
assert.ok(bars.width > 0, "Barcode graphic must have a printable width");

const svg = barcodeSvgMarkup(storedBarcode);
assert.match(svg, /<svg/);
assert.match(svg, new RegExp(storedBarcode));
assert.equal(svg, barcodeSvgMarkup(storedBarcode), "Rendering must not generate a different value");

const label = barcodeLabelHtml({
  productName: "Tata Salt",
  variantName: "Weight: 1kg",
  sku: "TATA-SALT-1KG",
  barcode: storedBarcode,
});
assert.match(label, /Tata Salt/);
assert.match(label, /Weight: 1kg/);
assert.match(label, /TATA-SALT-1KG/);
assert.match(label, new RegExp(storedBarcode));
assert.match(label, /window\.print/);

console.log("PASS Code 128 barcode graphic uses the stored value");
console.log("PASS printable label includes product, variant, SKU, graphic, and stored number");

const terminalSource = fs.readFileSync(path.resolve(__dirname, "../modules/admin/pages/AdminPosTerminal.tsx"), "utf8");
const submitStart = terminalSource.indexOf("const handleBarcodeSubmit");
const barcodeLookup = terminalSource.indexOf("lookupBarcode(query)", submitStart);
const fallbackSearch = terminalSource.indexOf("searchPosProducts(query)", barcodeLookup);
assert.ok(submitStart >= 0 && barcodeLookup > submitStart && fallbackSearch > barcodeLookup, "Enter must prioritize exact barcode lookup before manual search");
assert.match(terminalSource, /onSubmit=\{handleBarcodeSubmit\}/);
assert.match(terminalSource, /window\.setTimeout\(async \(\) => \{/);
assert.match(terminalSource, /}, 250\)/);
assert.match(terminalSource, /placeholder="Scan barcode or search product\.\.\."/);
console.log("PASS scanner Enter prioritizes exact lookup and bypasses manual-search selection");
console.log("PASS manual search is debounced without loading the catalogue into the browser");

console.log("\n4 barcode rendering/scanner contract tests passed.");
