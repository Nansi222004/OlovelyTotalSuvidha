/**
 * Isolated tests (no database, no network) for courier cancellation:
 *  - Shiprocket cancel request shape ({ ids: [<Shiprocket order id>] })
 *  - per-group cancellation rules (skip / refuse / cancel)
 *  - "past pickup" boundary used by customer, seller and admin cancellation
 *  - order-level helper: seller scoping, atomic per-group update, failure handling
 *  - webhook: Shiprocket CANCELED and PICKED UP are applied to the courier group
 *
 * Run: npm run test:shiprocket-cancellation
 */
import assert from 'node:assert/strict';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Return from '../models/Return';
import ProcessedWebhookEvent from '../models/ProcessedWebhookEvent';
import { shiprocketHttpClient } from '../services/shipping/shiprocketHttpClient';
import { shiprocketProvider } from '../services/shipping/shiprocketProvider';
import {
  cancelCourierShipmentsForOrder,
  handleShippingWebhook,
  isCourierGroupPastPickup,
  requestCourierGroupCancellation,
} from '../services/shipping/shippingService';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });

const originals = {
  request: shiprocketHttpClient.request,
  hasCredentials: shiprocketHttpClient.hasCredentials,
  orderFindById: Order.findById,
  orderFindOne: Order.findOne,
  orderUpdateOne: Order.updateOne,
  itemFind: OrderItem.find,
  returnFindOne: Return.findOne,
  eventFindOne: ProcessedWebhookEvent.findOne,
  eventCreate: ProcessedWebhookEvent.create,
  eventUpdateOne: ProcessedWebhookEvent.updateOne,
  shippingProvider: process.env.SHIPPING_PROVIDER,
};

function restore() {
  (shiprocketHttpClient as any).request = originals.request;
  (shiprocketHttpClient as any).hasCredentials = originals.hasCredentials;
  (Order as any).findById = originals.orderFindById;
  (Order as any).findOne = originals.orderFindOne;
  (Order as any).updateOne = originals.orderUpdateOne;
  (OrderItem as any).find = originals.itemFind;
  (Return as any).findOne = originals.returnFindOne;
  (ProcessedWebhookEvent as any).findOne = originals.eventFindOne;
  (ProcessedWebhookEvent as any).create = originals.eventCreate;
  (ProcessedWebhookEvent as any).updateOne = originals.eventUpdateOne;
  process.env.SHIPPING_PROVIDER = originals.shippingProvider;
}

/** Records every Shiprocket HTTP call; `reply` decides the response per call. */
function mockShiprocket(reply: (req: any) => any = () => ({ status: 200, message: 'Cancelled' })) {
  const calls: any[] = [];
  process.env.SHIPPING_PROVIDER = 'shiprocket';
  (shiprocketHttpClient as any).hasCredentials = () => true;
  (shiprocketHttpClient as any).request = async (req: any) => {
    calls.push(req);
    const result = reply(req);
    if (result instanceof Error) throw result;
    return result;
  };
  return calls;
}

const chain = (value: any) => ({ select: () => chain(value), lean: async () => value, then: (r: any) => Promise.resolve(value).then(r) });

const courierGroup = (overrides: Record<string, any> = {}) => ({
  groupId: 'FG_ECOM_A',
  fulfillmentType: 'COURIER_SHIPPING',
  status: 'Shipped',
  seller: 'seller-a',
  items: ['item-a'],
  shippingDetails: { awbNumber: 'SF123AWB' },
  thirdPartyOrderDetails: { providerId: 'shiprocket', externalOrderId: '1737726998', status: 'Manifested' },
  ...overrides,
});

// ─── Provider request shape ────────────────────────────────────────────────

test('Shiprocket cancel sends { ids: [<Shiprocket order id>] } to /v1/external/orders/cancel', async () => {
  const calls = mockShiprocket();
  const result = await shiprocketProvider.cancelShipment('1737726998', 'test');
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url, '/v1/external/orders/cancel');
  assert.deepEqual(calls[0].data, { ids: [1737726998] });
});

test('Shiprocket cancel refuses an AWB (non-numeric) without calling the API', async () => {
  const calls = mockShiprocket();
  const result = await shiprocketProvider.cancelShipment('SF4192008536KR');
  assert.equal(result.success, false);
  assert.equal(calls.length, 0);
});

test('Shiprocket API error is reported as a failed cancellation', async () => {
  mockShiprocket(() => Object.assign(new Error('Shiprocket API Error [400]: cannot cancel'), { statusCode: 400 }));
  const result = await shiprocketProvider.cancelShipment('1737726998');
  assert.equal(result.success, false);
});

// ─── Per-group rules ───────────────────────────────────────────────────────

