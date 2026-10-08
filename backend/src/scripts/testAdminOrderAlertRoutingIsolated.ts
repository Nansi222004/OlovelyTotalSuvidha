import assert from "node:assert/strict";
import {
  buildAdminOrderAlert,
  isPlatformQuickCommerceItem,
  isVendorOwnedOrderItem,
} from "../services/orderAlertService";
import { computeFulfillment } from "../services/orderFulfillmentOrchestrator";

const items = [
  {
    _id: "platform-qc-retail",
    seller: "canonical-platform-seller",
    ownerType: "PLATFORM",
    productType: "QUICK_COMMERCE",
    fulfillmentType: "LOCAL_DELIVERY",
    productName: "Platform QC Retail",
    quantity: 2,
    unitPrice: 50,
    total: 100,
    isWholesale: false,
  },
  {
    _id: "platform-qc-wholesale",
    seller: "canonical-platform-seller",
    ownerType: "PLATFORM",
    productType: "QUICK_COMMERCE",
    fulfillmentType: "LOCAL_DELIVERY",
    productName: "Platform QC Wholesale",
    quantity: 10,
    unitPrice: 20,
    total: 200,
    isWholesale: true,
    wholesalePrice: 20,
    wholesaleMinimumQuantity: 10,
  },
  {
    _id: "platform-ecommerce",
    seller: "canonical-platform-seller",
    ownerType: "PLATFORM",
    productType: "ECOMMERCE",
    fulfillmentType: "COURIER_SHIPPING",
    productName: "Platform Ecommerce",
    quantity: 1,
    unitPrice: 300,
    total: 300,
  },
  {
    _id: "vendor-qc",
    seller: "vendor-1",
    ownerType: "VENDOR",
    productType: "QUICK_COMMERCE",
    fulfillmentType: "LOCAL_DELIVERY",
    productName: "Vendor QC",
    quantity: 1,
    unitPrice: 75,
    total: 75,
  },
  {
    _id: "vendor-ecommerce",
    seller: "vendor-2",
    ownerType: "VENDOR",
    productType: "ECOMMERCE",
    fulfillmentType: "COURIER_SHIPPING",
    productName: "Vendor Ecommerce",
    quantity: 1,
    unitPrice: 125,
    total: 125,
  },
];

const platformQcItems = items.filter(isPlatformQuickCommerceItem);
const vendorItems = items.filter(isVendorOwnedOrderItem);

assert.deepEqual(
  platformQcItems.map((item) => item._id),
  ["platform-qc-retail", "platform-qc-wholesale"],
  "Admin routing must include only Platform QC retail/wholesale items",
);
assert.deepEqual(
  vendorItems.map((item) => item._id),
  ["vendor-qc", "vendor-ecommerce"],
  "Seller routing must exclude all Platform-owned items, including those with a seller id",
);

const alert = buildAdminOrderAlert(
  {
    _id: "order-1",
    orderNumber: "ORD-1",
    status: "Received",
    paymentStatus: "Pending",
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    customerPhone: "9999999999",
    deliveryAddress: {
      address: "Test Street",
      city: "Test City",
      state: "Test State",
      pincode: "000000",
    },
    deliveryOption: "Standard",
    createdAt: new Date("2026-10-08T10:00:00.000Z"),
  },
  items,
);

assert.equal(alert.items.length, 2);
assert.equal(alert.totalAmount, 300);
assert.equal(alert.ownerType, "PLATFORM");
assert.equal(alert.fulfillmentType, "LOCAL_DELIVERY");
assert.equal(alert.requiresLocalDelivery, true);
assert.equal(alert.hasEcomItems, false);
assert(alert.items.every((item) => item.ownerType === "PLATFORM"));
assert(alert.items.every((item) => item.productType === "QUICK_COMMERCE"));
assert.equal(alert.items[1].isWholesale, true);
assert.equal(alert.items[1].wholesaleMinimumQuantity, 10);

const mixedPlatformState = computeFulfillment({}, [
  {
    _id: "platform-qc-rejected",
    seller: "canonical-platform-seller",
    ownerType: "PLATFORM",
    productType: "QUICK_COMMERCE",
    sellerStatus: "Rejected",
    status: "Cancelled",
  },
  {
    _id: "platform-ecommerce-active",
    seller: "canonical-platform-seller",
    ownerType: "PLATFORM",
    productType: "ECOMMERCE",
    sellerStatus: "Pending",
    status: "Pending",
  },
]);
assert.equal(mixedPlatformState.allRejected, false);
assert.equal(mixedPlatformState.anyAccepted, true);
assert.deepEqual(mixedPlatformState.fulfillableItemIds, ["platform-ecommerce-active"]);

console.log("PASS: Admin alert routing and payload isolation");
console.log("PASS: Platform QC retail -> Admin popup");
console.log("PASS: Platform Wholesale QC -> Admin popup");
console.log("PASS: Platform Ecommerce / Wholesale Ecommerce -> no Admin QC popup");
console.log("PASS: Vendor QC/Ecommerce -> Seller routing only");
console.log("PASS: Mixed payloads remain ownership- and channel-scoped");
console.log("PASS: rejecting Platform QC cannot cancel an active Platform Ecommerce leg");
