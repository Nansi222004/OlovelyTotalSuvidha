import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Product from '../models/Product';
import Seller from '../models/Seller';
import Return from '../models/Return';
import ProcessedWebhookEvent from '../models/ProcessedWebhookEvent';
import { shiprocketHttpClient } from '../services/shipping/shiprocketHttpClient';
import {
  buildShiprocketForwardPayload,
  buildShiprocketReturnPayload,
  SHIPROCKET_EXCHANGE_ENDPOINT,
  SHIPROCKET_RETURN_ENDPOINT,
  shiprocketProvider,
} from '../services/shipping/shiprocketProvider';
import { dispatchForwardEcommerceShipment, handleShippingWebhook } from '../services/shipping/shippingService';
import {
  buildExchangeReplacement,
  createApprovedReturnLogistics,
  processReturnQc,
  ReturnLogisticsError,
} from '../services/returnShippingService';

const inventoryService = require('../services/inventoryService');
const lifecycleService = require('../services/returnLifecycleService');

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });

const originals = {
  returnFindById: Return.findById,
  returnFindOne: Return.findOne,
  returnFindOneAndUpdate: Return.findOneAndUpdate,
  returnFindByIdAndUpdate: Return.findByIdAndUpdate,
  returnUpdateOne: Return.updateOne,
  orderFindById: Order.findById,
  orderFindOne: Order.findOne,
  itemFindById: OrderItem.findById,
  productFindById: Product.findById,
  sellerFindById: Seller.findById,
  eventFindOne: ProcessedWebhookEvent.findOne,
  eventCreate: ProcessedWebhookEvent.create,
  eventUpdateOne: ProcessedWebhookEvent.updateOne,
  eventDeleteOne: ProcessedWebhookEvent.deleteOne,
  hasCredentials: shiprocketHttpClient.hasCredentials,
  request: shiprocketHttpClient.request,
  recordReturn: inventoryService.recordReturn,
  mutateStock: inventoryService.mutateStock,
  settle: lifecycleService.triggerReturnFinancialSettlement,
};

const oid = (value: string) => ({ toString: () => value });
const sellerId = '507f1f77bcf86cd799439011';
const productId = '507f1f77bcf86cd799439012';
const itemId = '507f1f77bcf86cd799439013';
const orderId = '507f1f77bcf86cd799439014';
const returnId = '507f1f77bcf86cd799439015';

function activeSeller(overrides: Record<string, unknown> = {}) {
  return {
    _id: oid(sellerId),
    vendorType: 'ECOMMERCE',
    storeName: 'Isolated Seller',
    sellerName: 'Isolated Seller',
    email: 'seller@example.invalid',
    mobile: '9999999999',
    city: 'Delhi',
    shippingConfig: {
      pickupAddress: 'Mock seller address', pickupCity: 'Delhi', pickupState: 'Delhi', pickupPincode: '110001',
      shiprocketPickupStatus: 'ACTIVE', shiprocketPickupLocationId: 101,
      shiprocketPickupLocationName: `OLOVELY-${sellerId.toUpperCase()}`,
    },
    ...overrides,
  };
}

function orderItem(productType = 'ECOMMERCE') {
  return {
    _id: oid(itemId), product: oid(productId), seller: oid(sellerId), productType,
    productName: 'Isolated Product', sku: 'ISO-SKU', unitPrice: 100, quantity: 1,
  };
}

function orderDoc() {
  return {
    _id: oid(orderId), customerName: 'Mock Customer', customerEmail: 'customer@example.invalid',
    customerPhone: '9000000000', paymentMethod: 'PREPAID',
    deliveryAddress: { address: 'Mock customer address', city: 'Delhi', state: 'Delhi', pincode: '110002' },
    fulfillmentGroups: [{ groupId: 'ECOM-1', items: [oid(itemId)] }],
  };
}

function returnDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: oid(returnId), order: oid(orderId), orderItem: oid(itemId), customer: oid('customer'),
    requestType: 'RETURN', status: 'Approved', quantity: 1, reason: 'Damaged',
    reverseLogisticsStatus: 'PENDING',
    ...overrides,
  };
}

