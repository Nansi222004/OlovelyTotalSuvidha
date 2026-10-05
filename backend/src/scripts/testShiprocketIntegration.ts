import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Order from '../models/Order';
import Seller from '../models/Seller';
import ProcessedWebhookEvent from '../models/ProcessedWebhookEvent';
import ShiprocketPickupRetirement from '../models/ShiprocketPickupRetirement';
import Return from '../models/Return';
import { handleWebhook } from '../modules/shipping/controllers/shippingWebhookController';
import { getActiveSellerShiprocketPickupName, handleShippingWebhook } from '../services/shipping/shippingService';
import { shiprocketProvider } from '../services/shipping/shiprocketProvider';
import {
  buildShiprocketPickupLocationName,
  buildShiprocketPickupPayload,
  cleanupSellerShiprocketPickup,
  getPickupAddressFingerprint,
  provisionShiprocketPickupLocation,
  ShiprocketPickupCleanupError,
  ShiprocketPickupApi,
} from '../services/shipping/shiprocketPickupService';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });

const originalOrderFindOne = Order.findOne;
const originalEventFindOne = ProcessedWebhookEvent.findOne;
const originalEventCreate = ProcessedWebhookEvent.create;
const originalEventUpdateOne = ProcessedWebhookEvent.updateOne;
const originalEventDeleteOne = ProcessedWebhookEvent.deleteOne;
const originalSellerFindById = Seller.findById;
const originalSellerUpdateOne = Seller.updateOne;
const originalSellerFindOneAndUpdate = Seller.findOneAndUpdate;
const originalRetirementUpdateOne = ShiprocketPickupRetirement.updateOne;
const originalReturnFindOne = Return.findOne;
const originalWebhookToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;

const validPayload = {
  awb: 'AWB-ISOLATED-1001',
  courier_name: 'Mock Courier',
  current_status: 'IN TRANSIT',
  current_status_id: 20,
  shipment_status: 'IN TRANSIT',
  shipment_status_id: 18,
  current_timestamp: '23 05 2023 11:43:52',
  order_id: 'ORDER-GROUP-1',
  sr_order_id: 348456385,
  etd: '2023-05-26 15:40:19',
  scans: [{
    date: '2023-05-23 11:43:46',
    status: 'X-IBD3F',
    activity: 'In Transit - Shipment Received at Facility',
    location: 'Mumbai',
  }],
};

function responseRecorder() {
  const record: any = { statusCode: 200, body: undefined };
  const response: any = {
    status(code: number) { record.statusCode = code; return response; },
    json(body: unknown) { record.body = body; return response; },
  };
  return { response, record };
}

function installWebhookDb(orderFactory: () => any) {
  const processed = new Map<string, any>();
  let saves = 0;
  (ProcessedWebhookEvent.findOne as any) = ({ eventId }: any) => ({
    lean: async () => processed.get(eventId) || null,
  });
  (ProcessedWebhookEvent.create as any) = async (data: any) => {
    if (processed.has(data.eventId)) {
      const error: any = new Error('duplicate');
      error.code = 11000;
      throw error;
    }
    processed.set(data.eventId, { _id: data.eventId, ...data });
    return data;
  };
  (ProcessedWebhookEvent.updateOne as any) = async (filter: any, update: any) => {
    const eventId = filter.eventId || filter._id;
    const record = processed.get(eventId);
    if (!record) return { modifiedCount: 0 };
    Object.assign(record, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) delete record[key];
    return { modifiedCount: 1 };
  };
  (ProcessedWebhookEvent.deleteOne as any) = async (filter: any) => {
    processed.delete(filter.eventId);
    return { deletedCount: 1 };
  };
  (Order.findOne as any) = async () => {
    const order = orderFactory();
    if (order) order.save = async () => { saves += 1; };
    return order;
  };
  (Return.findOne as any) = async () => null;
  return { processed, get saves() { return saves; } };
}

test('valid x-api-key is accepted with constant-time verification', () => {
  process.env.SHIPROCKET_WEBHOOK_TOKEN = 'isolated-webhook-secret';
  assert.equal(shiprocketProvider.verifyWebhookSignature?.({ 'x-api-key': 'isolated-webhook-secret' }, ''), true);
});

