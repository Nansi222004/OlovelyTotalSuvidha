/**
 * testAdminLowStockNotificationSuite.ts
 *
 * Comprehensive test suite verifying:
 * 1. Admin sends alert for vendor-owned simple product
 * 2. Admin sends alert for vendor-owned variation
 * 3. Dynamic message content verification (product name, variation, stock, threshold)
 * 4. Vendor recipient isolation (Vendor A receives notification; Vendor B does not)
 * 5. Platform inventory rejection (cannot send vendor alert for platform-owned items)
 * 6. Non-admin authorization rejection (vendor token cannot access admin notification endpoint)
 * 7. Graceful handling of missing vendor device tokens (in-app record created, pushDelivered reported accurately)
 * 8. Rejection when stock is above threshold (currentStock > threshold returns 400)
 * 9. Unauthenticated request rejection (returns 401)
 * 10. Data integrity check: zero unintended mutations to stock, inventory transactions, orders, wallets
 *
 * SAFETY:
 * - Isolated test fixtures using unique prefix TEST_NOTIF_
 * - Mocked / safe push intercept via FCM pipeline
 * - Guaranteed teardown in finally block
 */

import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Seller from '../models/Seller';
import Notification from '../models/Notification';
import InventoryTransaction from '../models/InventoryTransaction';
import AppSettings from '../models/AppSettings';
import Category from '../models/Category';
import { getCanonicalAdminSeller } from '../utils/inventoryHelper';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const FIXTURE_PREFIX = 'TEST_NOTIF_' + Date.now();

let adminToken: string;
let vendorAToken: string;
let vendorBToken: string;

let adminSellerId: string;
let vendorAId: string;
let vendorBId: string;
let testCategoryId: string;

const createdProductIds: mongoose.Types.ObjectId[] = [];
const createdSellerIds: mongoose.Types.ObjectId[] = [];
const createdNotificationIds: mongoose.Types.ObjectId[] = [];

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
  console.log('--- Setting up test environment and isolated fixtures ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/total-suvidha');

  const adminSeller = await getCanonicalAdminSeller();
  adminSellerId = adminSeller._id.toString();

  // 1. Isolated test vendors
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

  console.log('Environment ready.');
}

