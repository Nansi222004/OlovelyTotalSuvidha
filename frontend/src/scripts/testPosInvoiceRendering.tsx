import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosInvoiceItemRows, PosInvoiceTaxLines } from "../modules/admin/components/PosInvoiceParts";

const items = [{
  id: "item-1",
  productName: "Cadbury Milk",
  variantTitle: "Pack: 100g",
  sku: "CAD-100",
  hsnCode: "1806",
  quantity: 2,
  unitPrice: 175,
  total: 350,
  taxRate: 18,
  taxAmount: 53.39,
}];

const interStateSummary = {
  taxModel: "INTER_STATE" as const,
  businessState: "Madhya Pradesh",
  businessStateCode: "23",
  customerState: "Maharashtra",
  customerStateCode: "27",
  subtotal: 350,
  taxableAmount: 296.61,
  cgst: 0,
  sgst: 0,
  igst: 53.39,
  totalTax: 53.39,
  discount: 0,
  grandTotal: 350,
};

for (const format of ["thermal", "a4"] as const) {
  const html = renderToStaticMarkup(
    <div>
      <table><tbody><PosInvoiceItemRows items={items} format={format} /></tbody></table>
      <PosInvoiceTaxLines summary={interStateSummary} />
    </div>
  );
  assert.match(html, /Cadbury Milk/);
  assert.match(html, /Pack: 100g/);
  assert.match(html, />2</);
  assert.match(html, /175\.00/);
  assert.match(html, /350\.00/);
  assert.match(html, /1806/);
  assert.match(html, /IGST/);
  assert.doesNotMatch(html, /CGST|SGST/);
}

const intraStateHtml = renderToStaticMarkup(
  <PosInvoiceTaxLines summary={{ ...interStateSummary, taxModel: "INTRA_STATE", cgst: 26.69, sgst: 26.70, igst: 0 }} />
);
assert.match(intraStateHtml, /CGST/);
assert.match(intraStateHtml, /SGST/);
assert.doesNotMatch(intraStateHtml, /IGST/);

console.log("POS invoice rendering tests passed: thermal/A4 fields, HSN, mutually exclusive IGST vs CGST/SGST.");
