import React, { useMemo } from "react";

const CODE128_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212",
  "112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131",
  "311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321",
  "112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121",
  "313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114",
  "122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212",
  "124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113",
  "114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112",
];

export function code128Bars(value: string, moduleWidth = 2, height = 64) {
  if (!/^[\x20-\x7E]+$/.test(value)) return { width: 0, height, rects: [] as Array<{ x: number; width: number }> };
  const values = Array.from(value).map((character) => character.charCodeAt(0) - 32);
  const checksum = (104 + values.reduce((sum, item, index) => sum + item * (index + 1), 0)) % 103;
  const symbols = [104, ...values, checksum, 106];
  const rects: Array<{ x: number; width: number }> = [];
  let x = moduleWidth * 10;
  symbols.forEach((symbol) => {
    CODE128_PATTERNS[symbol].split("").forEach((digit, index) => {
      const width = Number(digit) * moduleWidth;
      if (index % 2 === 0) rects.push({ x, width });
      x += width;
    });
  });
  return { width: x + moduleWidth * 10, height, rects };
}

export function barcodeSvgMarkup(value: string, height = 64): string {
  const barcode = code128Bars(value, 2, height);
  const bars = barcode.rects.map((bar) => `<rect x="${bar.x}" y="0" width="${bar.width}" height="${height}" fill="#000"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Barcode ${value}" viewBox="0 0 ${barcode.width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}

export function BarcodeGraphic({ value, height = 64 }: { value: string; height?: number }) {
  const markup = useMemo(() => barcodeSvgMarkup(value, height), [value, height]);
  return <div className="w-full overflow-hidden bg-white" dangerouslySetInnerHTML={{ __html: markup }} />;
}

export interface BarcodeLabelData {
  productName: string;
  variantName?: string;
  sku?: string;
  barcode: string;
}

export function barcodeLabelHtml(data: BarcodeLabelData): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
  return `<!doctype html><html><head><title>Barcode label</title><style>
    @page{size:50mm 30mm;margin:2mm}body{font-family:Arial,sans-serif;margin:0;color:#000}.label{text-align:center;width:46mm}.name{font-size:10pt;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta,.number{font-size:7pt;margin-top:1mm}.number{font-family:monospace;letter-spacing:.5px}svg{display:block;width:100%;height:12mm;margin-top:1mm}@media print{button{display:none}}
  </style></head><body><div class="label"><div class="name">${escape(data.productName)}</div>${data.variantName ? `<div class="meta">${escape(data.variantName)}</div>` : ""}${data.sku ? `<div class="meta">SKU: ${escape(data.sku)}</div>` : ""}${barcodeSvgMarkup(data.barcode, 64)}<div class="number">${escape(data.barcode)}</div></div><script>window.onload=()=>{window.print();window.close()}</script></body></html>`;
}

export function printBarcodeLabel(data: BarcodeLabelData) {
  const printWindow = window.open("", "_blank", "width=480,height=420");
  if (!printWindow) throw new Error("Popup blocked. Allow popups to print the barcode label.");
  printWindow.document.write(barcodeLabelHtml(data));
  printWindow.document.close();
}
