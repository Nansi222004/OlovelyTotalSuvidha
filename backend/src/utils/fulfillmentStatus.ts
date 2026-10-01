export type CommerceChannel = "QUICK_COMMERCE" | "ECOMMERCE";

const TERMINAL_FULFILLMENT_STATUSES = new Set([
  "Delivered",
  "Cancelled",
  "Failed",
  "Rejected",
  "Returned",
  "Completed",
]);

export const isFulfillmentStatusActionable = (status: unknown): boolean =>
  !TERMINAL_FULFILLMENT_STATUSES.has(String(status || ""));

export const getChannelFulfillmentGroups = (groups: any[], channel: CommerceChannel): any[] => {
  const allowedTypes = channel === "QUICK_COMMERCE"
    ? new Set(["LOCAL_DELIVERY"])
    : new Set(["COURIER_SHIPPING", "THIRD_PARTY_API"]);
  return (Array.isArray(groups) ? groups : []).filter((group) =>
    allowedTypes.has(group?.fulfillmentType)
  );
};

export const hasActiveLocalDeliveryFulfillment = (order: any): boolean => {
  const groups = Array.isArray(order?.fulfillmentGroups) ? order.fulfillmentGroups : [];
  const localGroups = getChannelFulfillmentGroups(groups, "QUICK_COMMERCE");
  if (groups.length > 0) {
    return localGroups.some((group) => isFulfillmentStatusActionable(group.status));
  }
  return order?.orderType !== "ECOMMERCE" && isFulfillmentStatusActionable(order?.status);
};

export const areAllFulfillmentGroupsDelivered = (groups: any[]): boolean =>
  Array.isArray(groups) &&
  groups.length > 0 &&
  groups.every((group) => group?.status === "Delivered");

const STATUS_PRIORITY = [
  "OutForDelivery",
  "Shipped",
  "ReadyForPickup",
  "Processing",
  "Pending",
];

export const getChannelFulfillmentStatus = (
  groups: any[],
  channel: CommerceChannel,
  fallbackStatus: string,
): string => {
  const channelGroups = getChannelFulfillmentGroups(groups, channel);
  if (channelGroups.length === 0) return fallbackStatus;
  if (channelGroups.every((group) => group.status === "Delivered")) return "Delivered";

  const activeStatuses = channelGroups
    .map((group) => String(group.status || "Pending"))
    .filter(isFulfillmentStatusActionable);
  const selected = STATUS_PRIORITY.find((status) => activeStatuses.includes(status))
    || activeStatuses[0]
    || channelGroups[0].status
    || fallbackStatus;

  if (selected === "OutForDelivery") return "Out for Delivery";
  if (selected === "ReadyForPickup") return "Ready for pickup";
  return selected;
};