test('group cancellation uses the stored Shiprocket order id, not the AWB', async () => {
  const calls = mockShiprocket();
  const result = await requestCourierGroupCancellation(courierGroup());
  assert.equal(result.success, true);
  assert.equal(result.skipped, undefined);
  assert.deepEqual(calls[0].data, { ids: [1737726998] });
});

test('already-cancelled group is skipped without an API call', async () => {
  const calls = mockShiprocket();
  const result = await requestCourierGroupCancellation(courierGroup({ status: 'Cancelled' }));
  assert.equal(result.success, true);
  assert.equal(result.skipped, true);
  assert.equal(calls.length, 0);
});

test('delivered group cannot be cancelled', async () => {
  const calls = mockShiprocket();
  const result = await requestCourierGroupCancellation(courierGroup({ status: 'Delivered' }));
  assert.equal(result.success, false);
  assert.equal(calls.length, 0);
});

test('group never booked with the carrier is cancelled locally without an API call', async () => {
  const calls = mockShiprocket();
  const result = await requestCourierGroupCancellation(
    courierGroup({ shippingDetails: { carrier: 'Shiprocket' }, thirdPartyOrderDetails: { providerId: 'shiprocket', status: 'Processing' } })
  );
  assert.equal(result.success, true);
  assert.equal(result.skipped, true);
  assert.equal(calls.length, 0);
});

test('local delivery group is never sent to the carrier', async () => {
  const calls = mockShiprocket();
  const result = await requestCourierGroupCancellation({ groupId: 'FG_QC', fulfillmentType: 'LOCAL_DELIVERY', status: 'Processing' });
  assert.equal(result.success, true);
  assert.equal(result.skipped, true);
  assert.equal(calls.length, 0);
});

// ─── Pickup boundary ───────────────────────────────────────────────────────

test('booked-but-not-picked-up courier group ("Shipped" label, carrier Manifested) is still cancellable', () => {
  assert.equal(isCourierGroupPastPickup(courierGroup()), false);
});

test('carrier Picked Up / In Transit / Delivered and group OutForDelivery block cancellation', () => {
  for (const status of ['Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Action Required']) {
    assert.equal(isCourierGroupPastPickup(courierGroup({ thirdPartyOrderDetails: { externalOrderId: '1', status } })), true, status);
  }
  assert.equal(isCourierGroupPastPickup(courierGroup({ status: 'OutForDelivery' })), true);
  assert.equal(isCourierGroupPastPickup({ fulfillmentType: 'LOCAL_DELIVERY', status: 'OutForDelivery' }), false);
});

// ─── Order-level helper ────────────────────────────────────────────────────

test('seller-scoped cancellation cancels only that seller\'s courier group (atomic per-group update)', async () => {
  const calls = mockShiprocket();
  const updates: any[] = [];
  const order = {
    _id: 'order-1',
    orderNumber: 'ORD1',
    fulfillmentGroups: [
      courierGroup({ groupId: 'FG_A', seller: 'seller-a', items: ['item-a'] }),
      courierGroup({ groupId: 'FG_B', seller: 'seller-b', items: ['item-b'], thirdPartyOrderDetails: { providerId: 'shiprocket', externalOrderId: '222', status: 'Manifested' } }),
      { groupId: 'FG_QC', fulfillmentType: 'LOCAL_DELIVERY', status: 'Processing', items: ['item-c'] },
    ],
  };
  (Order as any).findById = () => chain(order);
  (Order as any).updateOne = async (filter: any, update: any) => { updates.push({ filter, update }); return { modifiedCount: 1 }; };
  (OrderItem as any).find = () => chain([{ _id: 'item-a' }]);

  const results = await cancelCourierShipmentsForOrder('order-1', { sellerId: 'seller-a', reason: 'Seller rejected' });
  assert.equal(results.length, 1);
  assert.equal(results[0].groupId, 'FG_A');
  assert.deepEqual(calls.map((c) => c.data), [{ ids: [1737726998] }]);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].filter, { _id: 'order-1', 'fulfillmentGroups.groupId': 'FG_A' });
  assert.equal(updates[0].update.$set['fulfillmentGroups.$.status'], 'Cancelled');
  assert.equal(updates[0].update.$set['fulfillmentGroups.$.thirdPartyOrderDetails.status'], 'Cancelled');
});

