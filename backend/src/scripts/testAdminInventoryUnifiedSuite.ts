/**
 * testAdminInventoryUnifiedSuite.ts
 *
 * Comprehensive test suite verifying:
 * 1. Live Read-Only verification of Neelam Tiwari's Premium Red Chilli Powder (1Kg) (stock 6 <= threshold 10)
 * 2. Low-stock simple product detection
 * 3. Low-stock variation detection while root product stock is above threshold
 * 4. Out-of-stock variation detection (stock = 0)
 * 5. Platform-owned product ownership labeling ("Admin / Platform Inventory")
 * 6. Vendor-owned product ownership labeling and owner filters (All vs Platform vs Vendor)
 * 7. Vendor isolation (vendor cannot view or mutate platform or another vendor's stock)
 * 8. Inventory transaction ledger ownership and variation identity
 * 9. Configured dynamic threshold changes (respects AppSettings)
 * 10. Legacy products and transactions without explicit ownerType (safe fallback)
 *
 * SAFETY:
 * - Isolated test fixtures using unique prefix TEST_FIXTURE_INVENTORY_
 * - Guaranteed cleanup in finally block
 * - Read-only inspection of live database records without any mutations
 */

import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Seller from '../models/Seller';
import InventoryTransaction from '../models/InventoryTransaction';
import AppSettings from '../models/AppSettings';
import Category from '../models/Category';
import { getCanonicalAdminSeller } from '../utils/inventoryHelper';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const FIXTURE_PREFIX = 'TEST_FIXTURE_INV_' + Date.now();

let adminToken: string;
let vendorAToken: string;
let vendorBToken: string;

let adminSellerId: string;
let vendorAId: string;
let vendorBId: string;
let testCategoryId: string;

const createdProductIds: mongoose.Types.ObjectId[] = [];
const createdSellerIds: mongoose.Types.ObjectId[] = [];
let originalLowStockThreshold = 10;