function installReturnDb(doc: any, item = orderItem(), seller = activeSeller()) {
  const updates: any[] = [];
  (Return.findById as any) = async () => doc;
  (OrderItem.findById as any) = async () => item;
  (Order.findById as any) = async () => orderDoc();
  (Product.findById as any) = async () => ({
    _id: oid(productId), seller: oid(sellerId), productName: 'Isolated Product', productType: item.productType,
    sku: 'ISO-SKU', price: 100, stock: 4, packageDetails: { weightKg: 0.5, dimensionsCm: { length: 10, width: 10, height: 5 } },
  });
  (Seller.findById as any) = async () => seller;
  (Return.findOneAndUpdate as any) = async (_filter: any, update: any) => {
    updates.push(update);
    Object.assign(doc, update.$set || {});
    return doc;
  };
  (Return.findByIdAndUpdate as any) = async (_id: any, update: any) => {
    updates.push(update);
    for (const [key, value] of Object.entries(update.$set || {})) {
      if (key.startsWith('replacement.')) doc.replacement[key.slice(12)] = value;
      else doc[key] = value;
    }
    return doc;
  };
  (Return.updateOne as any) = async (_filter: any, update: any) => {
    updates.push(update);
    for (const [key, value] of Object.entries(update.$set || {})) {
      if (key.startsWith('replacement.')) doc.replacement[key.slice(12)] = value;
      else doc[key] = value;
    }
    return { modifiedCount: 1 };
  };
  return updates;
}

function restore() {
  (Return.findById as any) = originals.returnFindById;
  (Return.findOne as any) = originals.returnFindOne;
  (Return.findOneAndUpdate as any) = originals.returnFindOneAndUpdate;
  (Return.findByIdAndUpdate as any) = originals.returnFindByIdAndUpdate;
  (Return.updateOne as any) = originals.returnUpdateOne;
  (Order.findById as any) = originals.orderFindById;
  (Order.findOne as any) = originals.orderFindOne;
  (OrderItem.findById as any) = originals.itemFindById;
  (Product.findById as any) = originals.productFindById;
  (Seller.findById as any) = originals.sellerFindById;
  (ProcessedWebhookEvent.findOne as any) = originals.eventFindOne;
  (ProcessedWebhookEvent.create as any) = originals.eventCreate;
  (ProcessedWebhookEvent.updateOne as any) = originals.eventUpdateOne;
  (ProcessedWebhookEvent.deleteOne as any) = originals.eventDeleteOne;
  (shiprocketHttpClient.hasCredentials as any) = originals.hasCredentials;
  (shiprocketHttpClient.request as any) = originals.request;
  inventoryService.recordReturn = originals.recordReturn;
  inventoryService.mutateStock = originals.mutateStock;
  lifecycleService.triggerReturnFinancialSettlement = originals.settle;
}

const completeReturnRequest: any = {
  orderId, fulfillmentGroupId: 'ECOM-1', returnId, idempotencyKey: `return:${returnId}:shiprocket:create`,
  item: { productId, productName: 'Isolated Product', sku: 'ISO-SKU', quantity: 1, unitPrice: 100, weightKg: 0.5 },
  pickupAddress: { customerName: 'Mock Customer', email: 'customer@example.invalid', phone: '9000000000', address: 'Mock customer address', city: 'Delhi', state: 'Delhi', country: 'India', pincode: '110002' },
  destinationAddress: { name: 'Isolated Seller', email: 'seller@example.invalid', phone: '9999999999', address: 'Mock seller address', city: 'Delhi', state: 'Delhi', country: 'India', pincode: '110001' },
  paymentMethod: 'PREPAID', subtotal: 100, reason: 'Damaged',
};