test('invalid x-api-key is rejected', async () => {
  process.env.SHIPROCKET_WEBHOOK_TOKEN = 'isolated-webhook-secret';
  const { response, record } = responseRecorder();
  await handleWebhook({ body: validPayload, headers: { 'x-api-key': 'wrong' } } as any, response);
  assert.equal(record.statusCode, 401);
});

test('missing x-api-key is rejected', async () => {
  process.env.SHIPROCKET_WEBHOOK_TOKEN = 'isolated-webhook-secret';
  const { response, record } = responseRecorder();
  await handleWebhook({ body: validPayload, headers: {} } as any, response);
  assert.equal(record.statusCode, 401);
});

test('valid webhook updates an Ecommerce group and returns HTTP 200', async () => {
  process.env.SHIPROCKET_WEBHOOK_TOKEN = 'isolated-webhook-secret';
  const group: any = {
    groupId: 'ECOM-1', fulfillmentType: 'COURIER_SHIPPING', status: 'Processing',
    shippingDetails: { awbNumber: validPayload.awb }, thirdPartyOrderDetails: { providerId: 'shiprocket' },
  };
  const db = installWebhookDb(() => ({ fulfillmentGroups: [group], status: 'Processed' }));
  const { response, record } = responseRecorder();
  await handleWebhook({ body: validPayload, headers: { 'x-api-key': 'isolated-webhook-secret' } } as any, response);
  assert.equal(record.statusCode, 200);
  assert.equal(group.status, 'Shipped');
  assert.equal(group.shippingDetails.carrier, 'Mock Courier');
  assert.ok(group.shippingDetails.estimatedDelivery instanceof Date);
  assert.equal(db.saves, 1);
});

test('same webhook payload is idempotent', async () => {
  const group: any = {
    groupId: 'ECOM-1', fulfillmentType: 'COURIER_SHIPPING', status: 'Processing',
    shippingDetails: { awbNumber: validPayload.awb }, thirdPartyOrderDetails: { providerId: 'shiprocket' },
  };
  const order = { fulfillmentGroups: [group], status: 'Processed' };
  const db = installWebhookDb(() => order);
  const first = await handleShippingWebhook(validPayload, undefined, 'shiprocket');
  const second = await handleShippingWebhook(validPayload, undefined, 'shiprocket');
  assert.equal(first.eventId, second.eventId);
  assert.match(second.ignoredReason || '', /Duplicate/);
  assert.equal(db.saves, 1);
  assert.equal(db.processed.size, 1);
});

test('concurrent duplicate webhooks claim once before order mutation', async () => {
  const group: any = {
    groupId: 'ECOM-CONCURRENT', fulfillmentType: 'COURIER_SHIPPING', status: 'Processing',
    shippingDetails: { awbNumber: validPayload.awb }, thirdPartyOrderDetails: { providerId: 'shiprocket' },
  };
  const db = installWebhookDb(() => ({ fulfillmentGroups: [group], status: 'Processed' }));
  const results = await Promise.all([
    handleShippingWebhook(validPayload, undefined, 'shiprocket'),
    handleShippingWebhook(validPayload, undefined, 'shiprocket'),
  ]);
  assert.equal(db.saves, 1);
  assert.equal(db.processed.size, 1);
  assert.ok(results.some((result) => /Duplicate/.test(result.ignoredReason || '')));
});

test('QC fulfillment is not eligible for webhook mutation', async () => {
  const qcGroup: any = {
    groupId: 'QC-1', fulfillmentType: 'LOCAL_DELIVERY', status: 'OutForDelivery',
    shippingDetails: { awbNumber: validPayload.awb },
  };
  let query: any;
  (Order.findOne as any) = async (received: any) => { query = received; return null; };
  (ProcessedWebhookEvent.findOne as any) = () => ({ lean: async () => null });
  (ProcessedWebhookEvent.create as any) = async (data: any) => data;
  (ProcessedWebhookEvent.updateOne as any) = async () => ({ modifiedCount: 1 });
  (ProcessedWebhookEvent.deleteOne as any) = async () => ({ deletedCount: 1 });
  await handleShippingWebhook(validPayload, undefined, 'shiprocket');
  assert.equal(qcGroup.status, 'OutForDelivery');
  assert.deepEqual(query.fulfillmentGroups.$elemMatch.fulfillmentType.$in, ['COURIER_SHIPPING', 'THIRD_PARTY_API']);
});

