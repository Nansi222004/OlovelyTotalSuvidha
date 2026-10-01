import assert from "node:assert/strict";
import { buildSellerInvoiceScope } from "../utils/sellerInvoiceScoping";
import { getDeliveryPartnerQcContext } from "../modules/delivery/utils/deliveryOrderScopingHelper";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")}: ${name}`);
};

const riderId = "64b000000000000000000001";
const hybridSellerId = "64b000000000000000000002";
const otherSellerId = "64b000000000000000000003";
const qcItem = {
  _id: "64b000000000000000000011",
  seller: hybridSellerId,
  productName: "Product A",
  productType: "QUICK_COMMERCE",
  fulfillmentType: "LOCAL_DELIVERY",
  ownerType: "VENDOR",
  billingEntityName: "Hybrid Vendor",
  billingEntityGstin: "VENDOR-GST-SNAPSHOT",
  unitPrice: 800,
  quantity: 1,
  total: 800,
  taxAmount: 40,
};
const ecomItem = {
  _id: "64b000000000000000000012",
  seller: hybridSellerId,
  productName: "Product B",
  productType: "ECOMMERCE",
  fulfillmentType: "COURIER_SHIPPING",
  ownerType: "VENDOR",
  billingEntityName: "Hybrid Vendor",
  billingEntityGstin: "VENDOR-GST-SNAPSHOT",
  unitPrice: 2200,
  quantity: 1,
  total: 2200,
  taxAmount: 110,
};
const groups = [
  {
    groupId: "QC",
    fulfillmentType: "LOCAL_DELIVERY",
    deliveryBoy: riderId,
    items: [qcItem._id],
    subtotal: 800,
    shippingFee: 40,
  },
  {
    groupId: "ECOM",
    fulfillmentType: "COURIER_SHIPPING",
    items: [ecomItem._id],
    subtotal: 2200,
    shippingFee: 120,
    shippingDetails: { awbNumber: "SECRET-AWB" },
  },
];

const qcScope = buildSellerInvoiceScope([qcItem, ecomItem], groups, "QUICK_COMMERCE");
const ecomScope = buildSellerInvoiceScope([qcItem, ecomItem], groups, "ECOMMERCE");

test("Admin-owned QC product retains platform GSTIN snapshot", () => {
  const item = { ...qcItem, ownerType: "PLATFORM", billingEntityGstin: "PLATFORM-GST-SNAPSHOT" };
  assert.equal(buildSellerInvoiceScope([item], [{ ...groups[0], items: [item._id] }], "QUICK_COMMERCE").items[0].billingEntityGstin, "PLATFORM-GST-SNAPSHOT");
});
test("Admin-owned Ecommerce product retains platform GSTIN snapshot", () => {
  const item = { ...ecomItem, ownerType: "PLATFORM", billingEntityGstin: "PLATFORM-GST-SNAPSHOT" };
  assert.equal(buildSellerInvoiceScope([item], [{ ...groups[1], items: [item._id] }], "ECOMMERCE").items[0].billingEntityGstin, "PLATFORM-GST-SNAPSHOT");
});
test("Vendor QC product retains vendor GSTIN snapshot", () => assert.equal(qcScope.items[0].billingEntityGstin, "VENDOR-GST-SNAPSHOT"));
test("Vendor Ecommerce product retains vendor GSTIN snapshot", () => assert.equal(ecomScope.items[0].billingEntityGstin, "VENDOR-GST-SNAPSHOT"));
test("Hybrid seller QC bill contains QC only", () => assert.deepEqual(qcScope.items.map((item) => item.productName), ["Product A"]));
test("Hybrid seller Ecommerce bill contains Ecommerce only", () => assert.deepEqual(ecomScope.items.map((item) => item.productName), ["Product B"]));

const parentOrder = {
  orderType: "MIXED",
  deliveryBoy: riderId,
  paymentMethod: "COD",
  codAmountPending: 3160,
  subtotal: 3000,
  shipping: 160,
  total: 3160,
  items: [qcItem, ecomItem],
  fulfillmentGroups: groups,
};
const riderScope = getDeliveryPartnerQcContext(parentOrder, riderId);
test("Hybrid mixed COD rider sees QC item only", () => assert.deepEqual(riderScope.assignedQcItems.map((item) => item.productName), ["Product A"]));
test("Mixed COD rider collection excludes Ecommerce", () => assert.equal(riderScope.assignedQcCodAmount, 840));
test("Wholesale QC stays in QC seller and rider scope", () => {
  const wholesale = { ...qcItem, isWholesale: true };
  assert.equal(buildSellerInvoiceScope([wholesale], groups, "QUICK_COMMERCE").items.length, 1);
  assert.equal(getDeliveryPartnerQcContext({ ...parentOrder, items: [wholesale, ecomItem] }, riderId).assignedQcItems[0].isWholesale, true);
});
test("Wholesale Ecommerce stays in Ecommerce scope and outside rider scope", () => {
  const wholesale = { ...ecomItem, isWholesale: true };
  assert.equal(buildSellerInvoiceScope([qcItem, wholesale], groups, "ECOMMERCE").items[0].isWholesale, true);
  assert.equal(getDeliveryPartnerQcContext({ ...parentOrder, items: [qcItem, wholesale] }, riderId).assignedQcItems.length, 1);
});
test("Multiple vendors remain seller and channel scoped", () => {
  const other = { ...ecomItem, _id: "64b000000000000000000013", seller: otherSellerId };
  assert.equal(buildSellerInvoiceScope([qcItem, ecomItem], groups, "ECOMMERCE").items.length, 1);
  assert.equal(buildSellerInvoiceScope([other], [{ ...groups[1], items: [other._id] }], "ECOMMERCE").items.length, 1);
  const otherQc = { ...qcItem, _id: "64b000000000000000000014", seller: otherSellerId, total: 800 };
  const sharedQcGroup = { ...groups[0], items: [qcItem._id, otherQc._id], subtotal: 1600, shippingFee: 40 };
  assert.equal(buildSellerInvoiceScope([qcItem], [sharedQcGroup], "QUICK_COMMERCE").shipping, 20);
});
test("Parent order total remains unchanged", () => assert.equal(parentOrder.total, 3160));
test("Seller ownership boundary excludes another seller's items", () => assert.equal(buildSellerInvoiceScope([qcItem], groups, "ECOMMERCE").items.length, 0));
test("Seller PDF uses the same channel-scoped document projection", () => assert.equal(qcScope.total, 840));
test("Seller print uses the same channel-scoped document projection", () => assert.equal(ecomScope.total, 2320));
test("GST is informational and not added twice", () => assert.equal(qcScope.total, qcScope.subtotal + qcScope.shipping));
test("Shipping is included once per matching fulfillment group", () => {
  assert.equal(qcScope.shipping, 40);
  assert.equal(ecomScope.shipping, 120);
});

console.log(`\n${passed}/17 targeted financial-scoping tests passed.`);
