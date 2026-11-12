/**
 * Shared order-money helpers so every panel (customer, seller, admin, delivery)
 * shows the same breakdown of `order.total`.
 *
 * Backend rule (customerOrderController.createOrder):
 *   total = subtotal − discount + platformFee + shipping + tipAmount + giftPackagingFee
 * GST is INCLUSIVE in item prices and is never added to the total.
 */

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const getOrderTipAmount = (order: any): number =>
  Math.max(0, Number(order?.tipAmount) || 0);

/**
 * Gift packaging fee actually charged. Newer orders store a snapshot
 * (`giftPackagingFee`); older ones only stored `giftPackaging: true`, so the fee
 * is derived from the stored total (the remainder after every other component).
 */
export const getOrderGiftPackagingFee = (order: any): number => {
  const snap = Number(order?.giftPackagingFee);
  if (Number.isFinite(snap) && snap > 0) return round2(snap);
  if (!order?.giftPackaging) return 0;
  const total = Number(order?.total ?? order?.totalAmount) || 0;
  const known =
    (Number(order?.subtotal) || 0) -
    (Number(order?.discount) || 0) +
    (Number(order?.platformFee ?? order?.fees?.platformFee) || 0) +
    (Number(order?.shipping ?? order?.fees?.deliveryFee) || 0) +
    getOrderTipAmount(order);
  return Math.max(0, round2(total - known));
};