test('mixed order updates only its Ecommerce fulfillment group', async () => {
  const qcGroup: any = { groupId: 'QC', fulfillmentType: 'LOCAL_DELIVERY', status: 'OutForDelivery', shippingDetails: {} };
  const ecommerceGroup: any = {
    groupId: 'ECOM', fulfillmentType: 'COURIER_SHIPPING', status: 'Processing',
    shippingDetails: { awbNumber: validPayload.awb }, thirdPartyOrderDetails: { providerId: 'shiprocket' },
  };
  installWebhookDb(() => ({ fulfillmentGroups: [qcGroup, ecommerceGroup], status: 'Processed' }));
  await handleShippingWebhook(validPayload, undefined, 'shiprocket');
  assert.equal(qcGroup.status, 'OutForDelivery');
  assert.equal(ecommerceGroup.status, 'Shipped');
});

function installSellerDb(initial: any) {
  const seller = JSON.parse(JSON.stringify(initial));
  const setPath = (target: any, dotted: string, value: any) => {
    const parts = dotted.split('.');
    let cursor = target;
    for (const part of parts.slice(0, -1)) cursor = cursor[part] ||= {};
    cursor[parts[parts.length - 1]] = value;
  };
  const unsetPath = (target: any, dotted: string) => {
    const parts = dotted.split('.');
    let cursor = target;
    for (const part of parts.slice(0, -1)) cursor = cursor?.[part];
    if (cursor) delete cursor[parts[parts.length - 1]];
  };
  const applyUpdate = (update: any) => {
    for (const [key, value] of Object.entries(update.$set || {})) setPath(seller, key, value);
    for (const key of Object.keys(update.$unset || {})) unsetPath(seller, key);
  };
  (Seller.findById as any) = async () => seller;
  (Seller.updateOne as any) = async (_filter: any, update: any) => { applyUpdate(update); return { modifiedCount: 1 }; };
  (Seller.findOneAndUpdate as any) = async (_filter: any, update: any) => {
    const nextStatus = update.$set?.['shippingConfig.shiprocketPickupStatus'];
    if (seller.shippingConfig?.shiprocketPickupStatus === nextStatus && ['PROVISIONING', 'RETIRING'].includes(nextStatus)) return null;
    applyUpdate(update);
    return seller;
  };
  const retirements: any[] = [];
  (ShiprocketPickupRetirement.updateOne as any) = async (_filter: any, update: any) => {
    if (retirements.length === 0) retirements.push({ ...update.$setOnInsert });
    return { acknowledged: true, upsertedCount: retirements.length === 1 ? 1 : 0 };
  };
  return Object.assign(seller, { __retirements: retirements });
}

const completeSeller = (vendorType: string, suffix: string) => ({
  _id: `507f1f77bcf86cd799439${suffix}`,
  sellerName: 'Test Vendor', storeName: 'Test Store', email: 'vendor@example.com', mobile: '9876543210',
  city: 'Pune', vendorType, status: 'Approved',
  shippingConfig: { pickupAddress: '12 Test Road', pickupPincode: '411001', pickupCity: 'Pune', pickupState: 'Maharashtra' },
});

function pickupApi(existing: any[] = [], failCreate = false) {
  const calls = { list: 0, create: 0 };
  const api: ShiprocketPickupApi = {
    async listPickupLocations() { calls.list += 1; return existing; },
    async createPickupLocation(payload) {
      calls.create += 1;
      if (failCreate) throw new Error('simulated remote outage');
      return { id: 'PICKUP-1', name: payload.pickup_location };
    },
  };
  return { api, calls };
}