const completeForwardRequest: any = {
  source: 'CUSTOMER_ORDER',
  idempotencyKey: `OLOVELY_${orderId}_ECOM-1`, orderId, fulfillmentGroupId: 'ECOM-1',
  customerName: 'Mock Customer', customerEmail: 'customer@example.invalid', customerPhone: '9000000000',
  shippingAddress: { address: 'Mock customer address', city: 'Delhi', state: 'Delhi', pincode: '110002' },
  pickupDetails: {
    sellerId, sellerName: 'Isolated Seller', pickupAddress: 'Mock seller address', pickupPincode: '110001',
    pickupLocationId: '101', pickupLocationName: `OLOVELY-${sellerId.toUpperCase()}`,
  },
  items: [{ productId, productName: 'Isolated Product', sku: 'ISO-SKU', quantity: 1, unitPrice: 100, variationId: 'variant-1', hsnCode: '1001', taxRate: 5, weightKg: 0.5 }],
  paymentMethod: 'COD', subtotal: 100, shippingCharges: 10, totalDiscount: 0,
  totalWeightKg: 0.5, dimensionsCm: { length: 10, width: 10, height: 5 },
};

test('official endpoint constants are exact and distinct', () => {
  assert.equal(SHIPROCKET_RETURN_ENDPOINT, '/v1/external/orders/create/return');
  assert.equal(SHIPROCKET_EXCHANGE_ENDPOINT, '/v1/external/orders/create/exchange');
});

test('normal Ecommerce forward shipment uses the documented adhoc endpoint with AWB and pickup', async () => {
  const calls: any[] = [];
  (shiprocketHttpClient.hasCredentials as any) = () => true;
  (shiprocketHttpClient.request as any) = async (config: any) => {
    calls.push(config);
    if (config.url.includes('/settings/company/pickup')) {
      return { data: { shipping_address: [{ id: 101, pickup_location: `OLOVELY-${sellerId.toUpperCase()}`, is_primary: 0 }] } };
    }
    if (config.method === 'GET') return { data: [] };
    if (config.url === '/v1/external/orders/create/adhoc') return { order_id: 11, shipment_id: 12 };
    if (config.url.includes('assign/awb')) return { response: { data: { awb_code: 'FWD-AWB', courier_name: 'Mock Courier' } } };
    return { pickup_status: 1 };
  };
  const result = await shiprocketProvider.createShipment(completeForwardRequest);
  assert.equal(calls.filter((call) => call.url === '/v1/external/orders/create/adhoc').length, 1);
  assert.equal(calls.some((call) => call.url.includes('assign/awb')), true);
  assert.equal(calls.some((call) => call.url.includes('generate/pickup')), true);
  assert.equal(result.awbNumber, 'FWD-AWB');
});

test('wrong remote pickup ID/name blocks normal and replacement forward POSTs', async () => {
  const calls: any[] = [];
  (shiprocketHttpClient.hasCredentials as any) = () => true;
  (shiprocketHttpClient.request as any) = async (config: any) => {
    calls.push(config);
    if (config.url.includes('/settings/company/pickup')) {
      return { data: { shipping_address: [{ id: 999, pickup_location: 'Home', is_primary: 1 }] } };
    }
    if (config.method === 'GET') return { data: [] };
    throw new Error('No forward operation should be attempted');
  };
  await assert.rejects(() => shiprocketProvider.createShipment(completeForwardRequest), /stored seller pickup ID/);
  assert.equal(calls.some((call) => call.method === 'POST'), false);
});

test('uncertain idempotency lookup blocks a duplicate forward POST', async () => {
  const calls: any[] = [];
  (shiprocketHttpClient.hasCredentials as any) = () => true;
  (shiprocketHttpClient.request as any) = async (config: any) => {
    calls.push(config);
    throw new Error('simulated read-only lookup outage');
  };
  await assert.rejects(() => shiprocketProvider.createShipment(completeForwardRequest), /simulated read-only lookup outage/);
  assert.equal(calls.some((call) => call.method === 'POST'), false);
});

test('existing forward order is reused without duplicate order or AWB creation', async () => {
  const calls: any[] = [];
  (shiprocketHttpClient.hasCredentials as any) = () => true;
  (shiprocketHttpClient.request as any) = async (config: any) => {
    calls.push(config);
    return { data: [{
      id: 11, channel_order_id: completeForwardRequest.idempotencyKey, status: 'SHIPPED',
      shipments: [{ id: 12, awb: 'EXISTING-AWB', courier: 'Mock Courier' }],
    }] };
  };
  const result = await shiprocketProvider.createShipment(completeForwardRequest);
  assert.equal(result.awbNumber, 'EXISTING-AWB');
  assert.equal(calls.filter((call) => call.method === 'POST').length, 0);
});