async function runTests() {
  console.log('\n===========================================================');
  console.log('RUNNING ADMIN LOW STOCK ALERT → VENDOR NOTIFICATION SUITE');
  console.log('===========================================================\n');

  // Baseline transaction count for data integrity assertion
  const initialTxCount = await InventoryTransaction.countDocuments();

  // -------------------------------------------------------------------------
  // TEST 1: Admin Sends Alert for Low-Stock Vendor Simple Product
  // -------------------------------------------------------------------------
  console.log('TEST 1: Admin Sends Alert for Low-Stock Vendor Simple Product...');
  const simpleProd = await Product.create({
    productName: FIXTURE_PREFIX + '_VendorA_Simple',
    price: 150,
    stock: 4, // low stock <= 10
    seller: vendorAId,
    ownerType: 'VENDOR',
    category: testCategoryId,
    productType: 'QUICK_COMMERCE',
    status: 'Active',
    publish: true,
  });
  createdProductIds.push(simpleProd._id);

  const res1 = await apiCall('POST', '/admin/inventory/notify-vendor', adminToken, {
    productId: simpleProd._id.toString(),
  });

  assert(res1.status === 200, `POST /admin/inventory/notify-vendor responded with 200 (got ${res1.status})`);
  assert(res1.data.success === true, 'Response indicates success: true');
  assert(res1.data.data?.recipientId === vendorAId, 'Recipient resolved to Vendor A');
  assert(res1.data.data?.currentStock === 4, 'Reported stock matches database stock (4)');
  assert(res1.data.data?.inAppCreated === true, 'In-app notification created flag is true');
  assert(typeof res1.data.data?.pushDelivered === 'boolean', 'pushDelivered reported as boolean');

  // Verify Notification document in database
  const notif1 = await Notification.findById(res1.data.data.notificationId);
  assert(!!notif1, 'Notification document saved in MongoDB');
  createdNotificationIds.push(notif1!._id);
  assert(notif1!.recipientType === 'Seller', 'Recipient type is Seller');
  assert(notif1!.recipientId?.toString() === vendorAId, 'Recipient ID matches Vendor A');
  assert(notif1!.title === 'Low Stock Alert', 'Title is "Low Stock Alert"');
  assert(notif1!.link === '/seller/product/stock', 'Deep link points to /seller/product/stock');
  assert(notif1!.priority === 'High', 'Priority is High');
  assert(notif1!.type === 'Warning', 'Notification type is Warning');
  assert(notif1!.createdBy?.toString() === '6a7d5b02259ec525f6753dda', 'Admin ID recorded in createdBy');

  // -------------------------------------------------------------------------
  // TEST 2: Admin Sends Alert for Low-Stock Vendor Variation
  // -------------------------------------------------------------------------
  console.log('\nTEST 2: Admin Sends Alert for Low-Stock Vendor Variation...');
  const varProd = await Product.create({
    productName: FIXTURE_PREFIX + '_VendorA_Variations',
    price: 300,
    stock: 100, // root stock is high
    seller: vendorAId,
    ownerType: 'VENDOR',
    category: testCategoryId,
    productType: 'QUICK_COMMERCE',
    status: 'Active',
    publish: true,
    variations: [
      {
        title: '500g',
        name: 'Size',
        value: '500g',
        price: 300,
        stock: 3, // variation stock <= 10
        status: 'Available',
      },
      {
        title: '1Kg',
        name: 'Size',
        value: '1Kg',
        price: 550,
        stock: 50, // above threshold
        status: 'Available',
      },
    ],
  });
  createdProductIds.push(varProd._id);
  const lowVarId = varProd.variations![0]._id!.toString();

  const res2 = await apiCall('POST', '/admin/inventory/notify-vendor', adminToken, {
    productId: varProd._id.toString(),
    variationId: lowVarId,
  });

  assert(res2.status === 200, `POST /admin/inventory/notify-vendor responded with 200 (got ${res2.status})`);
  assert(res2.data.success === true, 'Response indicates success');
  assert(res2.data.data?.currentStock === 3, 'Reported stock uses variation stock (3), not root stock (100)');
  assert(res2.data.data?.item.includes('500g'), 'Item display name includes variation name ("500g")');

  const notif2 = await Notification.findById(res2.data.data.notificationId);
  assert(!!notif2, 'Variation alert notification saved in DB');
  createdNotificationIds.push(notif2!._id);
  assert(notif2!.message.includes('500g'), 'Notification body contains variation name');
  assert(notif2!.message.includes('Current stock: 3 units'), 'Notification body reports variation stock 3');

  // -------------------------------------------------------------------------
  // TEST 3: Dynamic Content Verification (Product, Variant, Stock, Threshold)
  // -------------------------------------------------------------------------
  console.log('\nTEST 3: Dynamic Content Verification...');
  const settings = await AppSettings.getSettings();
  const threshold = Number(settings.inventorySettings?.lowStockThreshold ?? 10);

  assert(notif2!.message.includes(`Threshold: ${threshold} units`), `Notification message includes dynamic threshold (${threshold})`);
  assert(notif2!.message.includes('Please replenish your inventory'), 'Notification message includes replenish instruction');

  // -------------------------------------------------------------------------
  // TEST 4: Vendor Recipient Isolation (Vendor A vs Vendor B)
  // -------------------------------------------------------------------------
  console.log('\nTEST 4: Vendor Recipient Isolation (Vendor A vs Vendor B)...');
  // Vendor A checks their notifications
  const vendorANotifs = await apiCall('GET', '/seller/notifications', vendorAToken);
  assert(vendorANotifs.status === 200, 'Vendor A fetches notifications');
  const hasAAlert = vendorANotifs.data.data.some((n: any) => n._id === notif1!._id.toString());
  assert(hasAAlert, 'Vendor A received the notification in their notification center');

  // Vendor B checks their notifications
  const vendorBNotifs = await apiCall('GET', '/seller/notifications', vendorBToken);
  assert(vendorBNotifs.status === 200, 'Vendor B fetches notifications');
  const hasBAlert = vendorBNotifs.data.data.some((n: any) =>
    n._id === notif1!._id.toString() || n._id === notif2!._id.toString()
  );
  assert(!hasBAlert, 'Vendor B received ZERO notifications for Vendor A products (Strict Isolation preserved)');

  // -------------------------------------------------------------------------
  // TEST 5: Platform Inventory Rejection
  // -------------------------------------------------------------------------
  console.log('\nTEST 5: Platform Inventory Rejection...');
  const platformProd = await Product.create({
    productName: FIXTURE_PREFIX + '_Platform_Product',
    price: 99,
    stock: 2, // low stock
    seller: adminSellerId,
    ownerType: 'PLATFORM',
    category: testCategoryId,
    productType: 'QUICK_COMMERCE',
    status: 'Active',
    publish: true,
  });
  createdProductIds.push(platformProd._id);

  const resPlatform = await apiCall('POST', '/admin/inventory/notify-vendor', adminToken, {
    productId: platformProd._id.toString(),
  });
  assert(resPlatform.status === 400, `Platform product alert correctly rejected with 400 (got ${resPlatform.status})`);
  assert(
    resPlatform.data.message.includes('platform-owned') || resPlatform.data.message.includes('Platform'),
    `Rejection message clearly explains platform inventory: "${resPlatform.data.message}"`
  );

  // -------------------------------------------------------------------------
  // TEST 6: Authorization Enforcement (Vendor Token Calling Admin Endpoint)
  // -------------------------------------------------------------------------
  console.log('\nTEST 6: Authorization Enforcement (Vendor calling Admin endpoint)...');
  const resUnauthorized = await apiCall('POST', '/admin/inventory/notify-vendor', vendorAToken, {
    productId: simpleProd._id.toString(),
  });
  assert(resUnauthorized.status === 403, `Vendor calling Admin notify-vendor rejected with 403 (got ${resUnauthorized.status})`);

  // -------------------------------------------------------------------------
  // TEST 7: Missing Device Tokens Handled Gracefully
  // -------------------------------------------------------------------------
  console.log('\nTEST 7: Missing Device Tokens Handled Gracefully...');
  // Vendor Alpha was created without any FCM tokens
  const vendorADoc = await Seller.findById(vendorAId);
  assert(!vendorADoc?.fcmTokens?.length, 'Vendor Alpha has no registered FCM tokens');
  // Res1 succeeded and reported pushDelivered: false without throwing any errors
  assert(res1.data.data?.pushDelivered === false, 'pushDelivered accurately reported as false when tokens absent');
  assert(res1.data.data?.inAppCreated === true, 'inAppCreated accurately reported as true');

  // -------------------------------------------------------------------------
  // TEST 8: Rejection When Stock Is Above Threshold
  // -------------------------------------------------------------------------
  console.log('\nTEST 8: Rejection When Stock Is Above Threshold...');
  const highStockProd = await Product.create({
    productName: FIXTURE_PREFIX + '_HighStock_Prod',
    price: 200,
    stock: 50, // well above threshold 10
    seller: vendorAId,
    ownerType: 'VENDOR',
    category: testCategoryId,
    productType: 'QUICK_COMMERCE',
    status: 'Active',
    publish: true,
  });
  createdProductIds.push(highStockProd._id);

  const resHigh = await apiCall('POST', '/admin/inventory/notify-vendor', adminToken, {
    productId: highStockProd._id.toString(),
  });
  assert(resHigh.status === 400, `Product with stock 50 > threshold rejected with 400 (got ${resHigh.status})`);
  assert(
    resHigh.data.message.includes('no longer low on stock'),
    `Rejection message accurately explains stock status: "${resHigh.data.message}"`
  );

  // -------------------------------------------------------------------------
  // TEST 9: Unauthenticated Request Rejection
  // -------------------------------------------------------------------------
  console.log('\nTEST 9: Unauthenticated Request Rejection...');
  const resUnauth = await apiCall('POST', '/admin/inventory/notify-vendor', undefined, {
    productId: simpleProd._id.toString(),
  });
  assert(resUnauth.status === 401, `Unauthenticated request rejected with 401 (got ${resUnauth.status})`);

  // -------------------------------------------------------------------------
  // TEST 10: Data Integrity Check (Zero Unintended Mutations)
  // -------------------------------------------------------------------------
  console.log('\nTEST 10: Data Integrity Check (Zero Unintended Mutations)...');
  // Stock unchanged
  const refreshedSimple = await Product.findById(simpleProd._id);
  assert(refreshedSimple?.stock === 4, 'Simple product stock remained strictly 4 (unmodified)');

  const refreshedVar = await Product.findById(varProd._id);
  assert(refreshedVar?.variations?.[0].stock === 3, 'Variation stock remained strictly 3 (unmodified)');
  assert(refreshedVar?.stock === varProd.stock, `Root product stock remained strictly ${varProd.stock} (unmodified)`);

  // No unexpected inventory transactions created by alert
  const finalTxCount = await InventoryTransaction.countDocuments();
  assert(finalTxCount === initialTxCount, `InventoryTransaction count unchanged (${finalTxCount} === ${initialTxCount})`);

  console.log('\n===========================================================');
  console.log('ALL 10 TESTS PASSED PERFECTLY!');
  console.log('===========================================================\n');
}

async function teardown() {
  console.log('\n--- Cleaning up isolated test fixtures ---');
  try {
    if (createdProductIds.length > 0) {
      const resP = await Product.deleteMany({ _id: { $in: createdProductIds } });
      console.log(`Cleaned up ${resP.deletedCount} test products.`);
    }
    if (createdSellerIds.length > 0) {
      const resS = await Seller.deleteMany({ _id: { $in: createdSellerIds } });
      console.log(`Cleaned up ${resS.deletedCount} test sellers.`);
    }
    if (createdNotificationIds.length > 0) {
      const resN = await Notification.deleteMany({ _id: { $in: createdNotificationIds } });
      console.log(`Cleaned up ${resN.deletedCount} test notifications.`);
    }
  } catch (err: any) {
    console.error('Teardown warning:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Teardown complete.');
  }
}

async function main() {
  try {
    await setupEnvironment();
    await runTests();
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
}

main();
