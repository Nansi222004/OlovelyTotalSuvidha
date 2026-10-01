import assert from "node:assert/strict";
import { getDeliveryPartnerQcContext } from "../modules/delivery/utils/deliveryOrderScopingHelper";
import {
  areAllFulfillmentGroupsDelivered,
  getChannelFulfillmentStatus,
  hasActiveLocalDeliveryFulfillment,
} from "../utils/fulfillmentStatus";

const riderId = "rider-ritik";
const qcItems = [
  { _id: "qc-chocolate", seller: "seller-qc", productType: "QUICK_COMMERCE", quantity: 1, total: 800 },
  { _id: "qc-wholesale-atta", seller: "seller-qc", productType: "QUICK_COMMERCE", quantity: 1, total: 4375, isWholesale: true },
];
const ecommerceItem = {
  _id: "ecom-diya",
  seller: "seller-ecom",
  productType: "ECOMMERCE",
  quantity: 1,
  total: 389,
};

const makeMixedOrder = (qcStatus: string, ecommerceStatus: string) => ({
  _id: "6abe314298c31d92d055670d",
  orderNumber: "ORD1790849349120060",
  orderType: "MIXED",
  status: qcStatus === "OutForDelivery" ? "Out for Delivery" : "Out for Delivery",
  deliveryBoy: riderId,
  paymentMethod: "COD",
  codAmountPending: 5564,
  items: [...qcItems, ecommerceItem],
  fulfillmentGroups: [
    {
      groupId: "FG_QC",
      fulfillmentType: "LOCAL_DELIVERY",
      status: qcStatus,
      deliveryBoy: riderId,
      items: qcItems.map((item) => item._id),
      subtotal: 5175,
      shippingFee: 0,
    },
    {
      groupId: "FG_ECOM",
      fulfillmentType: "COURIER_SHIPPING",
      status: ecommerceStatus,
      items: [ecommerceItem._id],
      subtotal: 389,
      shippingFee: 0,
    },
  ],
});

const qcOnlyOutForDelivery = {
  ...makeMixedOrder("OutForDelivery", "Cancelled"),
  orderType: "QUICK_COMMERCE",
  status: "Out for Delivery",
  items: qcItems,
  fulfillmentGroups: [makeMixedOrder("OutForDelivery", "Cancelled").fulfillmentGroups[0]],
};

const qcOnlyDelivered = {
  ...qcOnlyOutForDelivery,
  status: "Delivered",
  fulfillmentGroups: [{ ...qcOnlyOutForDelivery.fulfillmentGroups[0], status: "Delivered" }],
};

const mixedPartial = makeMixedOrder("Delivered", "Shipped");
const mixedComplete = makeMixedOrder("Delivered", "Delivered");

const case1Active = getDeliveryPartnerQcContext(qcOnlyOutForDelivery, riderId);
assert.equal(case1Active.isActionable, true, "QC Out for Delivery must remain actionable");
assert.equal(hasActiveLocalDeliveryFulfillment(qcOnlyOutForDelivery), true, "QC tracking/ETA/OTP must be active");
const case1Delivered = getDeliveryPartnerQcContext(qcOnlyDelivered, riderId);
assert.equal(case1Delivered.displayStatus, "Delivered");
assert.equal(case1Delivered.isActionable, false, "Delivered QC must leave pending workload");
assert.equal(hasActiveLocalDeliveryFulfillment(qcOnlyDelivered), false, "Delivered QC must hide tracking/ETA/OTP");

const case2Snapshot = JSON.stringify(mixedPartial);
const case2 = getDeliveryPartnerQcContext(mixedPartial, riderId);
assert.equal(case2.displayStatus, "Delivered");
assert.equal(case2.isActionable, false, "Mixed order with completed QC must not be pending for rider");
assert.deepEqual(case2.assignedQcItems.map((item) => item._id), ["qc-chocolate", "qc-wholesale-atta"]);
assert.equal(hasActiveLocalDeliveryFulfillment(mixedPartial), false, "Completed local leg must stop live tracking");
assert.equal(getChannelFulfillmentStatus(mixedPartial.fulfillmentGroups, "QUICK_COMMERCE", mixedPartial.status), "Delivered");
assert.equal(getChannelFulfillmentStatus(mixedPartial.fulfillmentGroups, "ECOMMERCE", mixedPartial.status), "Shipped");
assert.equal(areAllFulfillmentGroupsDelivered(mixedPartial.fulfillmentGroups), false, "Parent must remain nonterminal");
assert.equal(JSON.stringify(mixedPartial), case2Snapshot, "Scoping helpers must not mutate the parent order");

assert.equal(areAllFulfillmentGroupsDelivered(mixedComplete.fulfillmentGroups), true, "All delivered groups complete the parent");
assert.equal(hasActiveLocalDeliveryFulfillment(mixedComplete), false);

const actionablePending = [qcOnlyOutForDelivery, qcOnlyDelivered, mixedPartial]
  .map((order) => getDeliveryPartnerQcContext(order, riderId))
  .filter((context) => context.isActionable);
assert.equal(actionablePending.length, 1, "Pending count must include only the active QC assignment");

console.log("PASS CASE 1: QC-only Out for Delivery -> Delivered state visibility");
console.log("PASS CASE 2: MIXED QC Delivered + Ecommerce Shipped remains parent-incomplete and rider-inactive");
console.log("PASS CASE 3: MIXED QC Delivered + Ecommerce Delivered completes all fulfillment groups");
console.log("PASS CASE 4: QC Out for Delivery retains tracking/ETA/OTP and pending actionability");
console.log("PASS SELLER: channel status resolves QC=Delivered and Ecommerce=Shipped");
console.log("PASS DASHBOARD: delivered QC assignments are excluded from pending count");
console.log("PASS WHOLESALE: wholesale QC item remains inside the rider's assigned QC scope");
