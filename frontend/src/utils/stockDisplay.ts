/**
 * Products marked "Unlimited stock" are stored with a very large stock number
 * (backend UNLIMITED_STOCK = 999999, which sales slowly count down from).
 * Anything at or above this threshold is shown as "Unlimited" instead of the raw number.
 */
export const UNLIMITED_STOCK_THRESHOLD = 900000;

export const isUnlimitedStock = (stock: unknown): boolean =>
  typeof stock === "number" && stock >= UNLIMITED_STOCK_THRESHOLD;

export const formatStock = (stock: unknown): string =>
  isUnlimitedStock(stock) ? "Unlimited" : String(stock ?? 0);
