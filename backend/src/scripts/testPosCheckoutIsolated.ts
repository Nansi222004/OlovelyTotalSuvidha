/**
 * POS integration tests against an ephemeral in-memory MongoDB replica set.
 * This script never reads MONGODB_URI/MONGO_URI and cannot connect to an external database.
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { posCheckout, searchPosProducts } from '../modules/admin/controllers/adminInventoryController';
import { lookupByBarcode } from '../utils/barcodeHelper';
import AppSettings from '../models/AppSettings';
import Product from '../models/Product';
import Order from '../models/Order';
import InventoryTransaction from '../models/InventoryTransaction';
import PosCheckoutAttempt from '../models/PosCheckoutAttempt';
import Seller from '../models/Seller';
import { getCanonicalAdminSeller } from '../utils/inventoryHelper';

type CheckoutResult = { status: number; body: any; headers: Record<string, string> };

function callSearchPosProducts(query: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const response: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { resolve(body.data); return this; },
    };
    const request: any = { query: { q: query, limit: '10' } };
    (searchPosProducts as any)(request, response, (err: any) => err ? reject(err) : undefined);
  });
}

function callCheckout(payload: any): Promise<CheckoutResult> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    const response: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      setHeader(name: string, value: string) { headers[name] = value; },
      json(body: any) { resolve({ status: this.statusCode, body, headers }); return this; },
    };
    const request: any = { body: payload, user: { userId: new mongoose.Types.ObjectId().toString() } };
    const timeout = setTimeout(() => reject(new Error('POS checkout test timed out')), 45_000);
    const finish = (result: CheckoutResult) => { clearTimeout(timeout); resolve(result); };
    response.json = function json(body: any) {
      finish({ status: this.statusCode, body, headers });
      return this;
    };
    (posCheckout as any)(request, response, (error: any) => {
      clearTimeout(timeout);
      if (error) reject(error);
    });
  });
}

async function createPlatformProduct(name: string, sellerId: mongoose.Types.ObjectId) {
  return Product.create({
    productName: name,
    seller: sellerId,
    ownerType: 'PLATFORM',
    isShopByStoreOnly: true,
    galleryImages: [],
    price: 175,
    stock: 10,
    tax: '18%',
    hsnCode: '1806',
    publish: true,
    status: 'Active',
    productType: 'QUICK_COMMERCE',
    productSource: 'LOCAL_VENDOR',
  });
}

async function run() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  try {
    await mongoose.connect(replSet.getUri('olovely_pos_isolated_test'));
    await PosCheckoutAttempt.syncIndexes();

    await AppSettings.create({
      appName: 'Olovely Total Suvidha',
      businessName: 'Olovely Total Suvidha',
      companyAddress: 'Isolated Test Address',
      companyCity: 'Indore',
      companyState: 'Madhya Pradesh',
      companyPincode: '452001',
      stateCode: '23',
      gstEnabled: true,
      gstRate: 18,
      gstin: '23AAAAA0000A1Z5',
      contactEmail: 'isolated@example.test',
      contactPhone: '9999999999',
    });

    const platformSeller = await getCanonicalAdminSeller();
    const product = await createPlatformProduct('Cadbury Milk', platformSeller._id as mongoose.Types.ObjectId);
    const basePayload = {
      items: [{ productId: product._id.toString(), quantity: 2 }],
      customer: {
        name: 'Same State Customer', phone: '9000000001', state: 'Madhya Pradesh', stateCode: '23', isWalkIn: false,
      },
      payment: { method: 'Cash', amountPaid: 350, changeReturned: 0 },
      idempotencyKey: 'isolated-sequential-key',
    };

    const first = await callCheckout(basePayload);
    const replay = await callCheckout(basePayload);
    assert.equal(first.status, 201);
    assert.equal(replay.status, 200);
    assert.equal(replay.headers['X-Idempotent-Replay'], 'true');
    assert.equal(first.body.data.order._id.toString(), replay.body.data.order._id.toString());
    assert.equal(first.body.data.taxSummary.taxModel, 'INTRA_STATE');
    assert.equal(first.body.data.taxSummary.igst, 0);
    assert.equal(first.body.data.items[0].productName, 'Cadbury Milk');
    assert.equal(first.body.data.items[0].unitPrice, 175);
    assert.equal(first.body.data.items[0].total, 350);
    assert.equal(first.body.data.items[0].hsnCode, '1806');
    const storedFirstOrder: any = await Order.findById(first.body.data.order._id).lean();
    assert.equal(storedFirstOrder.posTaxSummary.taxModel, 'INTRA_STATE');
    assert.equal(storedFirstOrder.posTaxSummary.customerStateCode, '23');
    assert.equal(storedFirstOrder.posBusinessSnapshot.gstin, '23AAAAA0000A1Z5');
    assert.equal((await Product.findById(product._id))?.stock, 8);
    assert.equal(await Order.countDocuments({ isPosOrder: true }), 1);
    assert.equal(await InventoryTransaction.countDocuments({ type: 'SALE', product: product._id }), 1);

    const concurrentProduct = await createPlatformProduct('Concurrent Product', platformSeller._id as mongoose.Types.ObjectId);
    const concurrentPayload = {
      ...basePayload,
      items: [{ productId: concurrentProduct._id.toString(), quantity: 2 }],
      customer: { name: 'Concurrent Customer', phone: '9000000002', state: 'Maharashtra', stateCode: '27', isWalkIn: false },
      idempotencyKey: 'isolated-concurrent-key',
    };
    const [concurrentA, concurrentB] = await Promise.all([
      callCheckout(concurrentPayload),
      callCheckout(concurrentPayload),
    ]);
    assert.equal(concurrentA.body.success, true);
    assert.equal(concurrentB.body.success, true);
    assert.equal(concurrentA.body.data.order._id.toString(), concurrentB.body.data.order._id.toString());
    assert.equal(concurrentA.body.data.taxSummary.taxModel, 'INTER_STATE');
    assert.equal(concurrentA.body.data.taxSummary.cgst, 0);
    assert.equal(concurrentA.body.data.taxSummary.sgst, 0);
    assert.ok(concurrentA.body.data.taxSummary.igst > 0);
    assert.equal((await Product.findById(concurrentProduct._id))?.stock, 8);
    assert.equal(await InventoryTransaction.countDocuments({ type: 'SALE', product: concurrentProduct._id }), 1);
    assert.equal(await Order.countDocuments({ isPosOrder: true }), 2);

    const walkInProduct = await createPlatformProduct('Walk-in Product', platformSeller._id as mongoose.Types.ObjectId);
    const walkIn = await callCheckout({
      items: [{ productId: walkInProduct._id.toString(), quantity: 1 }],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 175 },
      idempotencyKey: 'isolated-walkin-key',
    });
    assert.equal(walkIn.body.data.customer.state, 'Madhya Pradesh');
    assert.equal(walkIn.body.data.taxSummary.taxModel, 'INTRA_STATE');

    const vendor = await Seller.create({
      sellerName: 'Isolated Vendor', storeName: 'Isolated Vendor Store',
      email: 'vendor@example.test', mobile: '9000000099', category: 'Grocery',
      status: 'Approved', isPlatform: false,
    });
    const vendorProduct = await Product.create({
      productName: 'Vendor Product', seller: vendor._id, ownerType: 'VENDOR',
      isShopByStoreOnly: true, galleryImages: [], price: 100, stock: 10,
      tax: '18%', publish: true, status: 'Active', productType: 'QUICK_COMMERCE', productSource: 'LOCAL_VENDOR',
    });
    const vendorResult = await callCheckout({
      items: [{ productId: vendorProduct._id.toString(), quantity: 1 }],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 100 },
      idempotencyKey: 'isolated-vendor-key',
    });
    assert.equal(vendorResult.status, 400);
    assert.match(vendorResult.body.message, /vendor-owned/i);
    assert.equal((await Product.findById(vendorProduct._id))?.stock, 10);
    assert.equal(await InventoryTransaction.countDocuments({ type: 'SALE', product: vendorProduct._id }), 0);

    // =========================================================================
    // POS VARIATION AUDIT & REGRESSION TEST SCENARIOS (1 to 7)
    // =========================================================================

    // 1. Simple product: search -> add -> checkout
    const simpleProduct = await Product.create({
      productName: 'Bisleri Mineral Water 1L',
      seller: platformSeller._id,
      ownerType: 'PLATFORM',
      isShopByStoreOnly: true,
      galleryImages: [],
      price: 20,
      stock: 20,
      sku: 'BIS-1L-001',
      barcode: '8901234999991',
      tax: '18%',
      hsnCode: '2201',
      publish: true,
      status: 'Active',
      productType: 'QUICK_COMMERCE',
      productSource: 'LOCAL_VENDOR',
    });

    const simpleSearchResults = await callSearchPosProducts('Bisleri');
    assert.ok(simpleSearchResults.length > 0);
    const matchedSimple = simpleSearchResults.find(item => item.productId === simpleProduct._id.toString());
    assert.ok(matchedSimple);
    assert.equal(matchedSimple.hasVariations, false);
    assert.equal(matchedSimple.variationId, undefined);

    const simpleCheckout = await callCheckout({
      items: [{ productId: simpleProduct._id.toString(), quantity: 1 }],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 20 },
      idempotencyKey: 'isolated-simple-checkout-key',
    });
    assert.equal(simpleCheckout.status, 201);
    assert.equal((await Product.findById(simpleProduct._id))?.stock, 19);
    const simpleSaleLedger = await InventoryTransaction.findOne({
      product: simpleProduct._id,
      type: 'SALE',
      referenceId: simpleCheckout.body.data.order._id,
    });
    assert.ok(simpleSaleLedger);
    assert.equal(simpleSaleLedger.variationId, undefined);

    // 2. Variation product: manual search -> select exact variation -> add -> checkout
    const variationProduct = await Product.create({
      productName: 'Tata Salt Iodised Packs',
      seller: platformSeller._id,
      ownerType: 'PLATFORM',
      isShopByStoreOnly: true,
      galleryImages: [],
      price: 30,
      stock: 67,
      sku: 'POS-SALT-ROOT',
      barcode: '8904043900000',
      tax: '18%',
      hsnCode: '2501',
      publish: true,
      status: 'Active',
      productType: 'QUICK_COMMERCE',
      productSource: 'LOCAL_VENDOR',
      variationType: 'Weight',
      variations: [
        {
          title: '500 g',
          name: 'Weight',
          value: '500 g',
          price: 18,
          discPrice: 0,
          stock: 25,
          sku: 'POS-SALT-500G',
          barcode: '8904043900500',
          status: 'Available',
        },
        {
          title: '1 kg',
          name: 'Weight',
          value: '1 kg',
          price: 30,
          discPrice: 0,
          stock: 42,
          sku: 'POS-SALT-1KG',
          barcode: '8904043901000',
          status: 'Available',
        },
      ],
    });

    const variation500gId = (variationProduct.variations as any)[0]._id.toString();
    const variation1kgId = (variationProduct.variations as any)[1]._id.toString();

    // Manual search for "500 g"
    const searchVar500 = await callSearchPosProducts('500 g');
    assert.ok(searchVar500.length > 0);
    const match500 = searchVar500.find(i => i.variationId === variation500gId);
    assert.ok(match500, 'Manual search must return the exact 500g variation item');
    assert.equal(match500.productId, variationProduct._id.toString());
    assert.equal(match500.variationTitle, '500 g');
    assert.equal(match500.hasVariations, true);
    assert.equal(match500.sku, 'POS-SALT-500G');
    assert.equal(match500.barcode, '8904043900500');

    const checkoutVar500 = await callCheckout({
      items: [{ productId: variationProduct._id.toString(), variationId: match500.variationId, quantity: 1 }],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 18 },
      idempotencyKey: 'isolated-var-500g-checkout',
    });
    assert.equal(checkoutVar500.status, 201);
    const updatedAfter500: any = await Product.findById(variationProduct._id).lean();
    assert.equal(updatedAfter500.variations[0].stock, 24); // 25 -> 24
    assert.equal(updatedAfter500.variations[1].stock, 42); // unchanged
    assert.equal(updatedAfter500.stock, 66); // root synchronized in lockstep
    const ledger500 = await InventoryTransaction.findOne({
      product: variationProduct._id,
      variationId: new mongoose.Types.ObjectId(variation500gId),
      type: 'SALE',
      referenceId: checkoutVar500.body.data.order._id,
    });
    assert.ok(ledger500, 'SALE ledger must target the exact 500g variation');
    assert.equal(ledger500.previousStock, 25);
    assert.equal(ledger500.newStock, 24);

    // 3. Variation barcode: scan barcode -> exact variation selected -> add -> checkout
    const scan1kg = await lookupByBarcode('8904043901000');
    assert.equal(scan1kg.found, true);
    assert.ok(scan1kg.selectedVariation);
    assert.equal(scan1kg.selectedVariation.variationId, variation1kgId);
    assert.equal(scan1kg.selectedVariation.value, '1 kg');
    assert.equal(scan1kg.selectedVariation.barcode, '8904043901000');

    const checkoutScan1kg = await callCheckout({
      items: [{ productId: scan1kg.product!._id, variationId: scan1kg.selectedVariation.variationId, quantity: 1 }],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 30 },
      idempotencyKey: 'isolated-var-1kg-barcode-checkout',
    });
    assert.equal(checkoutScan1kg.status, 201);
    const updatedAfterScan1kg: any = await Product.findById(variationProduct._id).lean();
    assert.equal(updatedAfterScan1kg.variations[0].stock, 24); // 500g unchanged
    assert.equal(updatedAfterScan1kg.variations[1].stock, 41); // 42 -> 41
    assert.equal(updatedAfterScan1kg.stock, 65);
    const ledger1kg = await InventoryTransaction.findOne({
      product: variationProduct._id,
      variationId: new mongoose.Types.ObjectId(variation1kgId),
      type: 'SALE',
      referenceId: checkoutScan1kg.body.data.order._id,
    });
    assert.ok(ledger1kg, 'SALE ledger must target the exact 1kg variation');

    // 4. Multiple variations: variation A barcode -> A, variation B barcode -> B; verify they never cross-select
    const scanA = await lookupByBarcode('8904043900500');
    const scanB = await lookupByBarcode('8904043901000');
    assert.equal(scanA.selectedVariation?.variationId, variation500gId);
    assert.equal(scanB.selectedVariation?.variationId, variation1kgId);
    assert.notEqual(scanA.selectedVariation?.variationId, scanB.selectedVariation?.variationId);

    const multiVarCheckout = await callCheckout({
      items: [
        { productId: variationProduct._id.toString(), variationId: variation500gId, quantity: 1 },
        { productId: variationProduct._id.toString(), variationId: variation1kgId, quantity: 1 },
      ],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 48 },
      idempotencyKey: 'isolated-multi-var-checkout',
    });
    assert.equal(multiVarCheckout.status, 201);
    const updatedAfterMulti: any = await Product.findById(variationProduct._id).lean();
    assert.equal(updatedAfterMulti.variations[0].stock, 23); // 24 -> 23
    assert.equal(updatedAfterMulti.variations[1].stock, 40); // 41 -> 40
    assert.equal(updatedAfterMulti.stock, 63);

    // 5. Quantity 2: correct variation stock decreases by 2
    const qty2Checkout = await callCheckout({
      items: [{ productId: variationProduct._id.toString(), variationId: variation1kgId, quantity: 2 }],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 60 },
      idempotencyKey: 'isolated-qty2-checkout',
    });
    assert.equal(qty2Checkout.status, 201);
    const updatedAfterQty2: any = await Product.findById(variationProduct._id).lean();
    assert.equal(updatedAfterQty2.variations[0].stock, 23); // 500g unchanged
    assert.equal(updatedAfterQty2.variations[1].stock, 38); // 40 -> 38
    assert.equal(updatedAfterQty2.stock, 61);

    // 6. Invalid / missing variationId rejected upfront with no mutation
    const stockBeforeRejections: any = await Product.findById(variationProduct._id).lean();
    const ledgerCountBefore = await InventoryTransaction.countDocuments();
    const orderCountBefore = await Order.countDocuments();

    // 6A: Missing variationId on variation product
    const missingVarResult = await callCheckout({
      items: [{ productId: variationProduct._id.toString(), quantity: 1 }],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 30 },
      idempotencyKey: 'isolated-missing-var-rejection',
    });
    assert.equal(missingVarResult.status, 400);
    assert.match(missingVarResult.body.message, /contains variations/i);

    // 6B: Invalid variationId on variation product
    const invalidVarResult = await callCheckout({
      items: [{ productId: variationProduct._id.toString(), variationId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 30 },
      idempotencyKey: 'isolated-invalid-var-rejection',
    });
    assert.equal(invalidVarResult.status, 404);
    assert.match(invalidVarResult.body.message, /Variation not found/i);

    // 6C: Spurious variationId on simple product
    const spuriousVarResult = await callCheckout({
      items: [{ productId: simpleProduct._id.toString(), variationId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
      customer: { name: 'Walk-in Customer', phone: '0000000000', isWalkIn: true },
      payment: { method: 'Cash', amountPaid: 20 },
      idempotencyKey: 'isolated-spurious-var-rejection',
    });
    assert.equal(spuriousVarResult.status, 400);
    assert.match(spuriousVarResult.body.message, /does not have variations/i);

    // Verify: No stock mutation, no SALE ledger, no partial order
    const stockAfterRejections: any = await Product.findById(variationProduct._id).lean();
    assert.deepEqual(stockAfterRejections.variations, stockBeforeRejections.variations);
    assert.equal(stockAfterRejections.stock, stockBeforeRejections.stock);
    assert.equal(await InventoryTransaction.countDocuments(), ledgerCountBefore);
    assert.equal(await Order.countDocuments(), orderCountBefore);

    console.log('POS isolated integration tests passed: same/inter-state GST, walk-in rule, invoice mapping, HSN, replay/concurrent idempotency, stock/SALE atomicity, platform/vendor isolation, variation search/barcode/checkout/rejection lifecycle.');
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
    try {
      await replSet.stop({ doCleanup: true, force: true });
    } catch {}
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
