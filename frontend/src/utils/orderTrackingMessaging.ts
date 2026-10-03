type FulfillmentGroup = {
  fulfillmentType?: string;
  status?: string;
  shippingDetails?: {
    carrier?: string;
    awbNumber?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: string | Date;
  };
};

const isCourierGroup = (group: FulfillmentGroup) =>
  group.fulfillmentType === "COURIER_SHIPPING" || group.fulfillmentType === "THIRD_PARTY_API";

const formatExpectedDelivery = (value?: string | Date): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const getFulfillmentTrackingMessage = (
  group: FulfillmentGroup,
  order: any,
  estimatedMinutes?: number,
): string => {
  const status = group.status || order?.status || "Pending";
  if (!isCourierGroup(group)) {
    if (["Delivered", "Completed"].includes(status)) return "Local delivery completed";
    if (["OutForDelivery", "Out for Delivery", "On the way"].includes(status) && estimatedMinutes != null) {
      return `Arriving in ${estimatedMinutes} mins`;
    }
    if (["Accepted", "Processing", "ReadyForPickup"].includes(status)) return "Preparing for local delivery";
    return "Quick local delivery";
  }

  const expected = formatExpectedDelivery(group.shippingDetails?.estimatedDelivery);
  if (expected) return `Expected delivery: ${expected}`;
  if (status === "Delivered") return "Courier shipment delivered";
  if (["OutForDelivery", "Out for Delivery"].includes(status)) return "Courier shipment is out for delivery";
  if (["Shipped", "In Transit"].includes(status)) return "Courier shipment is in transit";
  if (["Processing", "ReadyForPickup"].includes(status)) return "Courier shipment is being prepared";
  if (status === "Cancelled") return "Courier shipment cancelled";
  return "Courier shipment is awaiting dispatch";
};

export const getOrderTrackingHeader = (order: any, estimatedMinutes: number) => {
  const groups: FulfillmentGroup[] = Array.isArray(order?.fulfillmentGroups) ? order.fulfillmentGroups : [];
  const activeLocal = groups.find((group) => group.fulfillmentType === "LOCAL_DELIVERY" && !["Delivered", "Completed", "Cancelled"].includes(group.status || ""));
  const courier = groups.find(isCourierGroup);

  if (activeLocal) {
    return {
      title: activeLocal.status === "OutForDelivery" ? "Out for delivery" : "Local delivery update",
      subtitle: getFulfillmentTrackingMessage(activeLocal, order, estimatedMinutes),
      color: "bg-emerald-700",
      isLocalEta: ["OutForDelivery", "Out for Delivery", "On the way"].includes(activeLocal.status || ""),
    };
  }

  if (courier || (groups.length === 0 && order?.orderType === "ECOMMERCE")) {
    const group = courier || { fulfillmentType: "COURIER_SHIPPING", status: order?.status };
    const status = group.status || order?.status;
    return {
      title: status === "Delivered" ? "Courier shipment delivered" : status === "Shipped" ? "Courier shipment in transit" : "Courier shipment update",
      subtitle: getFulfillmentTrackingMessage(group, order),
      color: status === "Delivered" ? "bg-emerald-600" : "bg-blue-700",
      isLocalEta: false,
    };
  }

  return null;
};

export { isCourierGroup, formatExpectedDelivery };