function activeCleanupSeller(vendorType: 'ECOMMERCE' | 'HYBRID', suffix: string) {
  const seller = completeSeller(vendorType, suffix);
  const payload = buildShiprocketPickupPayload(seller as any);
  seller.shippingConfig = {
    ...seller.shippingConfig,
    shiprocketPickupLocationId: `PICKUP-${suffix}`,
    shiprocketPickupLocationName: payload.pickup_location,
    shiprocketPickupStatus: 'ACTIVE',
    shiprocketPickupAddressFingerprint: getPickupAddressFingerprint(payload),
  } as any;
  return seller;
}

function remoteFor(seller: any, overrides: Record<string, unknown> = {}) {
  return {
    id: seller.shippingConfig.shiprocketPickupLocationId,
    pickup_location: seller.shippingConfig.shiprocketPickupLocationName,
    address: '12 Test Road', address_2: '', city: 'Pune', state: 'Maharashtra', country: 'India', pin_code: '411001',
    ...overrides,
  };
}

test('QUICK_COMMERCE approval makes zero pickup API calls', async () => {
  installSellerDb(completeSeller('QUICK_COMMERCE', '001'));
  const mock = pickupApi();
  const result = await provisionShiprocketPickupLocation('seller-qc', mock.api);
  assert.equal(result.status, 'NOT_REQUIRED');
  assert.deepEqual(mock.calls, { list: 0, create: 0 });
});

for (const [vendorType, suffix] of [['ECOMMERCE', '002'], ['HYBRID', '003']] as const) {
  test(`${vendorType} approval creates exactly one pickup and rerun creates none`, async () => {
    const seller = installSellerDb(completeSeller(vendorType, suffix));
    const mock = pickupApi();
    const first = await provisionShiprocketPickupLocation('seller-ecom', mock.api);
    const second = await provisionShiprocketPickupLocation('seller-ecom', mock.api);
    assert.equal(first.status, 'ACTIVE');
    assert.equal(second.reused, true);
    assert.equal(mock.calls.create, 1);
    assert.equal(seller.shippingConfig.shiprocketPickupLocationId, 'PICKUP-1');
  });
}

test('stored active pickup ID prevents a new remote call', async () => {
  const seller = installSellerDb(completeSeller('ECOMMERCE', '004'));
  const mock = pickupApi();
  await provisionShiprocketPickupLocation('seller', mock.api);
  mock.calls.list = 0; mock.calls.create = 0;
  const result = await provisionShiprocketPickupLocation('seller', mock.api);
  assert.equal(result.reused, true);
  assert.deepEqual(mock.calls, { list: 0, create: 0 });
  assert.ok(seller.shippingConfig.shiprocketPickupLocationId);
});

test('concurrent approval/retry calls acquire one lease and create one pickup', async () => {
  installSellerDb(completeSeller('ECOMMERCE', '009'));
  let createCalls = 0;
  const api: ShiprocketPickupApi = {
    async listPickupLocations() { return []; },
    async createPickupLocation(payload) {
      createCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { id: 'PICKUP-CONCURRENT', name: payload.pickup_location };
    },
  };
  const [first, second] = await Promise.all([
    provisionShiprocketPickupLocation('seller', api),
    provisionShiprocketPickupLocation('seller', api),
  ]);
  assert.equal(createCalls, 1);
  assert.deepEqual(new Set([first.status, second.status]), new Set(['ACTIVE', 'PROVISIONING']));
});

test('missing pickup address creates a clear failure without an API call', async () => {
  const invalid = completeSeller('ECOMMERCE', '005');
  invalid.shippingConfig.pickupAddress = '';
  const seller = installSellerDb(invalid);
  const mock = pickupApi();
  const result = await provisionShiprocketPickupLocation('seller', mock.api);
  assert.equal(result.status, 'FAILED');
  assert.match(result.message, /pickup address/);
  assert.equal(mock.calls.create, 0);
  assert.equal(seller.status, 'Approved');
});

test('remote failure preserves approval and a successful retry creates once', async () => {
  const seller = installSellerDb(completeSeller('HYBRID', '006'));
  const failedApi = pickupApi([], true);
  const failed = await provisionShiprocketPickupLocation('seller', failedApi.api);
  assert.equal(failed.status, 'FAILED');
  assert.equal(seller.status, 'Approved');
  const retryApi = pickupApi();
  const retried = await provisionShiprocketPickupLocation('seller', retryApi.api);
  assert.equal(retried.status, 'ACTIVE');
  assert.equal(retryApi.calls.create, 1);
});

