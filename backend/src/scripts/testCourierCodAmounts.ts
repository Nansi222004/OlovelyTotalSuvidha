/**
 * Isolated tests (no database, no network) for COD cash split (decision 2026-11-18, option c):
 *   rider   = quick-commerce items + QC shipping + tip
 *   courier = courier items + courier shipping + platform fee − coupon − wallet
 * and for the Shiprocket payload carrying exactly the courier amount.
 *
 * Run: npm run test:courier-cod-amounts
 */
import assert from 'node:assert/strict';
import { computeCourierCodAmount, computeCourierGroupCodAmounts } from '../services/courierCodService';
import { getDeliveryPartnerQcContext } from '../modules/delivery/utils/deliveryOrderScopingHelper';
import { buildShiprocketForwardPayload } from '../services/shipping/shiprocketProvider';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });

const qcItem = (id: string, total: number) => ({ _id: id, productType: 'QUICK_COMMERCE', total, quantity: 1 });
const courierItem = (id: string, total: number) => ({ _id: id, productType: 'ECOMMERCE', fulfillmentType: 'COURIER_SHIPPING', total, quantity: 1 });
const courierGroup = (groupId: string, items: string[], subtotal: number, shippingFee: number, extra: Record<string, any> = {}) =>
  ({ groupId, fulfillmentType: 'COURIER_SHIPPING', status: 'Processing', items, subtotal, shippingFee, ...extra });
const qcGroup = (groupId: string, items: string[], subtotal: number, shippingFee: number, extra: Record<string, any> = {}) =>
  ({ groupId, fulfillmentType: 'LOCAL_DELIVERY', status: 'Processing', items, subtotal, shippingFee, ...extra });

/** The real test order ORD1794981440459161: ₹10 item + ₹40 shipping + ₹2 platform fee, COD. */
const courierOnlyOrder = (codAmountPending: number) => ({
  paymentMethod: 'COD', orderType: 'ECOMMERCE', platformFee: 2, tipAmount: 0, total: 52, codAmountPending,
  items: [courierItem('i1', 10)],
  fulfillmentGroups: [courierGroup('FG_ECOM', ['i1'], 10, 40)],
});

/** Mixed: QC ₹100 + ₹20 delivery, courier ₹200 + ₹40 shipping, platform fee ₹2, tip ₹10 → ₹372. */
const mixedOrder = (extra: Record<string, any> = {}) => ({
  paymentMethod: 'COD', orderType: 'MIXED', platformFee: 2, tipAmount: 10, total: 372, codAmountPending: 372,
  items: [qcItem('q1', 100), courierItem('c1', 200)],
  fulfillmentGroups: [qcGroup('FG_QC', ['q1'], 100, 20), courierGroup('FG_ECOM', ['c1'], 200, 40)],
  ...extra,
});

const payloadFor = (paymentMethod: string, subtotal: number, shippingCharges: number, codAmount?: number) =>
  buildShiprocketForwardPayload({
    source: 'CUSTOMER_ORDER', idempotencyKey: 'OLV-test', orderId: 'o', fulfillmentGroupId: 'g',
    customerName: 'C', customerPhone: '9000000000',
    shippingAddress: { address: 'A', city: 'Indore', state: 'MP', pincode: '452001' },
    items: [{ productId: 'p1', productName: 'P', sku: 'S', quantity: 1, unitPrice: subtotal }],
    subtotal, shippingCharges, paymentMethod, codAmount,
    pickupDetails: { sellerId: 's', sellerName: 'S', pickupAddress: 'X', pickupPincode: '452015', pickupLocationName: 'OLOVELY-S' },
  } as any);

const shiprocketCollects = (p: any) =>
  Math.round((p.sub_total + p.shipping_charges + (p.transaction_charges || 0) - (p.total_discount || 0)) * 100) / 100;

// ─── Courier-only COD ──────────────────────────────────────────────────────

test('courier-only COD: courier collects the platform fee too (₹52, not ₹50)', async () => {
  const amounts = await computeCourierGroupCodAmounts(courierOnlyOrder(52));
  assert.equal(amounts.get('FG_ECOM'), 52);
  const p = payloadFor('COD', 10, 40, 52);
  assert.equal(p.payment_method, 'COD');
  assert.equal(p.transaction_charges, 2);
  assert.equal(p.total_discount, 0);
  assert.equal(shiprocketCollects(p), 52);
});

test('courier-only COD with ₹5 coupon: courier collects ₹47 (no overcharge)', async () => {
  const amounts = await computeCourierGroupCodAmounts(courierOnlyOrder(47));
  assert.equal(amounts.get('FG_ECOM'), 47);
  const p = payloadFor('COD', 10, 40, 47);
  assert.equal(p.total_discount, 3);
  assert.equal(p.transaction_charges, 0);
  assert.equal(shiprocketCollects(p), 47);
});

test('courier-only COD with ₹32 wallet used: courier collects only the remaining ₹20', async () => {
  const amounts = await computeCourierGroupCodAmounts(courierOnlyOrder(20));
  assert.equal(amounts.get('FG_ECOM'), 20);
  assert.equal(shiprocketCollects(payloadFor('COD', 10, 40, 20)), 20);
});

test('nothing left to collect: shipment is sent as Prepaid', async () => {
  const amounts = await computeCourierGroupCodAmounts(courierOnlyOrder(0));
  assert.equal(amounts.get('FG_ECOM'), 0);
  const p = payloadFor('COD', 10, 40, 0);
  assert.equal(p.payment_method, 'Prepaid');
});

