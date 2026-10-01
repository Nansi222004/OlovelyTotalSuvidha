export type SellerInvoiceChannel = "QUICK_COMMERCE" | "ECOMMERCE";

const idOf = (value: any): string => String(value?._id || value || "");

export function isSellerInvoiceChannel(value: unknown): value is SellerInvoiceChannel {
  return value === "QUICK_COMMERCE" || value === "ECOMMERCE";
}

export function getOrderItemChannel(item: any, fulfillmentGroups: any[], orderType?: string): SellerInvoiceChannel {
  if (item?.productType === "QUICK_COMMERCE" || item?.fulfillmentType === "LOCAL_DELIVERY") {
    return "QUICK_COMMERCE";
  }
  if (item?.productType === "ECOMMERCE" || item?.fulfillmentType === "COURIER_SHIPPING") {
    return "ECOMMERCE";
  }

  const itemId = idOf(item);
  const group = fulfillmentGroups.find((candidate: any) =>
    Array.isArray(candidate?.items) && candidate.items.some((groupItem: any) => idOf(groupItem) === itemId)
  );
  if (group?.fulfillmentType === "COURIER_SHIPPING" || group?.fulfillmentType === "THIRD_PARTY_API") {
    return "ECOMMERCE";
  }
  if (group?.fulfillmentType === "LOCAL_DELIVERY") return "QUICK_COMMERCE";
  return orderType === "ECOMMERCE" ? "ECOMMERCE" : "QUICK_COMMERCE";
}

/**
 * Produces an immutable-document projection for one authenticated seller and
 * one fulfillment channel. Item prices/tax/entity fields must come from
 * OrderItem snapshots; parent order totals are deliberately not reused.
 */
export function buildSellerInvoiceScope(
  sellerItems: any[],
  fulfillmentGroups: any[],
  channel: SellerInvoiceChannel,
) {
  const items = sellerItems.filter(
    (item) => getOrderItemChannel(item, fulfillmentGroups) === channel
  );
  const itemIds = new Set(items.map(idOf));
  const allowedFulfillmentTypes = channel === "QUICK_COMMERCE"
    ? new Set(["LOCAL_DELIVERY"])
    : new Set(["COURIER_SHIPPING", "THIRD_PARTY_API"]);

  const groups = fulfillmentGroups.filter((group: any) =>
    allowedFulfillmentTypes.has(group?.fulfillmentType) &&
    Array.isArray(group?.items) &&
    group.items.some((groupItem: any) => itemIds.has(idOf(groupItem)))
  );

  const subtotal = Number(items.reduce(
    (sum, item) => sum + Number(item.total ?? item.subtotal ?? (Number(item.unitPrice || 0) * Number(item.quantity || 1))),
    0
  ).toFixed(2));
  const shipping = Number(groups.reduce((sum: number, group: any) => {
    const groupFee = Number(group.shippingFee || 0);
    const groupSubtotal = Number(group.subtotal || 0);
    const scopedGroupSubtotal = items.reduce((itemSum, item) => {
      const belongsToGroup = group.items.some((groupItem: any) => idOf(groupItem) === idOf(item));
      if (!belongsToGroup) return itemSum;
      return itemSum + Number(item.total ?? item.subtotal ?? (Number(item.unitPrice || 0) * Number(item.quantity || 1)));
    }, 0);

    // Ecommerce groups are already per seller. A shared QC group can contain
    // multiple sellers, so allocate its one shipping snapshot proportionally
    // and never repeat the full fee on every seller bill.
    const scopedFee = groupSubtotal > 0 && scopedGroupSubtotal < groupSubtotal
      ? groupFee * (scopedGroupSubtotal / groupSubtotal)
      : groupFee;
    return sum + scopedFee;
  }, 0).toFixed(2));
  const taxIncluded = Number(items.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0).toFixed(2));

  return {
    channel,
    items,
    groups,
    subtotal,
    shipping,
    taxIncluded,
    total: Number((subtotal + shipping).toFixed(2)),
  };
}