test('deterministic remote match is reused after a local-save interruption', async () => {
  const seller = installSellerDb(completeSeller('ECOMMERCE', '007'));
  const name = buildShiprocketPickupLocationName(seller._id);
  const mock = pickupApi([{ id: 77, pickup_location: name, address: '12 Test Road', address_2: '', city: 'Pune', state: 'Maharashtra', country: 'India', pin_code: '411001' }]);
  const result = await provisionShiprocketPickupLocation('seller', mock.api);
  assert.equal(result.reused, true);
  assert.equal(mock.calls.create, 0);
  assert.equal(seller.shippingConfig.shiprocketPickupLocationId, '77');
});

test('changed vendor address never creates a duplicate pickup location', async () => {
  const seller = installSellerDb(completeSeller('ECOMMERCE', '008'));
  const name = buildShiprocketPickupLocationName(seller._id);
  seller.shippingConfig.shiprocketPickupLocationId = '88';
  seller.shippingConfig.shiprocketPickupLocationName = name;
  seller.shippingConfig.shiprocketPickupStatus = 'PENDING';
  const mock = pickupApi([{ id: 88, pickup_location: name, address: 'Old Road', address_2: '', city: 'Pune', state: 'Maharashtra', country: 'India', pin_code: '411001' }]);
  const result = await provisionShiprocketPickupLocation('seller', mock.api);
  assert.equal(result.status, 'FAILED');
  assert.match(result.message, /changed/);
  assert.equal(mock.calls.create, 0);
});

for (const [vendorType, suffix] of [['ECOMMERCE', '010'], ['HYBRID', '011']] as const) {
  test(`${vendorType} deletion retires its verified pickup exactly once`, async () => {
    const seller = installSellerDb(activeCleanupSeller(vendorType, suffix));
    const mock = pickupApi([remoteFor(seller)]);
    const result = await cleanupSellerShiprocketPickup(seller, mock.api);
    assert.equal(result.status, 'RETIRED');
    assert.equal(mock.calls.list, 1);
    assert.equal(mock.calls.create, 0);
    assert.equal(seller.shippingConfig.shiprocketPickupStatus, 'RETIRED');
    assert.equal(seller.__retirements.length, 1);
    assert.equal(seller.__retirements[0].pickupLocationId, `PICKUP-${suffix}`);
  });
}

test('Quick Commerce deletion makes no Shiprocket cleanup call', async () => {
  const seller = installSellerDb(completeSeller('QUICK_COMMERCE', '012'));
  const mock = pickupApi();
  const result = await cleanupSellerShiprocketPickup(seller, mock.api);
  assert.equal(result.status, 'NOT_REQUIRED');
  assert.deepEqual(mock.calls, { list: 0, create: 0 });
});

test('platform/admin pickup cleanup is rejected before any remote call', async () => {
  const input: any = activeCleanupSeller('ECOMMERCE', '013');
  input.isPlatform = true;
  const seller = installSellerDb(input);
  const mock = pickupApi([remoteFor(seller, { is_primary: 1 })]);
  await assert.rejects(
    cleanupSellerShiprocketPickup(seller, mock.api),
    (error: any) => error instanceof ShiprocketPickupCleanupError && error.apiCode === 'SHIPROCKET_PICKUP_PROTECTED'
  );
  assert.equal(mock.calls.list, 0);
});

test('remote primary pickup is rejected even when its name looks vendor-owned', async () => {
  const seller = installSellerDb(activeCleanupSeller('ECOMMERCE', '020'));
  const mock = pickupApi([remoteFor(seller, { is_primary_location: 1 })]);
  await assert.rejects(
    cleanupSellerShiprocketPickup(seller, mock.api),
    (error: any) => error.apiCode === 'SHIPROCKET_PICKUP_PROTECTED'
  );
  assert.equal(seller.__retirements.length, 0);
  assert.equal(seller.shippingConfig.shiprocketPickupStatus, 'RETRY_PENDING');
});