test('whole-order cancellation cancels every active courier group and skips cancelled ones', async () => {
  const calls = mockShiprocket();
  const updates: any[] = [];
  const order = {
    _id: 'order-2',
    fulfillmentGroups: [
      courierGroup({ groupId: 'FG_A' }),
      courierGroup({ groupId: 'FG_B', status: 'Cancelled' }),
      courierGroup({ groupId: 'FG_C', thirdPartyOrderDetails: { providerId: 'shiprocket', externalOrderId: '333', status: 'Manifested' } }),
    ],
  };
  (Order as any).findById = () => chain(order);
  (Order as any).updateOne = async (filter: any) => { updates.push(filter); return { modifiedCount: 1 }; };

  const results = await cancelCourierShipmentsForOrder('order-2');
  assert.deepEqual(results.map((r) => r.groupId), ['FG_A', 'FG_C']);
  assert.deepEqual(calls.map((c) => c.data.ids[0]), [1737726998, 333]);
  assert.deepEqual(updates.map((u) => u['fulfillmentGroups.groupId']), ['FG_A', 'FG_C']);
});

test('carrier refusal keeps the group status, records the failure, and is returned as a failure (never throws)', async () => {
  mockShiprocket(() => new Error('Shiprocket API Error [400]: Order already picked up'));
  const updates: any[] = [];
  (Order as any).findById = () => chain({ _id: 'order-3', fulfillmentGroups: [courierGroup()] });
  (Order as any).updateOne = async (filter: any, update: any) => { updates.push({ filter, update }); return { modifiedCount: 1 }; };

  const results = await cancelCourierShipmentsForOrder('order-3');
  assert.equal(results.length, 1);
  assert.equal(results[0].success, false);
  // Exactly one write: the failure marker. The group is NOT marked Cancelled (pickup may still be live).
  assert.equal(updates.length, 1);
  const set = updates[0].update.$set;
  assert.ok(set['fulfillmentGroups.$.thirdPartyOrderDetails.cancelRequestFailedAt'] instanceof Date);
  assert.match(set['fulfillmentGroups.$.thirdPartyOrderDetails.cancelRequestError'], /Order already picked up/);
  assert.equal(set['fulfillmentGroups.$.status'], undefined);
  assert.equal(set['fulfillmentGroups.$.thirdPartyOrderDetails.status'], undefined);
});

test('successful cancellation clears an earlier failure marker', async () => {
  mockShiprocket();
  const updates: any[] = [];
  (Order as any).findById = () => chain({ _id: 'order-4', fulfillmentGroups: [courierGroup()] });
  (Order as any).updateOne = async (filter: any, update: any) => { updates.push({ filter, update }); return { modifiedCount: 1 }; };

  const results = await cancelCourierShipmentsForOrder('order-4');
  assert.equal(results[0].success, true);
  assert.equal(updates[0].update.$set['fulfillmentGroups.$.status'], 'Cancelled');
  assert.equal(updates[0].update.$unset['fulfillmentGroups.$.thirdPartyOrderDetails.cancelRequestFailedAt'], 1);
});

test('missing order returns no results', async () => {
  mockShiprocket();
  (Order as any).findById = () => chain(null);
  assert.deepEqual(await cancelCourierShipmentsForOrder('missing'), []);
});

// ─── Webhook application ───────────────────────────────────────────────────

async function applyWebhook(currentStatus: string, groupOverrides: Record<string, any> = {}) {
  const group: any = courierGroup(groupOverrides);
  const order: any = {
    _id: 'order-w', orderNumber: 'ORDW', status: 'Accepted', fulfillmentGroups: [group],
    save: async () => undefined,
  };
  (ProcessedWebhookEvent as any).findOne = () => ({ lean: async () => null });
  (ProcessedWebhookEvent as any).create = async () => ({});
  (ProcessedWebhookEvent as any).updateOne = async () => ({});
  (Return as any).findOne = async () => null;
  (Order as any).findOne = async () => order;
  process.env.SHIPPING_PROVIDER = 'shiprocket';
  await handleShippingWebhook(
    { awb: group.shippingDetails.awbNumber, current_status: currentStatus, eventId: `evt-${currentStatus}` },
    undefined,
    'shiprocket'
  );
  return group;
}

test('webhook CANCELED (Shiprocket spelling) cancels the courier group', async () => {
  const group = await applyWebhook('CANCELED');
  assert.equal(group.status, 'Cancelled');
  assert.equal(group.thirdPartyOrderDetails.status, 'Cancelled');
});

test('webhook PICKED UP records the carrier status so cancellation is blocked afterwards', async () => {
  const group = await applyWebhook('PICKED UP');
  assert.equal(group.status, 'Shipped');
  assert.equal(group.thirdPartyOrderDetails.status, 'Picked Up');
  assert.equal(isCourierGroupPastPickup(group), true);
});

test('webhook never revives a cancelled group', async () => {
  const group = await applyWebhook('PICKED UP', { status: 'Cancelled' });
  assert.equal(group.status, 'Cancelled');
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
    } finally {
      restore();
    }
  }
  console.log(`\nShiprocket cancellation tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
