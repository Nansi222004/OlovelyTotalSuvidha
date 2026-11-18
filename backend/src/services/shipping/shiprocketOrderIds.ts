import crypto from 'crypto';

/**
 * Shiprocket channel order IDs (`order_id` on create, `channel_order_id` on lookup).
 *
 * Shiprocket rejects any order_id longer than 50 characters with
 * 422 "The order id may not be greater than 50 characters." (verified against the live API).
 * Every ID sent to Shiprocket must be built here so it stays short, deterministic
 * (same input -> same ID, which the query-before-create duplicate guard relies on)
 * and unique per shipment.
 */
export const SHIPROCKET_ORDER_ID_MAX_LENGTH = 50;

const shortHash = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);

/**
 * Forward shipment for one fulfillment group of a customer order.
 * Group IDs can embed the order ID and a seller ID (multi-seller orders), so the
 * group is reduced to a short hash: `OLV-<orderId>-<8 hex>` = 37 characters.
 */
export function buildForwardShipmentOrderId(orderId: string, groupId: string): string {
  return `OLV-${orderId}-${shortHash(groupId)}`;
}

/** Reverse pickup for a customer return: `RET-<returnId>` = 28 characters. */
export function buildReturnShipmentOrderId(returnId: string): string {
  return `RET-${returnId}`;
}

/** Forward shipment of an exchange replacement: `EXC-<returnId>` = 28 characters. */
export function buildReplacementShipmentOrderId(returnId: string): string {
  return `EXC-${returnId}`;
}

/** Fails fast with a clear message instead of a generic Shiprocket 422. */
export function assertValidShiprocketOrderId(orderId: string): void {
  if (orderId.length > SHIPROCKET_ORDER_ID_MAX_LENGTH) {
    throw new Error(
      `Shiprocket order id '${orderId}' is ${orderId.length} characters; Shiprocket allows at most ${SHIPROCKET_ORDER_ID_MAX_LENGTH}`
    );
  }
}