test('wrong stored pickup ID is rejected without touching another vendor pickup', async () => {
  const seller = installSellerDb(activeCleanupSeller('ECOMMERCE', '014'));
  seller.shippingConfig.shiprocketPickupLocationId = 'WRONG-ID';
  const other = { ...remoteFor(seller), id: 'RIGHT-ID' };
  const mock = pickupApi([other, { id: 'OTHER-ID', pickup_location: 'OLOVELY-OTHERSELLER000000000001' }]);
  await assert.rejects(
    cleanupSellerShiprocketPickup(seller, mock.api),
    (error: any) => error.apiCode === 'SHIPROCKET_PICKUP_IDENTITY_MISMATCH'
  );
  assert.equal(mock.calls.list, 1);
  assert.equal(mock.calls.create, 0);
  assert.equal(seller.__retirements.length, 0);
  assert.equal(seller.shippingConfig.shiprocketPickupStatus, 'RETRY_PENDING');
});

test('already-retired pickup is idempotent and makes no duplicate request', async () => {
  const input: any = activeCleanupSeller('ECOMMERCE', '015');
  input.shippingConfig.shiprocketPickupStatus = 'RETIRED';
  const seller = installSellerDb(input);
  const mock = pickupApi([remoteFor(seller)]);
  const result = await cleanupSellerShiprocketPickup(seller, mock.api);
  assert.equal(result.alreadyRetired, true);
  assert.deepEqual(mock.calls, { list: 0, create: 0 });
});

test('already-absent remote pickup retires locally without inventing a delete call', async () => {
  const seller = installSellerDb(activeCleanupSeller('ECOMMERCE', '021'));
  const mock = pickupApi([]);
  const result = await cleanupSellerShiprocketPickup(seller, mock.api);
  assert.equal(result.status, 'RETIRED');
  assert.equal(result.remoteLocationFound, false);
  assert.deepEqual(mock.calls, { list: 1, create: 0 });
  assert.equal(seller.__retirements[0].pickupLocationId, 'PICKUP-021');
});

test('Shiprocket verification outage leaves seller retryable and blocks deletion', async () => {
  const seller = installSellerDb(activeCleanupSeller('HYBRID', '016'));
  const api: ShiprocketPickupApi = {
    async listPickupLocations() { throw new Error('simulated outage with sensitive upstream detail'); },
    async createPickupLocation() { throw new Error('not used'); },
  };
  await assert.rejects(
    cleanupSellerShiprocketPickup(seller, api),
    (error: any) => error.apiCode === 'SHIPROCKET_PICKUP_CLEANUP_PENDING' && error.statusCode === 503
  );
  assert.equal(seller.shippingConfig.shiprocketPickupStatus, 'RETRY_PENDING');
  assert.doesNotMatch(seller.shippingConfig.shiprocketPickupLastError, /sensitive upstream detail/);
  assert.equal(seller.__retirements.length, 0);
});

test('remote address mismatch fails safely without retirement', async () => {
  const seller = installSellerDb(activeCleanupSeller('ECOMMERCE', '017'));
  const mock = pickupApi([remoteFor(seller, { address: 'Different Address' })]);
  await assert.rejects(
    cleanupSellerShiprocketPickup(seller, mock.api),
    (error: any) => error.apiCode === 'SHIPROCKET_PICKUP_ADDRESS_MISMATCH'
  );
  assert.equal(seller.__retirements.length, 0);
  assert.equal(mock.calls.create, 0);
});

test('second cleanup after success is a no-op', async () => {
  const seller = installSellerDb(activeCleanupSeller('ECOMMERCE', '018'));
  const mock = pickupApi([remoteFor(seller)]);
  await cleanupSellerShiprocketPickup(seller, mock.api);
  await cleanupSellerShiprocketPickup(seller, mock.api);
  assert.equal(mock.calls.list, 1);
  assert.equal(seller.__retirements.length, 1);
});