function apiCall(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  token?: string,
  body?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1' + path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode || 0, data: { raw: data } });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function setup() {
  console.log('--- Setting up test environment and isolated fixtures ---');
  await mongoose.connect(process.env.MONGODB_URI || '');

  // Record initial threshold
  const settings = await AppSettings.getSettings();
  originalLowStockThreshold = settings.inventorySettings?.lowStockThreshold ?? 10;

  // 1. Ensure canonical admin seller
  const adminSeller = await getCanonicalAdminSeller();
  adminSellerId = adminSeller._id.toString();

  // 2. Create isolated test vendors
  const vendorA = await Seller.create({
    sellerName: 'Vendor Alpha ' + FIXTURE_PREFIX,
    storeName: 'Store Alpha ' + FIXTURE_PREFIX,
    email: `vendor_a_${FIXTURE_PREFIX.toLowerCase()}@test.com`,
    mobile: '98' + Math.floor(10000000 + Math.random() * 90000000),
    password: 'Password@123',
    category: 'Grocery',
    status: 'Approved',
    vendorType: 'HYBRID',
    requireProductApproval: false,
    isPlatform: false,
    isShopOpen: true,
  });
  vendorAId = vendorA._id.toString();
  createdSellerIds.push(vendorA._id);

  const vendorB = await Seller.create({
    sellerName: 'Vendor Beta ' + FIXTURE_PREFIX,
    storeName: 'Store Beta ' + FIXTURE_PREFIX,
    email: `vendor_b_${FIXTURE_PREFIX.toLowerCase()}@test.com`,
    mobile: '97' + Math.floor(10000000 + Math.random() * 90000000),
    password: 'Password@123',
    category: 'Grocery',
    status: 'Approved',
    vendorType: 'HYBRID',
    requireProductApproval: false,
    isPlatform: false,
    isShopOpen: true,
  });
  vendorBId = vendorB._id.toString();
  createdSellerIds.push(vendorB._id);

  // 3. Find or create a test category with commerceChannels
  let category = await Category.findOne({ commerceChannels: 'ECOMMERCE' });
  if (!category) {
    category = await Category.create({
      name: 'Test Category ' + FIXTURE_PREFIX,
      order: 1,
      commerceChannels: ['ECOMMERCE', 'QUICK_COMMERCE'],
    });
  }
  testCategoryId = category._id.toString();

  // 4. Generate tokens
  adminToken = jwt.sign(
    { userId: '6a7d5b02259ec525f6753dda', userType: 'Admin', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  vendorAToken = jwt.sign(
    { userId: vendorAId, userType: 'Seller', role: 'seller' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  vendorBToken = jwt.sign(
    { userId: vendorBId, userType: 'Seller', role: 'seller' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  console.log('Environment ready. Initial threshold:', originalLowStockThreshold);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('RUNNING ADMIN & VENDOR INVENTORY UNIFICATION SUITE');
  console.log('======================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Live Read-Only Verification of Neelam Tiwari's Chilli Powder
  // -------------------------------------------------------------------------
  console.log('TEST 1: Live Read-Only Check of Premium Red Chilli Powder (1Kg)...');
  const liveRes = await apiCall('GET', '/admin/inventory/low-stock?search=Red%20Chilli%20Powder', adminToken);
  assert(liveRes.status === 200, 'GET /admin/inventory/low-stock responds with 200');
  assert(Array.isArray(liveRes.data?.data), 'Response contains data array');
  const chilliAlert = liveRes.data.data.find((item: any) =>
    /Red Chilli Powder/i.test(item.productName) && /1Kg/i.test(item.displayName)
  );
  assert(!!chilliAlert, 'Premium Red Chilli Powder (1Kg) variation is present in low stock alert');
  assert(chilliAlert.stock === 6, `Chilli stock is accurately reported as 6 (got ${chilliAlert.stock})`);
  assert(chilliAlert.threshold === 10, `Active threshold is reported as 10 (got ${chilliAlert.threshold})`);
  assert(chilliAlert.ownerType === 'VENDOR', `Owner type is correctly identified as VENDOR`);
  assert(
    /Neelam/i.test(chilliAlert.ownerLabel) || /Neelam/i.test(chilliAlert.seller?.sellerName),
    `Owner is accurately identified as Neelam store / Neelam Tiwari`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Low-Stock Simple Product (Platform-Owned)
  // -------------------------------------------------------------------------
  console.log('\nTEST 2: Low-Stock Simple Product (Platform-Owned)...');
  const platformSimple = await Product.create({
    productName: FIXTURE_PREFIX + '_Platform_Simple',
    price: 150,
    stock: 4, // <= 10
    seller: adminSellerId,
    ownerType: 'PLATFORM',
    category: testCategoryId,
    productType: 'ECOMMERCE',
    status: 'Active',
    publish: true,
  });
  createdProductIds.push(platformSimple._id);

  const resSimple = await apiCall('GET', `/admin/inventory/low-stock?search=${FIXTURE_PREFIX}_Platform_Simple`, adminToken);
  assert(resSimple.status === 200, 'Low-stock query succeeds for platform simple product');
  const simpleItem = resSimple.data.data.find((i: any) => i.productId === platformSimple._id.toString());
  assert(!!simpleItem, 'Platform simple product appears in low stock alert');
  assert(simpleItem.stock === 4, 'Stock is 4');
  assert(simpleItem.ownerType === 'PLATFORM', 'Owner type is PLATFORM');
  assert(simpleItem.ownerLabel === 'Admin / Platform Inventory', 'Owner label is "Admin / Platform Inventory"');

  // -------------------------------------------------------------------------
  // TEST 3: Low-Stock Variation while Root Product Stock is Above Threshold
  // -------------------------------------------------------------------------
  console.log('\nTEST 3: Low-Stock Variation with High Root Stock...');
  const varProd = await Product.create({
    productName: FIXTURE_PREFIX + '_Vendor_Variant_Product',
    price: 300,
    stock: 100, // Root stock 100 > threshold 10
    seller: vendorAId,
    ownerType: 'VENDOR',
    category: testCategoryId,
    productType: 'ECOMMERCE',
    status: 'Active',
    publish: true,
    variations: [
      {
        name: 'Size',
        value: '500g',
        title: '500g',
        price: 300,
        stock: 5, // <= 10 (Low stock)
        status: 'Available',
      },
      {
        name: 'Size',
        value: '2Kg',
        title: '2Kg',
        price: 900,
        stock: 40, // > 10 (Sufficient stock)
        status: 'Available',
      },
    ],
  });
  createdProductIds.push(varProd._id);

  const resVar = await apiCall('GET', `/admin/inventory/low-stock?search=${FIXTURE_PREFIX}_Vendor_Variant_Product`, adminToken);
  assert(resVar.status === 200, 'Low-stock query succeeds for variant product');
  const matchedAlerts = resVar.data.data.filter((i: any) => i.productId === varProd._id.toString());
  assert(matchedAlerts.length === 1, `Exactly 1 variation appears in alert (got ${matchedAlerts.length})`);
  assert(matchedAlerts[0].variationTitle === '500g', 'The 500g variation triggered the alert');
  assert(matchedAlerts[0].stock === 5, 'Alert reports variation stock 5, not root stock 100');
  assert(matchedAlerts[0].ownerType === 'VENDOR', 'Owner type is VENDOR');
  assert(matchedAlerts[0].seller?._id === vendorAId, 'Seller ID matches Vendor Alpha');

  // -------------------------------------------------------------------------
  // TEST 4: Out-of-Stock Variation (Stock = 0)
  // -------------------------------------------------------------------------
  console.log('\nTEST 4: Out-of-Stock Variation (Stock = 0)...');
  const oosProd = await Product.create({
    productName: FIXTURE_PREFIX + '_Vendor_OOS_Product',
    price: 200,
    stock: 50,
    seller: vendorBId,
    ownerType: 'VENDOR',
    category: testCategoryId,
    productType: 'ECOMMERCE',
    status: 'Active',
    publish: true,
    variations: [
      {
        name: 'Color',
        value: 'Red',
        title: 'Red',
        price: 200,
        stock: 0, // Out of stock
        status: 'Sold out',
      },
    ],
  });
  createdProductIds.push(oosProd._id);

  const resOOS = await apiCall(
    'GET',
    `/admin/inventory/low-stock?search=${FIXTURE_PREFIX}_Vendor_OOS_Product&status=OUT_OF_STOCK`,
    adminToken
  );
  assert(resOOS.status === 200, 'Out-of-stock query succeeds');
  const oosItem = resOOS.data.data.find((i: any) => i.productId === oosProd._id.toString());
  assert(!!oosItem, 'OOS variation appears under status=OUT_OF_STOCK');
  assert(oosItem.stock === 0, 'Stock is 0');
  assert(oosItem.isOutOfStock === true, 'isOutOfStock is true');
  assert(oosItem.isLowStock === false, 'isLowStock is false for 0 units');

  // -------------------------------------------------------------------------
  // TEST 5: Owner Filters (Platform vs Vendor Scoping)
  // -------------------------------------------------------------------------
  console.log('\nTEST 5: Admin Owner Filters (Platform vs Vendor)...');
  const platformOnly = await apiCall('GET', `/admin/inventory/low-stock?ownerType=PLATFORM&search=${FIXTURE_PREFIX}`, adminToken);
  assert(platformOnly.status === 200, 'GET with ownerType=PLATFORM succeeds');
  const platformIds = platformOnly.data.data.map((i: any) => i.productId);
  assert(platformIds.includes(platformSimple._id.toString()), 'Platform product is included');
  assert(!platformIds.includes(varProd._id.toString()), 'Vendor A product is excluded from Platform filter');
  assert(!platformIds.includes(oosProd._id.toString()), 'Vendor B product is excluded from Platform filter');

  const vendorOnly = await apiCall('GET', `/admin/inventory/low-stock?ownerType=VENDOR&search=${FIXTURE_PREFIX}`, adminToken);
  assert(vendorOnly.status === 200, 'GET with ownerType=VENDOR succeeds');
  const vendorIds = vendorOnly.data.data.map((i: any) => i.productId);
  assert(!vendorIds.includes(platformSimple._id.toString()), 'Platform product is excluded from Vendor filter');
  assert(vendorIds.includes(varProd._id.toString()), 'Vendor A product is included in Vendor filter');
  assert(vendorIds.includes(oosProd._id.toString()), 'Vendor B product is included in Vendor filter');

  // -------------------------------------------------------------------------
  // TEST 6: Vendor Isolation (Vendor cannot see or adjust other stock)
  // -------------------------------------------------------------------------
  console.log('\nTEST 6: Vendor Isolation Enforcement...');
  // Vendor A queries products via seller API
  const sellerARes = await apiCall('GET', '/products', vendorAToken);
  assert(sellerARes.status === 200, 'Vendor A queries their products');
  const sellerAProductIds = (sellerARes.data.data || []).map((p: any) => p._id);
  assert(!sellerAProductIds.includes(platformSimple._id.toString()), 'Vendor A cannot see Platform product');
  assert(!sellerAProductIds.includes(oosProd._id.toString()), 'Vendor A cannot see Vendor B product');

  // Vendor A attempts to update Vendor B variation stock -> should be 404 / rejected
  const oosVariationId = oosProd.variations![0]._id!.toString();
  const unauthorizedUpdate = await apiCall(
    'PATCH',
    `/products/${oosProd._id}/variations/${oosVariationId}/stock`,
    vendorAToken,
    { stock: 50 }
  );
  assert(unauthorizedUpdate.status === 404, `Vendor A unauthorized stock update is rejected with 404 (got ${unauthorizedUpdate.status})`);

  // Verify Vendor B's stock in database remained 0
  const refreshedOOS = await Product.findById(oosProd._id);
  assert(refreshedOOS?.variations?.[0].stock === 0, 'Target variation stock remained protected and unmodified');

  // -------------------------------------------------------------------------
  // TEST 7: Inventory Transaction Ownership and Variation Identity
  // -------------------------------------------------------------------------
  console.log('\nTEST 7: Transaction Ledger Ownership & Variation Identity...');
  // Admin performs adjustment on platform product
  const adjPlatform = await apiCall('POST', '/admin/inventory/adjust', adminToken, {
    productId: platformSimple._id.toString(),
    delta: 5,
    note: FIXTURE_PREFIX + ' Platform adjustment',
  });
  assert(adjPlatform.status === 200, 'Admin adjusts platform product stock');

  // Admin performs adjustment on vendor variation
  const vendorVariationId = varProd.variations![0]._id!.toString();
  const adjVendor = await apiCall('POST', '/admin/inventory/adjust', adminToken, {
    productId: varProd._id.toString(),
    variationId: vendorVariationId,
    delta: 3,
    note: FIXTURE_PREFIX + ' Vendor variation adjustment',
  });
  assert(adjVendor.status === 200, 'Admin adjusts vendor variation stock');

  // Query transactions
  const txRes = await apiCall('GET', '/admin/inventory/transactions?limit=10', adminToken);
  assert(txRes.status === 200, 'Admin queries transaction ledger');
  const platformTx = txRes.data.data.find((t: any) => t.product?._id === platformSimple._id.toString());
  assert(!!platformTx, 'Platform transaction recorded in ledger');
  assert(platformTx.ownerType === 'PLATFORM', 'Platform transaction has ownerType PLATFORM');
  assert(platformTx.ownerLabel === 'Admin / Platform Inventory', 'Platform transaction labeled "Admin / Platform Inventory"');

  const vendorTx = txRes.data.data.find((t: any) => t.product?._id === varProd._id.toString());
  assert(!!vendorTx, 'Vendor variation transaction recorded in ledger');
  assert(vendorTx.variationName === 'Size: 500g', `Variation identity captured as "${vendorTx.variationName}"`);
  assert(vendorTx.ownerType === 'VENDOR', 'Vendor transaction has ownerType VENDOR');
  assert(vendorTx.ownerLabel.includes('Alpha'), 'Vendor transaction shows correct vendor store name');

  // -------------------------------------------------------------------------
  // TEST 8: Configured Dynamic Threshold Changes
  // -------------------------------------------------------------------------
  console.log('\nTEST 8: Dynamic Low-Stock Threshold Changes...');
  // Create product with stock 15 (above default threshold 10, but below new threshold 20)
  const thresholdTestProd = await Product.create({
    productName: FIXTURE_PREFIX + '_Threshold_Test',
    price: 100,
    stock: 15,
    seller: adminSellerId,
    ownerType: 'PLATFORM',
    category: testCategoryId,
    productType: 'ECOMMERCE',
    status: 'Active',
    publish: true,
  });
  createdProductIds.push(thresholdTestProd._id);

  // At threshold 10: should NOT appear
  const resBefore = await apiCall('GET', `/admin/inventory/low-stock?search=${FIXTURE_PREFIX}_Threshold_Test`, adminToken);
  const foundBefore = resBefore.data.data.some((i: any) => i.productId === thresholdTestProd._id.toString());
  assert(!foundBefore, 'Stock 15 does not trigger alert when threshold is 10');

  // Update AppSettings threshold to 20
  await AppSettings.findOneAndUpdate({}, { $set: { 'inventorySettings.lowStockThreshold': 20 } }, { new: true, upsert: true });

  // At threshold 20: should appear
  const resAfter = await apiCall('GET', `/admin/inventory/low-stock?search=${FIXTURE_PREFIX}_Threshold_Test`, adminToken);
  const foundAfter = resAfter.data.data.some((i: any) => i.productId === thresholdTestProd._id.toString());
  assert(foundAfter, 'Stock 15 dynamically triggers alert after threshold updated to 20');
  assert(resAfter.data.threshold === 20, 'Response dynamically reports active threshold as 20');

  // -------------------------------------------------------------------------
  // TEST 9: Legacy Products Without Explicit ownerType (Backward Compatibility)
  // -------------------------------------------------------------------------
  console.log('\nTEST 9: Legacy Products Without Explicit ownerType...');
  const legacyProd = await Product.create({
    productName: FIXTURE_PREFIX + '_Legacy_Vendor_Product',
    price: 120,
    stock: 2, // low stock
    seller: vendorAId,
    // ownerType omitted
    category: testCategoryId,
    productType: 'ECOMMERCE',
    status: 'Active',
    publish: true,
  });
  createdProductIds.push(legacyProd._id);

  const resLegacy = await apiCall('GET', `/admin/inventory/low-stock?search=${FIXTURE_PREFIX}_Legacy_Vendor_Product`, adminToken);
  const legacyItem = resLegacy.data.data.find((i: any) => i.productId === legacyProd._id.toString());
  assert(!!legacyItem, 'Legacy product appears in low stock alert');
  assert(legacyItem.ownerType === 'VENDOR', 'Legacy product with vendor seller falls back to VENDOR ownerType');
  assert(legacyItem.ownerLabel.includes('Alpha'), 'Legacy product correctly resolves vendor store name');

  // -------------------------------------------------------------------------
  // TEST 10: Admin-Created Products (Platform vs Assigned Vendor) via API
  // -------------------------------------------------------------------------
  console.log('\nTEST 10: Admin-Created Products (Platform vs Assigned Vendor)...');
  // 10A: Admin creates platform product (seller omitted)
  const createPlatformRes = await apiCall('POST', '/admin/products', adminToken, {
    productName: FIXTURE_PREFIX + '_Admin_Created_Platform_Prod',
    category: testCategoryId,
    price: 150,
    stock: 5,
    productType: 'ECOMMERCE',
    variations: [
      {
        name: 'Pack',
        value: '1pc',
        title: '1pc',
        price: 150,
        stock: 5,
        status: 'Available',
      },
    ],
  });
  assert(createPlatformRes.status === 201, `Admin creates platform product successfully (status ${createPlatformRes.status}: ${JSON.stringify(createPlatformRes.data)})`);
  const platformProdData = createPlatformRes.data.data;
  createdProductIds.push(new mongoose.Types.ObjectId(platformProdData._id));
  assert(platformProdData.ownerType === 'PLATFORM', 'Admin-created product defaults to PLATFORM ownerType');
  assert(platformProdData.seller?._id === adminSellerId || platformProdData.seller === adminSellerId, 'Canonical platform seller assigned');

  // 10B: Admin creates product assigned to Vendor A
  const createVendorRes = await apiCall('POST', '/admin/products', adminToken, {
    productName: FIXTURE_PREFIX + '_Admin_Created_Vendor_Prod',
    sellerId: vendorAId,
    category: testCategoryId,
    price: 250,
    stock: 8,
    productType: 'ECOMMERCE',
    variations: [
      {
        name: 'Pack',
        value: '1pc',
        title: '1pc',
        price: 250,
        stock: 8,
        status: 'Available',
      },
    ],
  });
  assert(createVendorRes.status === 201, `Admin creates product assigned to Vendor A successfully (status ${createVendorRes.status})`);
  const vendorProdData = createVendorRes.data.data;
  createdProductIds.push(new mongoose.Types.ObjectId(vendorProdData._id));
  assert(vendorProdData.ownerType === 'VENDOR', `Admin-created vendor product has VENDOR ownerType (got "${vendorProdData?.ownerType}", full: ${JSON.stringify(vendorProdData)})`);
  assert(vendorProdData.seller?._id === vendorAId || vendorProdData.seller === vendorAId, 'Vendor A assigned as seller');

  // -------------------------------------------------------------------------
  // TEST 11: Admin Product Edit Preserves Vendor Ownership
  // -------------------------------------------------------------------------
  console.log('\nTEST 11: Admin Product Edit Preserves Vendor Ownership...');
  const editVendorRes = await apiCall('PUT', `/admin/products/${vendorProdData._id}`, adminToken, {
    productName: FIXTURE_PREFIX + '_Admin_Edited_Vendor_Prod',
    price: 280,
    variations: [
      {
        name: 'Pack',
        value: '1pc',
        title: '1pc',
        price: 280,
        stock: 8,
        status: 'Available',
      },
    ],
  });
  assert(editVendorRes.status === 200, `Admin edits vendor product successfully (status ${editVendorRes.status})`);
  const updatedDoc = await Product.findById(vendorProdData._id);
  assert(updatedDoc?.productName === FIXTURE_PREFIX + '_Admin_Edited_Vendor_Prod', 'Product name was updated');
  assert(updatedDoc?.seller.toString() === vendorAId, 'Vendor A seller ownership was strictly preserved!');
  assert(updatedDoc?.ownerType === 'VENDOR', 'ownerType VENDOR was strictly preserved!');

  // -------------------------------------------------------------------------
  // TEST 12: Seller Updates Variation Stock & Ledger Records Owner
  // -------------------------------------------------------------------------
  console.log('\nTEST 12: Seller Updates Variation Stock & Ledger Owner Recording...');
  const test12VariationId = updatedDoc!.variations![0]._id!.toString();
  const updateStockRes = await apiCall(
    'PATCH',
    `/products/${vendorProdData._id}/variations/${test12VariationId}/stock`,
    vendorAToken,
    { stock: 18 }
  );
  assert(updateStockRes.status === 200, 'Vendor updates their variation stock');

  const refreshedDoc = await Product.findById(vendorProdData._id);
  assert(refreshedDoc?.variations?.[0].stock === 18, 'Variation stock updated to 18 in database');

  // Verify transaction in ledger
  const sellerTxRes = await apiCall(
    'GET',
    `/admin/inventory/transactions?productId=${vendorProdData._id}&limit=5`,
    adminToken
  );
  assert(sellerTxRes.status === 200, 'Admin queries transaction ledger for seller mutation');
  const sellerTx = sellerTxRes.data.data.find((t: any) => t.product?._id === vendorProdData._id.toString());
  assert(!!sellerTx, 'Stock adjustment transaction found in ledger');
  assert(sellerTx.ownerType === 'VENDOR', 'Transaction ownerType is VENDOR');
  assert(sellerTx.seller?._id === vendorAId, 'Transaction seller is Vendor A');
  assert(sellerTx.newStock === 18, `Transaction records newStock 18 (got ${sellerTx.newStock})`);

  console.log('\n======================================================');
  console.log('ALL 12 TESTS + LIVE CHECK PASSED PERFECTLY!');
  console.log('======================================================\n');
}

async function teardown() {
  console.log('\n--- Cleaning up isolated test fixtures ---');
  try {
    // 1. Delete created products
    if (createdProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProductIds } });
      console.log(`Cleaned up ${createdProductIds.length} test products.`);
    }

    // 2. Delete created test transactions
    await InventoryTransaction.deleteMany({ note: new RegExp(FIXTURE_PREFIX) });
    console.log('Cleaned up test inventory transactions.');

    // 3. Delete created test sellers
    if (createdSellerIds.length > 0) {
      await Seller.deleteMany({ _id: { $in: createdSellerIds } });
      console.log(`Cleaned up ${createdSellerIds.length} test sellers.`);
    }

    // 4. Restore original threshold
    await AppSettings.findOneAndUpdate(
      {},
      { $set: { 'inventorySettings.lowStockThreshold': originalLowStockThreshold } }
    );
    console.log(`Restored original low stock threshold: ${originalLowStockThreshold}.`);
  } catch (err) {
    console.error('Error during teardown:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Teardown complete.');
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err: any) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
}

main();
