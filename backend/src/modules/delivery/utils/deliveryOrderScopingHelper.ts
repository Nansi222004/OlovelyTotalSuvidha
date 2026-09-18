import mongoose from "mongoose";

export interface DeliveryPartnerQcContext {
  isAuthorized: boolean;
  hasQcItems: boolean;
  isEcommerceOnly: boolean;
  assignedQcItems: any[];
  assignedQcSubtotal: number;
  qcSellerIds: string[];
  assignedQcGroups: any[];
  assignedFulfillmentGroup?: any;
  relevantSellerPickups: any[];
  displayStatus: string;
}

/**
 * Pure helper function to inspect an order and resolve Quick Commerce scoping
 * for an authenticated delivery partner.
 * 
 * ZERO DATABASE MUTATION. Does not modify the input order or DB documents.
 * 
 * @param order Order document (plain object or Mongoose document)
 * @param deliveryBoyId The authenticated delivery partner's ID
 * @param hasActiveOffer Optional boolean indicating if deliveryBoyId has an active pending offer for this order
 */
export function getDeliveryPartnerQcContext(
  order: any,
  deliveryBoyId: string,
  hasActiveOffer: boolean = false
): DeliveryPartnerQcContext {
  if (!order || !deliveryBoyId) {
    return {
      isAuthorized: false,
      hasQcItems: false,
      isEcommerceOnly: false,
      assignedQcItems: [],
      assignedQcSubtotal: 0,
      qcSellerIds: [],
      assignedQcGroups: [],
      relevantSellerPickups: [],
      displayStatus: "Pending",
    };
  }

  const orderObj = order.toObject ? order.toObject() : order;
  const normalizedDeliveryId = deliveryBoyId.toString().trim();

  const fulfillmentGroups = Array.isArray(orderObj.fulfillmentGroups)
    ? orderObj.fulfillmentGroups
    : [];

  const hasFulfillmentGroups = fulfillmentGroups.length > 0;

  // 1. Identify Quick Commerce groups (LOCAL_DELIVERY) vs Ecommerce groups (COURIER_SHIPPING / THIRD_PARTY_API)
  const qcGroups = fulfillmentGroups.filter(
    (g: any) => g.fulfillmentType === "LOCAL_DELIVERY"
  );
  const ecomGroups = fulfillmentGroups.filter(
    (g: any) =>
      g.fulfillmentType === "COURIER_SHIPPING" ||
      g.fulfillmentType === "THIRD_PARTY_API"
  );

  const isEcommerceOnly =
    orderObj.orderType === "ECOMMERCE" ||
    (hasFulfillmentGroups && qcGroups.length === 0 && ecomGroups.length > 0);

  // If order is purely Ecommerce courier shipping, local delivery partner has no QC items
  if (isEcommerceOnly) {
    return {
      isAuthorized: false,
      hasQcItems: false,
      isEcommerceOnly: true,
      assignedQcItems: [],
      assignedQcSubtotal: 0,
      qcSellerIds: [],
      assignedQcGroups: [],
      relevantSellerPickups: [],
      displayStatus: orderObj.status || "Pending",
    };
  }

  // 2. Ownership & Authorization check using existing assignment source of truth
  const orderAssignedId = orderObj.deliveryBoy
    ? (orderObj.deliveryBoy._id || orderObj.deliveryBoy).toString()
    : null;

  const isDirectlyAssigned = orderAssignedId === normalizedDeliveryId;

  // For orders with fulfillment groups, check if this partner is assigned to the QC group or top-level order
  let assignedQcGroups: any[] = [];
  if (hasFulfillmentGroups) {
    assignedQcGroups = qcGroups.filter((g: any) => {
      const groupBoyId = g.deliveryBoy
        ? (g.deliveryBoy._id || g.deliveryBoy).toString()
        : null;
      return (
        groupBoyId === normalizedDeliveryId ||
        (!groupBoyId && isDirectlyAssigned)
      );
    });

    // If not directly assigned yet but has an active offer for QC groups
    if (assignedQcGroups.length === 0 && hasActiveOffer) {
      assignedQcGroups = qcGroups.filter((g: any) => !g.deliveryBoy || g.deliveryBoy.toString() === normalizedDeliveryId);
      if (assignedQcGroups.length === 0) {
        assignedQcGroups = qcGroups;
      }
    }
  }

  const isAuthorized =
    isDirectlyAssigned ||
    assignedQcGroups.length > 0 ||
    hasActiveOffer;

  if (!isAuthorized) {
    return {
      isAuthorized: false,
      hasQcItems: qcGroups.length > 0 || (!hasFulfillmentGroups && orderObj.orderType !== "ECOMMERCE"),
      isEcommerceOnly: false,
      assignedQcItems: [],
      assignedQcSubtotal: 0,
      qcSellerIds: [],
      assignedQcGroups: [],
      relevantSellerPickups: [],
      displayStatus: orderObj.status || "Pending",
    };
  }

  // 3. Resolve assigned QC items
  const allItems = Array.isArray(orderObj.items) ? orderObj.items : [];
  let assignedQcItems: any[] = [];

  if (hasFulfillmentGroups) {
    if (assignedQcGroups.length > 0) {
      const assignedItemIds = new Set<string>();
      assignedQcGroups.forEach((g: any) => {
        if (Array.isArray(g.items)) {
          g.items.forEach((it: any) => {
            const id = (it._id || it).toString();
            assignedItemIds.add(id);
          });
        }
      });

      assignedQcItems = allItems.filter((item: any) => {
        const itemId = (item._id || item).toString();
        return assignedItemIds.has(itemId);
      });
    } else {
      assignedQcItems = [];
    }
  } else {
    // Legacy / simple QC order with no fulfillment groups
    // If orderType is not ECOMMERCE, items belong to QC
    assignedQcItems = allItems.filter((item: any) => {
      return item.productType !== "ECOMMERCE";
    });
  }

  const hasQcItems =
    assignedQcItems.length > 0 ||
    qcGroups.length > 0 ||
    (!hasFulfillmentGroups && orderObj.orderType !== "ECOMMERCE");

  // 4. Calculate QC item subtotal from assigned items only
  const assignedQcSubtotal = assignedQcItems.reduce((acc: number, item: any) => {
    const itemTotal =
      typeof item.total === "number" && !isNaN(item.total)
        ? item.total
        : (Number(item.unitPrice || item.price || 0) * Number(item.quantity || 1));
    return acc + Number(itemTotal || 0);
  }, 0);

  // 5. Determine unique QC seller IDs from assigned QC items
  const qcSellerIdSet = new Set<string>();
  assignedQcItems.forEach((item: any) => {
    const sId = item.seller ? (item.seller._id || item.seller).toString() : null;
    if (sId) {
      qcSellerIdSet.add(sId);
    }
  });
  const qcSellerIds = Array.from(qcSellerIdSet);

  // 6. Filter seller pickups to only include QC sellers
  const allPickups = Array.isArray(orderObj.sellerPickups)
    ? orderObj.sellerPickups
    : [];
  const relevantSellerPickups = allPickups.filter((p: any) => {
    const sId = p.seller ? (p.seller._id || p.seller).toString() : null;
    return sId && qcSellerIdSet.has(sId);
  });

  // 7. Determine display status for the delivery partner view
  let displayStatus = orderObj.status || "Pending";
  if (assignedQcGroups.length === 1) {
    const groupStatus = assignedQcGroups[0].status;
    if (groupStatus === "Delivered") {
      displayStatus = "Delivered";
    } else if (groupStatus === "OutForDelivery") {
      displayStatus = "Out for Delivery";
    } else if (groupStatus === "Shipped") {
      displayStatus = "Picked up";
    } else if (groupStatus === "ReadyForPickup") {
      displayStatus = "Ready for pickup";
    }
  }

  return {
    isAuthorized,
    hasQcItems,
    isEcommerceOnly,
    assignedQcItems,
    assignedQcSubtotal: Number(assignedQcSubtotal.toFixed(2)),
    qcSellerIds,
    assignedQcGroups,
    assignedFulfillmentGroup: assignedQcGroups[0] || null,
    relevantSellerPickups,
    displayStatus,
  };
}
