/**
 * testVendorStockSafeguardsSuite.ts
 *
 * Automated verification suite for Vendor Stock Management safeguards & Admin Stock Adjustment.
 *
 * Requirements verified:
 * 1. Admin generic Stock In, Adjust, and Damage reject vendor-owned inventory with clear vendor-guidance message.
 * 2. Admin retains stock adjustment functionality for platform-owned inventory.
 * 3. Platform products with variations require valid selected variation.
 * 4. Root stock and variation stock remain synchronized in lockstep.
 * 5. Success returned only after stock update and ledger transaction commit.
 * 6. Ownership resolution rules enforced; rejects if unsafe.
 * 7. Vendor Stock Management API (PATCH /products/:id/variations/:variationId/stock) and
 *    Vendor Product List API (GET /products) operate intact without regressions.
 *
 * SAFETY GUARANTEES:
 * - Uses isolated fixtures prefixed with TEST_SAFEGUARD_<timestamp>
 * - NEVER targets or mutates real live inventory or existing seller records
 * - Guaranteed teardown in finally block
 */

import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Seller from '../models/Seller';
import InventoryTransaction from '../models/InventoryTransaction';
import Category from '../models/Category';
import { getCanonicalAdminSeller } from '../utils/inventoryHelper';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_dev_only';
const FIXTURE_PREFIX = 'TEST_SAFEGUARD_' + Date.now();

let adminToken: string;
let vendorToken: string;

let adminSellerId: string;
let testVendorId: string;
let testCategoryId: string;

const createdProductIds: mongoose.Types.ObjectId[] = [];
const createdSellerIds: mongoose.Types.ObjectId[] = [];
const createdTxIds: mongoose.Types.ObjectId[] = [];

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