test('prepaid shipments are unchanged (no COD adjustment)', async () => {
  const p = payloadFor('Prepaid', 10, 40);
  assert.equal(p.payment_method, 'Prepaid');
  assert.equal(p.transaction_charges, 0);
  assert.equal(p.total_discount, 0);
  assert.equal(p.sub_total, 10);
  assert.equal(p.shipping_charges, 40);
  assert.equal((await computeCourierGroupCodAmounts({ ...courierOnlyOrder(0), paymentMethod: 'Online' })).size, 0);
});

// ─── Mixed COD: tip with the rider, platform fee with the courier ──────────

test('mixed COD, rider not assigned yet: rider ₹130 (100+20+tip 10), courier ₹242 (200+40+fee 2)', async () => {
  const order = mixedOrder();
  assert.equal(await computeCourierCodAmount(order), 242);
  assert.equal((await computeCourierGroupCodAmounts(order)).get('FG_ECOM'), 242);
});

test('mixed COD, rider assigned: rider app shows ₹130 incl. tip; courier still ₹242; total = ₹372', async () => {
  const order = mixedOrder({
    fulfillmentGroups: [qcGroup('FG_QC', ['q1'], 100, 20, { deliveryBoy: 'rider-1' }), courierGroup('FG_ECOM', ['c1'], 200, 40)],
  });
  const ctx = getDeliveryPartnerQcContext(order, 'rider-1');
  assert.equal(ctx.assignedQcCodAmount, 130);
  const courier = await computeCourierCodAmount(order);
  assert.equal(courier, 242);
  assert.equal(ctx.assignedQcCodAmount + courier, order.codAmountPending);
});

test('mixed COD with coupon/wallet reduction: the reduction lowers the courier part, rider unchanged', async () => {
  const order = mixedOrder({ codAmountPending: 322 }); // ₹50 coupon/wallet
  assert.equal(await computeCourierCodAmount(order), 192);
});

test('rider share is capped at what is still owed', async () => {
  const order = mixedOrder({
    codAmountPending: 100,
    fulfillmentGroups: [qcGroup('FG_QC', ['q1'], 100, 20, { deliveryBoy: 'rider-1' }), courierGroup('FG_ECOM', ['c1'], 200, 40)],
  });
  assert.equal(getDeliveryPartnerQcContext(order, 'rider-1').assignedQcCodAmount, 100);
  assert.equal(await computeCourierCodAmount(order), 0);
});

test('pure quick-commerce COD is unchanged: rider collects everything incl. tip and fee', () => {
  const order = {
    paymentMethod: 'COD', orderType: 'QUICK_COMMERCE', tipAmount: 10, platformFee: 2, codAmountPending: 132,
    items: [qcItem('q1', 100)],
    fulfillmentGroups: [qcGroup('FG_QC', ['q1'], 100, 20, { deliveryBoy: 'rider-1' })],
  };
  assert.equal(getDeliveryPartnerQcContext(order, 'rider-1').assignedQcCodAmount, 132);
});

test('tip is collected once: only the rider of the first QC group collects it', () => {
  const order = {
    paymentMethod: 'COD', orderType: 'QUICK_COMMERCE', tipAmount: 10, platformFee: 0, codAmountPending: 250,
    items: [qcItem('q1', 100), qcItem('q2', 100)],
    fulfillmentGroups: [
      qcGroup('FG_QC_1', ['q1'], 100, 20, { deliveryBoy: 'rider-1' }),
      qcGroup('FG_QC_2', ['q2'], 100, 20, { deliveryBoy: 'rider-2' }),
    ],
  };
  assert.equal(getDeliveryPartnerQcContext(order, 'rider-1').assignedQcCodAmount, 130);
  assert.equal(getDeliveryPartnerQcContext(order, 'rider-2').assignedQcCodAmount, 120);
});

// ─── Several courier shipments ─────────────────────────────────────────────

const twoCourierOrder = (statusB = 'Processing') => ({
  paymentMethod: 'COD', orderType: 'ECOMMERCE', platformFee: 2, tipAmount: 0, codAmountPending: 482,
  items: [courierItem('a1', 300), courierItem('b1', 100)],
  fulfillmentGroups: [
    courierGroup('FG_A', ['a1'], 300, 40),
    courierGroup('FG_B', ['b1'], 100, 40, { status: statusB }),
  ],
});

test('two courier shipments: amounts split by value and add up exactly to the courier share', async () => {
  const amounts = await computeCourierGroupCodAmounts(twoCourierOrder());
  assert.equal(amounts.get('FG_A'), 341.42);
  assert.equal(amounts.get('FG_B'), 140.58);
  assert.equal(Math.round(((amounts.get('FG_A') || 0) + (amounts.get('FG_B') || 0)) * 100) / 100, 482);
});

test('a cancelled courier shipment is never collected; the other keeps its own share', async () => {
  const amounts = await computeCourierGroupCodAmounts(twoCourierOrder('Cancelled'));
  assert.equal(amounts.has('FG_B'), false);
  assert.equal(amounts.get('FG_A'), 341.42);
});

(async () => {
  let passed = 0;
  let failed = 0;
  for (const { name, run } of tests) {
    try {
      await run();
      console.log(`PASS ${name}`);
      passed++;
    } catch (error) {
      console.log(`FAIL ${name}`);
      console.log(error instanceof Error ? error.message : error);
      failed++;
    }
  }
  console.log(`\nCourier COD amount tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
