import React from "react";
import type { PosCheckoutResponse } from "../../../services/api/admin/adminInventoryService";

type PosSaleData = PosCheckoutResponse["data"];

export function PosInvoiceItemRows({
  items,
  format,
}: {
  items: PosSaleData["items"];
  format: "thermal" | "a4";
}) {
  return (
    <>
      {items.map((item, index) => format === "thermal" ? (
        <tr key={item.id || index} className="py-1">
          <td className="py-1 pr-1">
            <div className="font-bold">{item.productName}</div>
            {item.variantTitle && <div className="text-[10px] text-slate-500">{item.variantTitle}</div>}
            <div className="text-[9px] text-slate-500">HSN: {item.hsnCode || "Not configured"}</div>
          </td>
          <td className="text-center py-1">{item.quantity}</td>
          <td className="text-right py-1">₹{item.unitPrice.toFixed(2)}</td>
          <td className="text-right py-1 font-semibold">₹{item.total.toFixed(2)}</td>
        </tr>
      ) : (
        <tr key={item.id || index}>
          <td className="p-2">{index + 1}</td>
          <td className="p-2 font-medium">{item.productName} {item.variantTitle && `(${item.variantTitle})`}</td>
          <td className="p-2">{item.hsnCode || "Not configured"}</td>
          <td className="p-2 text-center">{item.quantity}</td>
          <td className="p-2 text-right">₹{item.unitPrice.toFixed(2)}</td>
          <td className="p-2 text-right">{item.taxRate || 0}%</td>
          <td className="p-2 text-right font-bold">₹{item.total.toFixed(2)}</td>
        </tr>
      ))}
    </>
  );
}

export function PosInvoiceTaxLines({ summary }: { summary: PosSaleData["taxSummary"] }) {
  if (summary.taxModel === "INTRA_STATE") {
    return (
      <>
        <div className="flex justify-between"><span>CGST:</span><span>₹{summary.cgst.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>SGST:</span><span>₹{summary.sgst.toFixed(2)}</span></div>
      </>
    );
  }
  if (summary.taxModel === "INTER_STATE") {
    return <div className="flex justify-between"><span>IGST:</span><span>₹{summary.igst.toFixed(2)}</span></div>;
  }
  return null;
}
