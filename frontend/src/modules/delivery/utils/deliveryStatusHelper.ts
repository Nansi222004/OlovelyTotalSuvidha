export const getTranslatedDeliveryStatus = (status: string, t: (key: string, fallback?: string) => string): string => {
  if (!status) return "";
  const s = status.toLowerCase().trim().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    processed: "status.processed",
    pending: "status.pending",
    accepted: "status.accepted",
    ready_for_pickup: "status.readyForPickup",
    picked_up: "status.pickedUp",
    in_transit: "status.inTransit",
    out_for_delivery: "status.outForDelivery",
    delivered: "status.delivered",
    cancelled: "status.cancelled",
    returned: "status.returned",
    assigned: "status.accepted"
  };

  const key = map[s];
  if (key) {
    return t(key, status);
  }
  return t(`status.${s}`, status);
};
