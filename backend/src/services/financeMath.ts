/**
 * Single source of truth for item-level money rules.
 *
 * B-3 (finalised 2026-11-12):
 *   Seller commission = round2(taxable value × rate / 100)
 *   taxable value     = item gross (GST-inclusive) − GST included in it
 *   Seller net        = item gross − commission   (the seller keeps the GST and remits it)
 *   Platform-funded coupons never reduce the base or the seller's net.
 *
 * The GST used is the checkout snapshot on the OrderItem (`taxAmount`, else `taxRate`),
 * i.e. whatever product tax / AppSettings.gstRate applied at order time. No rate is hardcoded.
 * Legacy items with neither snapshot are treated as 0% GST (base = gross) and are reported
 * by the reconciliation scripts rather than guessed.
 */

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

export interface ItemTaxSnapshot {
  total?: number;
  taxAmount?: number;
  taxRate?: number;
}

/** GST included in an item's GST-inclusive total. */
export const itemIncludedGst = (item: ItemTaxSnapshot): number => {
  const total = Math.max(0, Number(item?.total) || 0);
  const snap = Number(item?.taxAmount);
  if (Number.isFinite(snap) && snap > 0) return round2(Math.min(snap, total));
  const rate = Number(item?.taxRate);
  if (Number.isFinite(rate) && rate > 0) return round2((total * rate) / (100 + rate));
  return 0;
};

/** Taxable (ex-GST) value of an item: the commission base. */
export const itemTaxableValue = (item: ItemTaxSnapshot): number =>
  round2(Math.max(0, Number(item?.total) || 0) - itemIncludedGst(item));

/** Seller commission for an item at `ratePercent` (B-3). */
export const itemSellerCommission = (item: ItemTaxSnapshot, ratePercent: number): number => {
  const rate = Math.max(0, Number(ratePercent) || 0);
  return round2((itemTaxableValue(item) * rate) / 100);
};

/** Seller net for an item: gross − commission (GST stays with the seller). */
export const itemSellerNet = (item: ItemTaxSnapshot, ratePercent: number): number =>
  round2(Math.max(0, Number(item?.total) || 0) - itemSellerCommission(item, ratePercent));

/**
 * R-09: amount the customer still has to pay online for an order.
 * New orders store it in `onlineAmountDue`. Legacy orders stored the intended amount in
 * `onlineAmountPaid` before capture, so that is used only while the order is not Paid.
 */
export const getOnlineAmountDue = (order: {
  onlineAmountDue?: number;
  onlineAmountPaid?: number;
  paymentStatus?: string;
  total?: number;
  walletAmountUsed?: number;
}): number => {
  if (Number(order?.onlineAmountDue) > 0) return round2(Number(order.onlineAmountDue));
  if (order?.paymentStatus !== "Paid" && Number(order?.onlineAmountPaid) > 0) return round2(Number(order.onlineAmountPaid));
  return round2(Math.max(0, (Number(order?.total) || 0) - (Number(order?.walletAmountUsed) || 0)));
};