async function setupEnvironment() {
  console.log('--- Setting up isolated test environment ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/total-suvidha');

  const adminSeller = await getCanonicalAdminSeller();
  adminSellerId = adminSeller._id.toString();

  // 1. Isolated test vendor
  const vendor = await Seller.create({
    sellerName: 'Vendor Safeguard ' + FIXTURE_PREFIX,
    storeName: 'Store Safeguard ' + FIXTURE_PREFIX,
    email: `vendor_${FIXTURE_PREFIX.toLowerCase()}@test.com`,
    mobile: '98' + Math.floor(10000000 + Math.random() * 90000000),
    password: 'TestPassword_' + Date.now(),
    category: 'Grocery',
    status: 'Approved',
    vendorType: 'HYBRID',
    requireProductApproval: false,
    isPlatform: false,
    isShopOpen: true,
  });
  testVendorId = vendor._id.toString();
  createdSellerIds.push(vendor._id);

  // 2. Category
  let category = await Category.findOne();
  if (!category) {
    category = await Category.create({
      name: 'Test Category ' + FIXTURE_PREFIX,
      order: 1,
      commerceChannels: ['ECOMMERCE', 'QUICK_COMMERCE'],
    });
  }
  testCategoryId = category._id.toString();

  // 3. Tokens
  adminToken = jwt.sign(
    { userId: '6a7d5b02259ec525f6753dda', userType: 'Admin', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  vendorToken = jwt.sign(
    { userId: testVendorId, userType: 'Seller', role: 'seller' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  console.log('Environment ready.\n');
}

async function runTests() {
  console.log('===========================================================');
  console.log('RUNNING VENDOR STOCK SAFEGUARDS & ADMIN ADJUSTMENT SUITE');
  console.log('===========================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Admin Generic Operations Reject Vendor-Owned Inventory
  // -------------------------------------------------------------------------
  console.log('TEST 1: Admin Generic Adjust/Damage/Stock-In Rejects Vendor-Owned Inventory...');
  const vendorProd = await Product.create({
    productName: FIXTURE_PREFIX + '_Vendor_Item',
    price: 120,
    seller: testVendorId,
    ownerType: 'VENDOR',
    category: testCategoryId,
    productType: 'QUICK_COMMERCE',
    status: 'Active',
    publish: true,
    variations: [
      {
        name: 'Pack',
        value: '500g',
        title: '500g',
        price: 120,
        stock: 5,
        status: 'Available',
      },
    ],
  });
  createdProductIds.push(vendorProd._id);
  const vendorVarId = vendorProd.variations![0]._id!.toString();

  // 1a. Attempt Adjust
  const adjRes = await apiCall('POST', '/admin/inventory/adjust', adminToken, {
    productId: vendorProd._id.toString(),
    variationId: vendorVarId,
    delta: 10,
    note: 'Admin attempted adjust on vendor item',
  });
  assert(adjRes.status === 400, `POST /admin/inventory/adjust on vendor item rejected with 400 (got ${adjRes.status})`);
  assert(adjRes.data.success === false, 'Response indicates success: false');
  assert(
    adjRes.data.message.includes('Cannot adjust stock for vendor-owned inventory') &&
    adjRes.data.message.includes('Vendor Panel') &&
    adjRes.data.message.includes('Low Stock Alert'),
    'Rejection message clearly explains vendor ownership, Vendor Panel, and Low Stock Alert redirection'
  );

  // 1b. Attempt Damage
  const dmgRes = await apiCall('POST', '/admin/inventory/damage', adminToken, {
    productId: vendorProd._id.toString(),
    variationId: vendorVarId,
    quantity: 2,
    note: 'Admin attempted damage on vendor item',
  });
  assert(dmgRes.status === 400, `POST /admin/inventory/damage on vendor item rejected with 400 (got ${dmgRes.status})`);
  assert(dmgRes.data.message.includes('Cannot adjust stock for vendor-owned inventory'), 'Damage rejection message explains vendor ownership');

  // 1c. Attempt Stock-In
  const inRes = await apiCall('POST', '/admin/inventory/stock-in', adminToken, {
    productId: vendorProd._id.toString(),
    variationId: vendorVarId,
    quantity: 20,
    note: 'Admin attempted stock-in on vendor item',
  });
  assert(inRes.status === 400, `POST /admin/inventory/stock-in on vendor item rejected with 400 (got ${inRes.status})`);
  assert(inRes.data.message.includes('Cannot adjust stock for vendor-owned inventory'), 'Stock-in rejection message explains vendor ownership');

  // Verify stock remained untouched
  const vendorProdCheck = await Product.findById(vendorProd._id).lean();
  assert(vendorProdCheck?.variations?.[0]?.stock === 5, 'Vendor variation stock remained strictly 5 (untouched)');
  assert(vendorProdCheck?.stock === 5, 'Vendor root stock remained strictly 5 (untouched)');

  // -------------------------------------------------------------------------
  // TEST 2: Admin Successfully Adjusts Platform-Owned Simple Product
  // -------------------------------------------------------------------------
  console.log('\nTEST 2: Admin Successfully Adjusts Platform Simple Product...');
  const platformSimple = await Product.create({
    productName: FIXTURE_PREFIX + '_Platform_Simple',
    price: 250,
    stock: 10,
    seller: adminSellerId,
    ownerType: 'PLATFORM',
    category: testCategoryId,
    productType: 'QUICK_COMMERCE',
    status: 'Active',
    publish: true,
    variations: [],
  });
  createdProductIds.push(platformSimple._id);

  const platSimpleAdj = await apiCall('POST', '/admin/inventory/adjust', adminToken, {
    productId: platformSimple._id.toString(),
    delta: 15,
    note: 'Restock platform simple item',
  });
  assert(platSimpleAdj.status === 200, `POST /admin/inventory/adjust on platform simple product succeeded with 200`);
  assert(platSimpleAdj.data.success === true, 'Response indicates success: true');
  assert(platSimpleAdj.data.data?.previousStock === 10, 'Reported previous stock is 10');
  assert(platSimpleAdj.data.data?.newStock === 25, 'Reported new stock is 25');

  const platSimpleCheck = await Product.findById(platformSimple._id).lean();
  assert(platSimpleCheck?.stock === 25, 'Database stock updated from 10 to 25');

  // Check ledger transaction
  const simpleTx = await InventoryTransaction.findById(platSimpleAdj.data.data?.transactionId);
  assert(!!simpleTx, 'InventoryTransaction recorded in database');
  createdTxIds.push(simpleTx!._id);
  assert(simpleTx!.ownerType === 'PLATFORM', 'Transaction ownerType is PLATFORM');
  assert(simpleTx!.quantity === 15, 'Transaction quantity is +15');

  // -------------------------------------------------------------------------
  // TEST 3: Admin Successfully Adjusts Platform-Owned Variation with Lockstep Sync
  // -------------------------------------------------------------------------
  console.log('\nTEST 3: Admin Adjusts Platform Variation with Lockstep Sync...');
  const platformVar = await Product.create({
    productName: FIXTURE_PREFIX + '_Platform_Variation',
    price: 300,
    seller: adminSellerId,
    ownerType: 'PLATFORM',
    category: testCategoryId,
    productType: 'QUICK_COMMERCE',
    status: 'Active',
    publish: true,
    variations: [
      {
        name: 'Size',
        value: '1Kg',
        title: '1Kg',
        price: 300,
        stock: 8,
        status: 'Available',
      },
      {
        name: 'Size',
        value: '2Kg',
        title: '2Kg',
        price: 550,
        stock: 4,
        status: 'Available',
      },
    ],
  });
  createdProductIds.push(platformVar._id);
  const targetVarId = platformVar.variations![0]._id!.toString();

  // Root stock initially = 8 + 4 = 12
  assert(platformVar.stock === 12, 'Initial root stock equals sum of variations (12)');

  const platVarAdj = await apiCall('POST', '/admin/inventory/adjust', adminToken, {
    productId: platformVar._id.toString(),
    variationId: targetVarId,
    delta: 5,
    note: 'Add 5 units to 1Kg variation',
  });
  assert(platVarAdj.status === 200, 'POST /admin/inventory/adjust on platform variation succeeded with 200');
  assert(platVarAdj.data.data?.previousStock === 8, 'Variation previous stock was 8');
  assert(platVarAdj.data.data?.newStock === 13, 'Variation new stock is 13');

  const platVarCheck = await Product.findById(platformVar._id).lean();
  assert(platVarCheck?.variations?.[0]?.stock === 13, 'Variation 0 stock updated from 8 to 13');
  assert(platVarCheck?.variations?.[1]?.stock === 4, 'Variation 1 stock remained 4');
  assert(platVarCheck?.stock === 17, 'Root Product.stock updated in lockstep to 17 (13 + 4)');

  // Verify Mongoose save hook preserves consistency
  const docToSave = await Product.findById(platformVar._id);
  await docToSave?.save();
  const refreshedAfterSave = await Product.findById(platformVar._id).lean();
  assert(refreshedAfterSave?.stock === 17, 'Root stock after save() hook remains strictly 17 (perfect consistency)');

  // -------------------------------------------------------------------------
  // TEST 4: Variation Targeting Safeguards on Platform Products
  // -------------------------------------------------------------------------
  console.log('\nTEST 4: Variation Targeting Safeguards on Platform Products...');

  // 4a. Missing variationId on variation product
  const missingVarRes = await apiCall('POST', '/admin/inventory/adjust', adminToken, {
    productId: platformVar._id.toString(),
    delta: 5,
  });
  assert(missingVarRes.status === 400, `Missing variationId on variation product rejected with 400 (got ${missingVarRes.status})`);
  assert(missingVarRes.data.message.includes('contains variations') && missingVarRes.data.message.includes('select a specific variation'), 'Message instructs Admin to select a variation');

  // 4b. Invalid/non-existent variationId on variation product
  const nonExistentVarId = new mongoose.Types.ObjectId().toString();
  const invalidVarRes = await apiCall('POST', '/admin/inventory/adjust', adminToken, {
    productId: platformVar._id.toString(),
    variationId: nonExistentVarId,
    delta: 5,
  });
  assert(invalidVarRes.status === 404, `Non-existent variationId rejected with 404 (got ${invalidVarRes.status})`);

  // 4c. Supplying variationId on simple product
  const simpleWithVarRes = await apiCall('POST', '/admin/inventory/adjust', adminToken, {
    productId: platformSimple._id.toString(),
    variationId: targetVarId,
    delta: 5,
  });
  assert(simpleWithVarRes.status === 400, `Supplying variationId on simple product rejected with 400 (got ${simpleWithVarRes.status})`);

  // -------------------------------------------------------------------------
  // TEST 5: Existing Vendor Stock Management & Vendor Product List API Integrity
  // -------------------------------------------------------------------------
  console.log('\nTEST 5: Vendor Stock Management API & Vendor Product List API Integrity...');

  // Vendor updates their own variation stock via standard vendor route
  const vendorStockUpdateRes = await apiCall(
    'PATCH',
    `/products/${vendorProd._id.toString()}/variations/${vendorVarId}/stock`,
    vendorToken,
    { stock: 25, status: 'Available' }
  );
  assert(vendorStockUpdateRes.status === 200, `PATCH /products/:id/variations/:variationId/stock responded with 200 (got ${vendorStockUpdateRes.status})`);
  assert(vendorStockUpdateRes.data.success === true, 'Vendor stock update succeeded');

  // Vendor queries products via standard Vendor Product List route
  const vendorListRes = await apiCall('GET', '/products', vendorToken);
  assert(vendorListRes.status === 200, 'GET /products responded with 200');
  const fetchedVendorProd = vendorListRes.data?.data?.find(
    (p: any) => p._id === vendorProd._id.toString()
  );
  assert(!!fetchedVendorProd, 'Vendor Product List returned the vendor product');
  assert(fetchedVendorProd.variations[0].stock === 25, 'Vendor Product List displays updated variation stock: 25');
  assert(fetchedVendorProd.stock === 25, 'Vendor Product List displays updated root stock: 25');

  // -------------------------------------------------------------------------
  // TEST 6: Unauthenticated Request Rejection
  // -------------------------------------------------------------------------
  console.log('\nTEST 6: Unauthenticated Request Rejection...');
  const unauthRes = await apiCall('POST', '/admin/inventory/adjust', undefined, {
    productId: platformSimple._id.toString(),
    delta: 5,
  });
  assert(unauthRes.status === 401, `Unauthenticated request rejected with 401 (got ${unauthRes.status})`);

  console.log('\n===========================================================');
  console.log('ALL 6 SAFEGUARD TESTS PASSED PERFECTLY!');
  console.log('===========================================================\n');
}

async function cleanupEnvironment() {
  console.log('--- Cleaning up isolated test fixtures ---');
  if (createdProductIds.length > 0) {
    const res = await Product.deleteMany({ _id: { $in: createdProductIds } });
    console.log(`Cleaned up ${res.deletedCount} test products.`);
  }
  if (createdSellerIds.length > 0) {
    const res = await Seller.deleteMany({ _id: { $in: createdSellerIds } });
    console.log(`Cleaned up ${res.deletedCount} test sellers.`);
  }
  if (createdTxIds.length > 0) {
    const res = await InventoryTransaction.deleteMany({ _id: { $in: createdTxIds } });
    console.log(`Cleaned up ${res.deletedCount} test transactions.`);
  }
  await mongoose.disconnect();
  console.log('Teardown complete.');
}

async function main() {
  try {
    await setupEnvironment();
    await runTests();
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exitCode = 1;
  } finally {
    await cleanupEnvironment();
  }
}

main();
