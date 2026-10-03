import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Product from '../models/Product';
import Seller from '../models/Seller';
import Order from '../models/Order';
import InventoryTransaction from '../models/InventoryTransaction';
import {
  generateUniqueBarcode,
  lookupByBarcode,
  validateBarcodeFormat,
  validateBarcodeUniqueness,
} from '../utils/barcodeHelper';
import {
  generateProductBarcode,
} from '../modules/admin/controllers/adminProductController';
import {
  lookupProductByBarcode,
  searchPosProducts,
} from '../modules/admin/controllers/adminInventoryController';

let passed = 0;
const test = async (name: string, callback: () => Promise<void> | void) => {
  await callback();
  passed += 1;
  console.log(`PASS ${name}`);
};

function invoke(handler: any, request: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    let status = 200;
    const response = {
      status(code: number) { status = code; return this; },
      json(body: any) { resolve({ status, body }); return this; },
    };
    handler(request, response, (error: unknown) => error ? reject(error) : undefined);
  });
}

async function main() {
  if (process.env.MONGODB_URI || process.env.MONGO_URI) {
    console.log('Ignoring configured MongoDB URIs; this test only uses an ephemeral in-memory replica set.');
  }
  const memoryServer = await MongoMemoryServer.create();
  try {
    await mongoose.connect(memoryServer.getUri('pos_barcode_isolated'));
    await Promise.all([Product.syncIndexes(), Seller.syncIndexes()]);

    const platform = await Seller.create({
      sellerName: 'Olovely Admin', storeName: 'Olovely Admin Store', email: 'barcode-platform@example.test',
      mobile: '9000000001', category: 'Admin', commission: 0, isPlatform: true, status: 'Approved',
    });
    const vendor = await Seller.create({
      sellerName: 'Barcode Vendor', storeName: 'Vendor Store', email: 'barcode-vendor@example.test',
      mobile: '9000000002', category: 'Grocery', commission: 10, isPlatform: false, status: 'Approved',
    });
    const base = { price: 30, stock: 42, publish: true, status: 'Active', isShopByStoreOnly: true };
    const simple = await Product.create({ ...base, productName: 'Tata Salt', seller: platform._id, ownerType: 'PLATFORM', sku: 'SALT-001', barcode: '8901234567890' });
    const generatedTarget = await Product.create({ ...base, productName: 'Generated Barcode Product', seller: platform._id, ownerType: 'PLATFORM', sku: 'GENERATED-001' });
    const variants = await Product.create({
      ...base, productName: 'Tata Salt Packs', seller: platform._id, ownerType: 'PLATFORM',
      variations: [
        { title: '500g', name: 'Weight', value: '500g', price: 18, stock: 25, sku: 'TATA-SALT-500G', barcode: '8901234567883' },
        { title: '1kg', name: 'Weight', value: '1kg', price: 30, stock: 42, sku: 'TATA-SALT-1KG', barcode: '8901234567876' },
      ],
    });
    const vendorProduct = await Product.create({ ...base, productName: 'Vendor Salt', seller: vendor._id, ownerType: 'VENDOR', sku: 'VENDOR-SALT', barcode: '8901234500001' });

    await test('manual simple-product barcode persists and exact lookup returns it', async () => {
      const reloaded = await Product.findById(simple._id).lean();
      assert.equal(reloaded?.barcode, '8901234567890');
      const result = await lookupByBarcode('8901234567890');
      assert.equal(result.product?._id, simple._id.toString());
      assert.equal(result.selectedVariation, null);
    });

    await test('server-generated barcode is valid, saved immediately, and lookupable', async () => {
      const response = await invoke(generateProductBarcode, { params: { id: generatedTarget._id.toString() }, body: {} });
      assert.equal(response.status, 200);
      assert.match(response.body.data.barcode, /^29\d{11}$/);
      assert.equal((await Product.findById(generatedTarget._id).lean())?.barcode, response.body.data.barcode);
      assert.equal((await lookupByBarcode(response.body.data.barcode)).found, true);
    });

    await test('duplicate and invalid barcodes are rejected by server validation', async () => {
      assert.equal(validateBarcodeFormat('bad value with spaces').valid, false);
      assert.equal((await validateBarcodeUniqueness({ barcode: '8901234567883' })).valid, false);
      await assert.rejects(
        Product.create({ ...base, productName: 'Duplicate', seller: platform._id, ownerType: 'PLATFORM', barcode: simple.barcode }),
        (error: any) => error?.code === 11000,
      );
    });

    await test('each variant barcode resolves the correct explicit sellable variant', async () => {
      const first = await lookupByBarcode('8901234567883');
      const second = await lookupByBarcode('8901234567876');
      assert.equal(first.selectedVariation?.value, '500g');
      assert.equal(second.selectedVariation?.value, '1kg');
      assert.notEqual(first.selectedVariation?._id, second.selectedVariation?._id);
    });

    for (const [label, query] of [
      ['product name', 'tata salt'], ['product SKU', 'SALT-001'], ['product barcode', '8901234567890'],
      ['variant title', '1kg'], ['variant SKU', 'TATA-SALT-500G'], ['variant barcode', '8901234567876'],
    ]) {
      await test(`manual POS search supports ${label}`, async () => {
        const response = await invoke(searchPosProducts, { query: { q: query, limit: '12' } });
        assert.equal(response.status, 200);
        assert.ok(response.body.data.length > 0);
        assert.ok(response.body.data.every((item: any) => item.ownerType === 'PLATFORM'));
      });
    }

    await test('generated variant barcode persists on the selected variant and resolves it', async () => {
      const variationId = variants.variations?.[0]._id?.toString();
      const response = await invoke(generateProductBarcode, {
        params: { id: variants._id.toString() }, body: { variationId },
      });
      assert.equal(response.status, 200);
      const saved = await Product.findById(variants._id).lean();
      assert.equal(saved?.variations?.[0].barcode, response.body.data.barcode);
      assert.equal((await lookupByBarcode(response.body.data.barcode)).selectedVariation?._id, variationId);
    });

    await test('vendor barcode is rejected by the POS lookup endpoint', async () => {
      const response = await invoke(lookupProductByBarcode, { params: { barcode: vendorProduct.barcode } });
      assert.equal(response.status, 403);
      assert.match(response.body.message, /not available for POS billing/i);
    });

    await test('lookup and search are read-only', async () => {
      const before = {
        stock: (await Product.findById(variants._id).lean())?.variations?.map((item) => item.stock),
        orders: await Order.countDocuments(),
        ledger: await InventoryTransaction.countDocuments(),
      };
      await lookupByBarcode('8901234567876');
      await invoke(searchPosProducts, { query: { q: 'salt', limit: '12' } });
      const after = {
        stock: (await Product.findById(variants._id).lean())?.variations?.map((item) => item.stock),
        orders: await Order.countDocuments(),
        ledger: await InventoryTransaction.countDocuments(),
      };
      assert.deepEqual(after, before);
    });

    await test('empty search returns no catalogue dump', async () => {
      const response = await invoke(searchPosProducts, { query: { q: '', limit: '12' } });
      assert.deepEqual(response.body.data, []);
    });

    await test('unique generator produces a valid unassigned EAN-13 candidate', async () => {
      const generated = await generateUniqueBarcode();
      assert.match(generated, /^29\d{11}$/);
      assert.equal((await validateBarcodeUniqueness({ barcode: generated })).valid, true);
    });

    console.log(`\n${passed} barcode lifecycle tests passed.`);
  } finally {
    await mongoose.disconnect();
    await memoryServer.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