test('normal orders and replacements share one dispatcher and one Shiprocket payload mapper', () => {
  const shippingSource = fs.readFileSync(path.resolve(__dirname, '../services/shipping/shippingService.ts'), 'utf8');
  const replacementSource = fs.readFileSync(path.resolve(__dirname, '../services/returnShippingService.ts'), 'utf8');
  assert.match(shippingSource, /dispatchForwardEcommerceShipment\(shipmentRequest, seller, provider\)/);
  assert.match(replacementSource, /dispatchForwardEcommerceShipment\(request, seller, provider\)/);
  assert.equal((shippingSource.match(/provider\.createShipment\(/g) || []).length, 1);
  assert.doesNotMatch(replacementSource, /provider\.createShipment\(/);

  const normal: any = buildShiprocketForwardPayload(completeForwardRequest);
  const replacement: any = buildShiprocketForwardPayload({
    ...completeForwardRequest,
    source: 'EXCHANGE_REPLACEMENT',
    idempotencyKey: `exchange:${returnId}:replacement:create`,
    paymentMethod: 'PREPAID',
    shippingCharges: 0,
  });
  assert.equal(normal.pickup_location, replacement.pickup_location);
  assert.deepEqual(normal.order_items, replacement.order_items);
  assert.equal(normal.billing_pincode, replacement.billing_pincode);
  assert.equal(normal.payment_method, 'COD');
  assert.equal(replacement.payment_method, 'Prepaid');
});

test('shared dispatcher carries the seller pickup ID and deterministic name', async () => {
  let captured: any;
  await dispatchForwardEcommerceShipment(
    { ...completeForwardRequest, pickupDetails: undefined } as any,
    activeSeller() as any,
    { providerId: 'shiprocket', createShipment: async (request: any) => {
      captured = request;
      return { externalOrderId: '1', shipmentId: '2', awbNumber: 'A', status: 'Manifested' };
    } } as any
  );
  assert.equal(captured.pickupDetails.pickupLocationId, '101');
  assert.equal(captured.pickupDetails.pickupLocationName, `OLOVELY-${sellerId.toUpperCase()}`);
});

test('shared dispatcher blocks missing ID, wrong name and Admin/Home pickup before provider call', async () => {
  const invalidSellers = [
    activeSeller({ shippingConfig: { ...activeSeller().shippingConfig, shiprocketPickupLocationId: undefined } }),
    activeSeller({ shippingConfig: { ...activeSeller().shippingConfig, shiprocketPickupLocationName: 'OLOVELY-OTHERSELLER' } }),
    activeSeller({ shippingConfig: { ...activeSeller().shippingConfig, shiprocketPickupLocationName: 'Home' } }),
  ];
  for (const seller of invalidSellers) {
    let calls = 0;
    await assert.rejects(() => dispatchForwardEcommerceShipment(
      { ...completeForwardRequest, pickupDetails: undefined } as any,
      seller as any,
      { providerId: 'shiprocket', createShipment: async () => { calls++; return {}; } } as any
    ));
    assert.equal(calls, 0);
  }
});

test('return payload maps identity, addresses, item, value and package data', () => {
  const payload: any = buildShiprocketReturnPayload(completeReturnRequest);
  assert.equal(payload.order_id, completeReturnRequest.idempotencyKey);
  assert.match(payload.order_date, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(payload.pickup_pincode, '110002');
  assert.equal(payload.shipping_pincode, '110001');
  assert.equal(payload.order_items[0].sku, 'ISO-SKU');
  assert.equal(payload.order_items[0].selling_price, 100);
  assert.equal(payload.sub_total, 100);
  assert.equal(payload.weight, 0.5);
});

test('Shiprocket return API is queried for idempotency then created exactly once', async () => {
  const calls: any[] = [];
  (shiprocketHttpClient.hasCredentials as any) = () => true;
  (shiprocketHttpClient.request as any) = async (config: any) => {
    calls.push(config);
    if (config.method === 'GET') return { data: [] };
    if (config.url === SHIPROCKET_RETURN_ENDPOINT) return { order_id: 1, shipment_id: 2 };
    if (config.url.includes('assign/awb')) return { response: { data: { awb_code: 'RET-AWB', courier_name: 'Mock Courier' } } };
    return { pickup_status: 1 };
  };
  const result = await shiprocketProvider.createReturn!(completeReturnRequest);
  assert.equal(calls.filter((call) => call.url === SHIPROCKET_RETURN_ENDPOINT).length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.equal(result.returnAwbNumber, 'RET-AWB');
  assert.equal(calls.find((call) => call.url.includes('assign/awb')).data.is_return, 1);
  assert.equal(calls.some((call) => call.url === SHIPROCKET_EXCHANGE_ENDPOINT), false);
});

test('existing Shiprocket return is reused without duplicate POST', async () => {
  const calls: any[] = [];
  (shiprocketHttpClient.hasCredentials as any) = () => true;
  (shiprocketHttpClient.request as any) = async (config: any) => {
    calls.push(config);
    if (config.method === 'GET') return { data: [{ channel_order_id: completeReturnRequest.idempotencyKey, order_id: 7, shipment_id: 8, awb_code: 'EXISTING' }] };
    return {};
  };
  const result = await shiprocketProvider.createReturn!(completeReturnRequest);
  assert.equal(result.externalOrderId, '7');
  assert.equal(calls.filter((call) => call.url === SHIPROCKET_RETURN_ENDPOINT).length, 0);
});

test('return provider maps remote errors without leaking sensitive response data', async () => {
  (shiprocketHttpClient.hasCredentials as any) = () => true;
  (shiprocketHttpClient.request as any) = async () => { const err: any = new Error('secret upstream body'); err.statusCode = 422; throw err; };
  await assert.rejects(() => shiprocketProvider.createReturn!(completeReturnRequest), /HTTP 422/);
  await assert.rejects(() => shiprocketProvider.createReturn!(completeReturnRequest), (error: any) => !String(error.message).includes('secret upstream body'));
});

test('customer request and views do not directly call a shipping provider', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../modules/customer/controllers/customerOrderController.ts'), 'utf8');
  const fn = source.slice(source.indexOf('export const requestItemReturn'), source.indexOf('export const getCustomerReturns'));
  assert.doesNotMatch(fn, /createReturn\s*\(/);
});

test('seller and admin approvals share the centralized reverse-logistics service', () => {
  const seller = fs.readFileSync(path.resolve(__dirname, '../modules/seller/controllers/returnController.ts'), 'utf8');
  const admin = fs.readFileSync(path.resolve(__dirname, '../modules/admin/controllers/adminOrderController.ts'), 'utf8');
  assert.match(seller, /createApprovedReturnLogistics\(id,/);
  assert.match(admin, /createApprovedReturnLogistics\(id,/);
  assert.doesNotMatch(seller, /shiprocketProvider\.createReturn/);
  assert.doesNotMatch(admin, /shiprocketProvider\.createReturn/);
});

test('Ecommerce approval creates one reverse leg with a stable idempotency key', async () => {
  const doc = returnDoc();
  installReturnDb(doc);
  const requests: any[] = [];
  const provider: any = { providerId: 'shiprocket', createReturn: async (request: any) => {
    requests.push(request); return { externalOrderId: 'RET-1', shipmentId: 'SHIP-1', returnAwbNumber: 'AWB-1', carrier: 'Mock' };
  } };
  let result: any;
  try {
    result = await createApprovedReturnLogistics(returnId, provider);
  } catch (error) {
    throw new Error(`approval failed after ${requests.length} provider calls: ${error instanceof Error ? error.message : String(error)}`);
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].idempotencyKey, `return:${returnId}:shiprocket:create`);
  assert.equal(result.reverseLogisticsStatus, 'CREATED');
});

test('duplicate approval of an already-created reverse leg is a no-op', async () => {
  const doc = returnDoc({ reverseLogisticsStatus: 'CREATED' });
  installReturnDb(doc);
  let calls = 0;
  const result = await createApprovedReturnLogistics(returnId, { providerId: 'shiprocket', createReturn: async () => { calls++; throw new Error('unexpected'); } } as any);
  assert.equal(result, doc);
  assert.equal(calls, 0);
});

test('Quick Commerce approval never calls Shiprocket', async () => {
  const doc = returnDoc();
  installReturnDb(doc, orderItem('QUICK_COMMERCE'));
  let calls = 0;
  const result: any = await createApprovedReturnLogistics(returnId, { providerId: 'shiprocket', createReturn: async () => { calls++; throw new Error('unexpected'); } } as any);
  assert.equal(calls, 0);
  assert.equal(result.reverseLogisticsStatus, 'NOT_REQUIRED');
});

test('reverse API failure preserves request in explicit retryable state', async () => {
  const doc = returnDoc();
  installReturnDb(doc);
  await assert.rejects(
    () => createApprovedReturnLogistics(returnId, { providerId: 'shiprocket', createReturn: async () => { throw new Error('upstream private response'); } } as any),
    (error: any) => error instanceof ReturnLogisticsError && error.apiCode === 'RETURN_LOGISTICS_RETRY_PENDING'
  );
  assert.equal(doc.reverseLogisticsStatus, 'FAILED');
  assert.equal(doc.status, 'Approved');
  assert.doesNotMatch(doc.reverseLastError, /private response/);
});

test('retired or mismatched seller pickup blocks reverse creation safely', async () => {
  for (const badSeller of [
    activeSeller({ shippingConfig: { ...activeSeller().shippingConfig, shiprocketPickupStatus: 'RETIRED' } }),
    activeSeller({ shippingConfig: { ...activeSeller().shippingConfig, shiprocketPickupLocationName: 'Home' } }),
  ]) {
    const doc = returnDoc();
    installReturnDb(doc, orderItem(), badSeller);
    let calls = 0;
    await assert.rejects(() => createApprovedReturnLogistics(returnId, { providerId: 'shiprocket', createReturn: async () => { calls++; return {}; } } as any));
    assert.equal(calls, 0);
  }
});

test('exchange validates exact variation and available stock', async () => {
  (Product.findById as any) = async () => ({
    _id: oid(productId), seller: oid(sellerId), productName: 'Variant Product', productType: 'ECOMMERCE',
    variations: [{ _id: oid('variant-1'), title: 'Blue', sku: 'BLUE', discPrice: 100, stock: 2 }],
  });
  const replacement: any = await buildExchangeReplacement(orderItem(), 1, productId, 'variant-1');
  assert.equal(replacement.variationId.toString(), 'variant-1');
  await assert.rejects(() => buildExchangeReplacement(orderItem(), 1, productId, 'wrong'), (error: any) => error.apiCode === 'EXCHANGE_VARIATION_INVALID');
  await assert.rejects(() => buildExchangeReplacement(orderItem(), 3, productId, 'variant-1'), (error: any) => error.apiCode === 'EXCHANGE_STOCK_UNAVAILABLE');
});

test('higher and lower price exchanges are blocked until financial rules exist', async () => {
  for (const price of [120, 80]) {
    (Product.findById as any) = async () => ({ _id: oid(productId), seller: oid(sellerId), productName: 'Different Price', productType: 'ECOMMERCE', price, stock: 2 });
    await assert.rejects(() => buildExchangeReplacement(orderItem(), 1, productId), (error: any) => error.apiCode === 'EXCHANGE_PRICE_DIFFERENCE_UNSUPPORTED');
  }
});

test('replacement cannot ship before return receipt and QC', async () => {
  installReturnDb(returnDoc({ requestType: 'EXCHANGE', status: 'Reverse Shipment Created' }));
  await assert.rejects(() => processReturnQc(returnId, true, undefined, { providerId: 'shiprocket' } as any), (error: any) => error.apiCode === 'RETURN_QC_NOT_READY');
});

test('QC rejection never mutates inventory or creates replacement shipment', async () => {
  const doc = returnDoc({ requestType: 'EXCHANGE', status: 'Handed To Seller', replacement: { status: 'PENDING_QC' } });
  installReturnDb(doc);
  let inventoryCalls = 0;
  inventoryService.recordReturn = async () => { inventoryCalls++; };
  const result: any = await processReturnQc(returnId, false, undefined, { providerId: 'shiprocket', createShipment: async () => { throw new Error('unexpected'); } } as any);
  assert.equal(inventoryCalls, 0);
  assert.equal(result.status, 'QC Rejected');
});

test('QC approval restores original stock, reserves exact replacement and creates forward leg', async () => {
  const doc: any = returnDoc({
    requestType: 'EXCHANGE', status: 'Handed To Seller',
    replacement: { product: oid(productId), seller: oid(sellerId), variationId: oid('variant-1'), productName: 'Replacement', sku: 'REP-1', unitPrice: 100, status: 'PENDING_QC' },
  });
  installReturnDb(doc);
  let returns = 0;
  const mutations: any[] = [];
  const shipments: any[] = [];
  inventoryService.recordReturn = async () => { returns++; };
  inventoryService.mutateStock = async (input: any) => { mutations.push(input); return {}; };
  const result: any = await processReturnQc(returnId, true, undefined, {
    providerId: 'shiprocket', createShipment: async (request: any) => {
      shipments.push(request); return { externalOrderId: 'FWD-1', shipmentId: 'FS-1', awbNumber: 'FWD-AWB', carrier: 'Mock' };
    },
  } as any);
  assert.equal(returns, 1);
  assert.equal(mutations[0].variationId, 'variant-1');
  assert.equal(mutations[0].idempotencyKey, `exchange:${returnId}:replacement:inventory`);
  assert.equal(shipments[0].idempotencyKey, `exchange:${returnId}:replacement:create`);
  assert.equal(shipments[0].source, 'EXCHANGE_REPLACEMENT');
  assert.equal(shipments[0].pickupDetails.pickupLocationId, '101');
  assert.equal(shipments[0].pickupDetails.pickupLocationName, `OLOVELY-${sellerId.toUpperCase()}`);
  assert.equal(shipments[0].items[0].variationId, 'variant-1');
  assert.equal(result.replacement.status, 'CREATED');
});

test('already-created replacement is idempotent and creates no duplicate shipment or inventory mutation', async () => {
  const doc = returnDoc({
    requestType: 'EXCHANGE', status: 'Forward Shipment Created',
    replacement: { product: oid(productId), seller: oid(sellerId), status: 'CREATED' },
  });
  installReturnDb(doc);
  let shipmentCalls = 0;
  let mutations = 0;
  inventoryService.recordReturn = async () => undefined;
  inventoryService.mutateStock = async () => { mutations++; };
  await processReturnQc(returnId, true, undefined, { providerId: 'shiprocket', createShipment: async () => { shipmentCalls++; return {}; } } as any);
  assert.equal(shipmentCalls, 0);
  assert.equal(mutations, 0);
});

test('retired/deleted seller blocks replacement with no admin or other-vendor fallback', async () => {
  const doc = returnDoc({
    requestType: 'EXCHANGE', status: 'Handed To Seller',
    replacement: { product: oid(productId), seller: oid(sellerId), productName: 'Replacement', sku: 'REP', unitPrice: 100, status: 'PENDING_QC' },
  });
  installReturnDb(doc, orderItem(), activeSeller({ shippingConfig: { ...activeSeller().shippingConfig, shiprocketPickupStatus: 'RETIRED', shiprocketPickupLocationName: 'Home' } }));
  inventoryService.recordReturn = async () => undefined;
  inventoryService.mutateStock = async () => undefined;
  let shipments = 0;
  await assert.rejects(() => processReturnQc(returnId, true, undefined, { providerId: 'shiprocket', createShipment: async () => { shipments++; return {}; } } as any));
  assert.equal(shipments, 0);
  assert.equal(doc.replacement.status, 'FAILED');
});

test('Quick Commerce exchange remains local and never calls Shiprocket', async () => {
  const doc = returnDoc({
    requestType: 'EXCHANGE', status: 'Handed To Seller',
    replacement: { product: oid(productId), seller: oid(sellerId), productName: 'Replacement', sku: 'REP', unitPrice: 100, status: 'PENDING_QC' },
  });
  installReturnDb(doc, orderItem('QUICK_COMMERCE'));
  inventoryService.recordReturn = async () => undefined;
  inventoryService.mutateStock = async () => undefined;
  let shipments = 0;
  const result: any = await processReturnQc(returnId, true, undefined, { providerId: 'shiprocket', createShipment: async () => { shipments++; return {}; } } as any);
  assert.equal(shipments, 0);
  assert.equal(result.replacement.status, 'MANUAL_INTERVENTION');
});

test('Hybrid seller Ecommerce replacement uses that seller active Shiprocket pickup', async () => {
  const hybrid = activeSeller({ vendorType: 'HYBRID' });
  const doc = returnDoc({
    requestType: 'EXCHANGE', status: 'Handed To Seller',
    replacement: { product: oid(productId), seller: oid(sellerId), productName: 'Replacement', sku: 'REP', unitPrice: 100, status: 'PENDING_QC' },
  });
  installReturnDb(doc, orderItem('ECOMMERCE'), hybrid);
  inventoryService.recordReturn = async () => undefined;
  inventoryService.mutateStock = async () => undefined;
  let pickup: string | undefined;
  await processReturnQc(returnId, true, undefined, { providerId: 'shiprocket', createShipment: async (request: any) => {
    pickup = request.pickupDetails.pickupLocationName;
    return { externalOrderId: 'F', shipmentId: 'S', awbNumber: 'A', carrier: 'Mock' };
  } } as any);
  assert.equal(pickup, `OLOVELY-${sellerId.toUpperCase()}`);
});

function installWebhookDb(returnRequest: any) {
  let orderLookups = 0;
  (ProcessedWebhookEvent.findOne as any) = () => ({ lean: async () => null });
  (ProcessedWebhookEvent.create as any) = async (data: any) => data;
  (ProcessedWebhookEvent.updateOne as any) = async () => ({ modifiedCount: 1 });
  (ProcessedWebhookEvent.deleteOne as any) = async () => ({ deletedCount: 1 });
  (Return.findOne as any) = async () => returnRequest;
  (Order.findOne as any) = async () => { orderLookups++; return null; };
  return () => orderLookups;
}

test('reverse webhook updates only the reverse leg and never the original forward order', async () => {
  const request: any = { returnAwbNumber: 'RET-AWB', status: 'Reverse Shipment Created', reverseLogisticsStatus: 'CREATED', save: async () => undefined };
  const orderLookups = installWebhookDb(request);
  await handleShippingWebhook({ awb: 'RET-AWB', current_status: 'DELIVERED', eventId: 'reverse-1' }, undefined, 'shiprocket');
  assert.equal(request.reverseLogisticsStatus, 'RECEIVED');
  assert.equal(request.status, 'Handed To Seller');
  assert.equal(orderLookups(), 0);
});

test('replacement webhook updates only replacement tracking and completes exchange on delivery', async () => {
  const request: any = { returnAwbNumber: 'RET-AWB', status: 'Forward Shipment Created', replacement: { awbNumber: 'FWD-AWB', status: 'CREATED' }, save: async () => undefined };
  const orderLookups = installWebhookDb(request);
  await handleShippingWebhook({ awb: 'FWD-AWB', current_status: 'DELIVERED', eventId: 'replacement-1' }, undefined, 'shiprocket');
  assert.equal(request.replacement.status, 'DELIVERED');
  assert.equal(request.status, 'Completed');
  assert.equal(request.reverseLogisticsStatus, undefined);
  assert.equal(orderLookups(), 0);
});

async function run() {
  let passed = 0;
  try {
    for (const current of tests) {
      restore();
      try {
        await current.run();
        passed += 1;
        console.log(`PASS ${current.name}`);
      } catch (error) {
        console.error(`FAIL ${current.name}`);
        throw error;
      }
    }
    console.log(`\n${passed}/${tests.length} isolated Shiprocket return/exchange tests passed.`);
  } finally {
    restore();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
