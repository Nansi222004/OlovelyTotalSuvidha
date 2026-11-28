/**
 * Order-level charges set by the admin in Billing & Charges — one source of truth for the cart
 * preview and for order placement, so what the customer sees is exactly what is charged.
 *
 * Small cart fee (Quick Commerce only)
 *   - smallCartFeeEnabled OFF → `minimumOrderValue` BLOCKS orders below it (old behaviour).
 *   - smallCartFeeEnabled ON  → nothing is blocked; when the Quick Commerce item total (before
 *     coupons) is below `minimumOrderValue`, the order pays `smallCartFee`. Courier-only carts
 *     never pay it (they already pay courier shipping).
 *
 * Courier (Shiprocket) shipping
 *   - flat `ecommerceShippingFee` per order that has courier items;
 *   - free when the courier item total reaches `ecommerceFreeShippingThreshold` (> 0);
 *     with that threshold at 0 the old rule applies: free when the whole cart reaches the
 *     global `freeDeliveryThreshold`.
 */

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const nonNeg = (v: unknown) => Math.max(0, Number(v) || 0);

export interface SmallCartEvaluation {
  /** true → order must be refused (fee mode OFF and cart below the minimum). */
  blocked: boolean;
  /** Fee to charge (0 when not applicable). */
  fee: number;
  /** Threshold in force (the admin's Minimum Order Value). */
  threshold: number;
  /** How much more Quick Commerce value avoids the fee / unblocks the order. */
  amountToAvoid: number;
  feeModeEnabled: boolean;
}

export function evaluateSmallCart(
  settings: any,
  subtotals: { qcSubtotal: number; cartSubtotal: number },
): SmallCartEvaluation {
  const threshold = nonNeg(settings?.minimumOrderValue);
  const configuredFee = nonNeg(settings?.smallCartFee);
  const feeModeEnabled = Boolean(settings?.smallCartFeeEnabled) && configuredFee > 0;
  const qc = nonNeg(subtotals.qcSubtotal);
  const cart = nonNeg(subtotals.cartSubtotal);

  if (threshold <= 0) {
    return { blocked: false, fee: 0, threshold: 0, amountToAvoid: 0, feeModeEnabled };
  }

  if (!feeModeEnabled) {
    const blocked = cart < threshold;
    return { blocked, fee: 0, threshold, amountToAvoid: blocked ? round2(threshold - cart) : 0, feeModeEnabled };
  }

  const applies = qc > 0 && qc < threshold;
  return {
    blocked: false,
    fee: applies ? round2(configuredFee) : 0,
    threshold,
    amountToAvoid: applies ? round2(threshold - qc) : 0,
    feeModeEnabled,
  };
}

export interface CourierShippingEvaluation {
  fee: number;
  /** Courier free-shipping threshold in force (0 = follows the global free-delivery threshold). */
  freeThreshold: number;
  amountToFree: number;
}

export function evaluateCourierShipping(
  settings: any,
  subtotals: { ecomSubtotal: number; cartSubtotal: number },
): CourierShippingEvaluation {
  const ecom = nonNeg(subtotals.ecomSubtotal);
  if (ecom <= 0) return { fee: 0, freeThreshold: 0, amountToFree: 0 };

  const baseFee = Number.isFinite(Number(settings?.ecommerceShippingFee))
    ? nonNeg(settings.ecommerceShippingFee)
    : 40;
  const courierThreshold = nonNeg(settings?.ecommerceFreeShippingThreshold);

  if (courierThreshold > 0) {
    const free = ecom >= courierThreshold;
    return { fee: free ? 0 : baseFee, freeThreshold: courierThreshold, amountToFree: free ? 0 : round2(courierThreshold - ecom) };
  }

  const globalThreshold = nonNeg(settings?.freeDeliveryThreshold);
  const cart = nonNeg(subtotals.cartSubtotal);
  const free = globalThreshold > 0 && cart >= globalThreshold;
  return { fee: free ? 0 : baseFee, freeThreshold: 0, amountToFree: 0 };
}