test('shipment pickup guard rejects deleted, retired, Quick Commerce, and mismatched sellers', () => {
  const active: any = activeCleanupSeller('ECOMMERCE', '019');
  assert.equal(getActiveSellerShiprocketPickupName(active), active.shippingConfig.shiprocketPickupLocationName);
  assert.throws(() => getActiveSellerShiprocketPickupName(null), /no longer exists/);
  const retired = { ...active, shippingConfig: { ...active.shippingConfig, shiprocketPickupStatus: 'RETIRED' } };
  assert.throws(() => getActiveSellerShiprocketPickupName(retired), /ACTIVE and verified/);
  const quick = { ...active, vendorType: 'QUICK_COMMERCE' };
  assert.throws(() => getActiveSellerShiprocketPickupName(quick), /Ecommerce or Hybrid/);
  const wrongName = { ...active, shippingConfig: { ...active.shippingConfig, shiprocketPickupLocationName: 'Home' } };
  assert.throws(() => getActiveSellerShiprocketPickupName(wrongName), /pickup identity is invalid/);
});

test('retired seller cannot be reprovisioned by the existing retry flow', async () => {
  const input: any = activeCleanupSeller('ECOMMERCE', '022');
  input.shippingConfig.shiprocketPickupStatus = 'RETIRED';
  installSellerDb(input);
  const mock = pickupApi();
  const result = await provisionShiprocketPickupLocation(input._id, mock.api);
  assert.equal(result.status, 'RETIRED');
  assert.deepEqual(mock.calls, { list: 0, create: 0 });
});

test('admin and self-delete controllers use the same centralized cleanup service', () => {
  const adminSource = fs.readFileSync(path.resolve(__dirname, '../modules/seller/controllers/sellerController.ts'), 'utf8');
  const selfSource = fs.readFileSync(path.resolve(__dirname, '../modules/seller/controllers/sellerAuthController.ts'), 'utf8');
  assert.match(adminSource, /await cleanupSellerShiprocketPickup\(seller\)/);
  assert.match(selfSource, /await cleanupSellerShiprocketPickup\(seller\)/);
  assert.ok(adminSource.indexOf('cleanupSellerShiprocketPickup(seller)') < adminSource.indexOf('Seller.findByIdAndDelete(id)'));
  assert.ok(selfSource.indexOf('cleanupSellerShiprocketPickup(seller)') < selfSource.indexOf('Seller.findByIdAndDelete(sellerId)'));
});

test('pickup integration contains no invented remote delete/deactivate endpoint', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../services/shipping/shiprocketPickupService.ts'), 'utf8');
  assert.doesNotMatch(source, /method:\s*['"]DELETE['"]/);
  assert.doesNotMatch(source, /settings\/company\/(delete|deactivate|archive)/i);
});

test('credentials and bearer tokens are neither logged nor returned by pickup code', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../services/shipping/shiprocketPickupService.ts'), 'utf8');
  assert.doesNotMatch(source, /console\.(log|error|warn)/);
  assert.doesNotMatch(source, /Authorization\s*:/);
  assert.doesNotMatch(source, /SHIPROCKET_(EMAIL|PASSWORD)/);
});

async function main() {
  let passed = 0;
  try {
    for (const item of tests) {
      await item.run();
      passed += 1;
      console.log(`PASS ${item.name}`);
    }
    console.log(`\nShiprocket isolated tests: ${passed} passed, 0 failed`);
  } finally {
    (Order.findOne as any) = originalOrderFindOne;
    (ProcessedWebhookEvent.findOne as any) = originalEventFindOne;
    (ProcessedWebhookEvent.create as any) = originalEventCreate;
    (ProcessedWebhookEvent.updateOne as any) = originalEventUpdateOne;
    (ProcessedWebhookEvent.deleteOne as any) = originalEventDeleteOne;
    (Seller.findById as any) = originalSellerFindById;
    (Seller.updateOne as any) = originalSellerUpdateOne;
    (Seller.findOneAndUpdate as any) = originalSellerFindOneAndUpdate;
    (ShiprocketPickupRetirement.updateOne as any) = originalRetirementUpdateOne;
    (Return.findOne as any) = originalReturnFindOne;
    if (originalWebhookToken === undefined) delete process.env.SHIPROCKET_WEBHOOK_TOKEN;
    else process.env.SHIPROCKET_WEBHOOK_TOKEN = originalWebhookToken;
  }
}

main().catch((error) => {
  console.error('Shiprocket isolated tests failed:', error);
  process.exitCode = 1;
});
