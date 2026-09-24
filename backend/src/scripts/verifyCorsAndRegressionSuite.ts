import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { io } from 'socket.io-client';
import Seller from '../models/Seller';
import Category from '../models/Category';
import Product from '../models/Product';
import { generateToken } from '../services/jwtService';
import connectDB from '../config/db';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api/v1';
const FRONTEND_ORIGIN = 'http://localhost:5173';

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE CORS & REGRESSION VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${title}`);
      if (details) console.error('     Details:', details);
      failed++;
    }
  }

  await connectDB();
  console.log('Connected to MongoDB.\n');

  // Setup test fixtures
  console.log('Setting up isolated test fixtures...');
  const qcCat = await Category.findOneAndUpdate(
    { slug: 'verify-qc-cat' },
    {
      name: 'Verify QC Category',
      slug: 'verify-qc-cat',
      status: 'Active',
      parentId: null,
      commerceChannels: ['QUICK_COMMERCE'],
    },
    { upsert: true, new: true }
  );

  const ecomCat = await Category.findOneAndUpdate(
    { slug: 'verify-ecom-cat' },
    {
      name: 'Verify Ecom Category',
      slug: 'verify-ecom-cat',
      status: 'Active',
      parentId: null,
      commerceChannels: ['ECOMMERCE'],
    },
    { upsert: true, new: true }
  );

  const bothCat = await Category.findOneAndUpdate(
    { slug: 'verify-both-cat' },
    {
      name: 'Verify Both Category',
      slug: 'verify-both-cat',
      status: 'Active',
      parentId: null,
      commerceChannels: ['QUICK_COMMERCE', 'ECOMMERCE'],
    },
    { upsert: true, new: true }
  );

  const hybridSeller = await Seller.findOneAndUpdate(
    { email: 'hybrid_verify_test@example.com' },
    {
      sellerName: 'Hybrid Verify Seller',
      storeName: 'Hybrid Verify Store',
      email: 'hybrid_verify_test@example.com',
      mobile: '9888877779',
      vendorType: 'HYBRID',
      status: 'Approved',
      latitude: 22.7196,
      longitude: 75.8577,
      location: {
        type: 'Point',
        coordinates: [75.8577, 22.7196],
      },
      serviceRadiusKm: 15,
      address: 'Indore, MP',
      city: 'Indore',
    },
    { upsert: true, new: true }
  );

  const qcProduct = await Product.findOneAndUpdate(
    { productName: 'Verify QC Product' },
    {
      productName: 'Verify QC Product',
      seller: hybridSeller._id,
      category: qcCat._id,
      productType: 'QUICK_COMMERCE',
      publish: true,
      price: 100,
      stock: 50,
      variations: [{ title: 'Standard', price: 100, discPrice: 90, stock: 50, status: 'In stock' }],
    },
    { upsert: true, new: true }
  );

  const ecomProduct = await Product.findOneAndUpdate(
    { productName: 'Verify Ecom Product' },
    {
      productName: 'Verify Ecom Product',
      seller: hybridSeller._id,
      category: ecomCat._id,
      productType: 'ECOMMERCE',
      publish: true,
      price: 200,
      stock: 30,
      variations: [{ title: 'Standard', price: 200, discPrice: 180, stock: 30, status: 'In stock' }],
    },
    { upsert: true, new: true }
  );

  const sellerToken = generateToken(hybridSeller._id.toString(), 'Seller');
  console.log('Fixtures initialized successfully.\n');

  // =========================================================================
  // SECTION 1: PREFLIGHT OPTIONS TESTING (TEST 9 & TEST 10)
  // =========================================================================
  console.log('--- SECTION 1: HTTP OPTIONS Preflight Verification (TEST 9 & TEST 10) ---');
  const preflightEndpoints = [
    '/seller/notifications',
    '/categories',
    '/products',
    '/customer/wishlist',
    '/languages',
    '/seller/dashboard/stats',
    '/seller/orders',
    '/seller/taxes',
  ];

  for (const endpoint of preflightEndpoints) {
    try {
      const res = await axios.options(`${API_BASE}${endpoint}`, {
        headers: {
          'Origin': FRONTEND_ORIGIN,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,x-channel',
        },
      });

      assert(res.status === 204, `OPTIONS ${endpoint} returns 204 No Content`);
      const allowOrigin = res.headers['access-control-allow-origin'];
      const allowHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
      const allowCreds = res.headers['access-control-allow-credentials'];

      assert(allowOrigin === FRONTEND_ORIGIN, `OPTIONS ${endpoint} allows origin ${FRONTEND_ORIGIN}`);
      assert(allowCreds === 'true', `OPTIONS ${endpoint} allows credentials`);
      assert(allowHeaders.includes('x-channel'), `OPTIONS ${endpoint} Access-Control-Allow-Headers includes x-channel`);
      assert(allowHeaders.includes('authorization'), `OPTIONS ${endpoint} Access-Control-Allow-Headers includes authorization`);
    } catch (err: any) {
      assert(false, `OPTIONS ${endpoint} threw error`, err.message);
    }
  }

  // =========================================================================
  // SECTION 2: TEST 1 & TEST 2 - SELLER CATEGORY WITH CHANNELS
  // =========================================================================
  console.log('\n--- SECTION 2: Seller Category Channel-Based Filtering (TEST 1 & TEST 2) ---');

  // TEST 1: Seller + Quick Commerce
  try {
    const resQc = await axios.get(`${API_BASE}/categories`, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'Authorization': `Bearer ${sellerToken}`,
        'x-channel': 'QUICK_COMMERCE',
      },
    });
    assert(resQc.status === 200, 'TEST 1: GET /categories with x-channel: QUICK_COMMERCE returns 200 OK');
    const qcCategories: any[] = resQc.data.data;
    const hasQcCat = qcCategories.some((c) => c.slug === 'verify-qc-cat');
    const hasBothCat = qcCategories.some((c) => c.slug === 'verify-both-cat');
    const hasEcomCat = qcCategories.some((c) => c.slug === 'verify-ecom-cat');

    assert(hasQcCat, 'TEST 1: Quick Commerce-only category IS present');
    assert(hasBothCat, 'TEST 1: Both-channel category IS present');
    assert(!hasEcomCat, 'TEST 1: E-commerce-only category is STRICTLY excluded');
  } catch (err: any) {
    assert(false, 'TEST 1 failed with error', err.message);
  }

  // TEST 2: Seller + E-commerce
  try {
    const resEcom = await axios.get(`${API_BASE}/categories`, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'Authorization': `Bearer ${sellerToken}`,
        'x-channel': 'ECOMMERCE',
      },
    });
    assert(resEcom.status === 200, 'TEST 2: GET /categories with x-channel: ECOMMERCE returns 200 OK');
    const ecomCategories: any[] = resEcom.data.data;
    const hasQcCat = ecomCategories.some((c) => c.slug === 'verify-qc-cat');
    const hasBothCat = ecomCategories.some((c) => c.slug === 'verify-both-cat');
    const hasEcomCat = ecomCategories.some((c) => c.slug === 'verify-ecom-cat');

    assert(hasEcomCat, 'TEST 2: E-commerce-only category IS present');
    assert(hasBothCat, 'TEST 2: Both-channel category IS present');
    assert(!hasQcCat, 'TEST 2: Quick Commerce-only category is STRICTLY excluded');
  } catch (err: any) {
    assert(false, 'TEST 2 failed with error', err.message);
  }

  // =========================================================================
  // SECTION 3: TEST 3 & TEST 4 - SELLER PRODUCT LIST WITH CHANNELS
  // =========================================================================
  console.log('\n--- SECTION 3: Seller Product List Filtering (TEST 3 & TEST 4) ---');

  // TEST 3: Seller + Quick Commerce
  try {
    const resQcProducts = await axios.get(`${API_BASE}/products`, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'Authorization': `Bearer ${sellerToken}`,
        'x-channel': 'QUICK_COMMERCE',
      },
    });
    assert(resQcProducts.status === 200, 'TEST 3: GET /products with x-channel: QUICK_COMMERCE returns 200 OK');
    const qcProducts: any[] = resQcProducts.data.data;
    const hasQcProd = qcProducts.some((p) => p.productName === 'Verify QC Product');
    const hasEcomProd = qcProducts.some((p) => p.productName === 'Verify Ecom Product');

    assert(hasQcProd, 'TEST 3: Quick Commerce product IS present');
    assert(!hasEcomProd, 'TEST 3: E-commerce product is STRICTLY excluded');
  } catch (err: any) {
    assert(false, 'TEST 3 failed with error', err.message);
  }

  // TEST 4: Seller + E-commerce
  try {
    const resEcomProducts = await axios.get(`${API_BASE}/products`, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'Authorization': `Bearer ${sellerToken}`,
        'x-channel': 'ECOMMERCE',
      },
    });
    assert(resEcomProducts.status === 200, 'TEST 4: GET /products with x-channel: ECOMMERCE returns 200 OK');
    const ecomProducts: any[] = resEcomProducts.data.data;
    const hasQcProd = ecomProducts.some((p) => p.productName === 'Verify QC Product');
    const hasEcomProd = ecomProducts.some((p) => p.productName === 'Verify Ecom Product');

    assert(hasEcomProd, 'TEST 4: E-commerce product IS present');
    assert(!hasQcProd, 'TEST 4: Quick Commerce product is STRICTLY excluded');
  } catch (err: any) {
    assert(false, 'TEST 4 failed with error', err.message);
  }

  // =========================================================================
  // SECTION 4: TEST 5 - SELLER NOTIFICATIONS
  // =========================================================================
  console.log('\n--- SECTION 4: Seller Notifications (TEST 5) ---');
  try {
    const resNotif = await axios.get(`${API_BASE}/seller/notifications`, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'Authorization': `Bearer ${sellerToken}`,
        'x-channel': 'QUICK_COMMERCE',
      },
    });
    assert(resNotif.status === 200, 'TEST 5: GET /seller/notifications returns 200 OK with x-channel header');
    assert(Array.isArray(resNotif.data.data), 'TEST 5: Notifications array returned');
  } catch (err: any) {
    assert(false, 'TEST 5 failed with error', err.message);
  }

  // =========================================================================
  // SECTION 5: TEST 6 - SELLER DASHBOARD
  // =========================================================================
  console.log('\n--- SECTION 5: Seller Dashboard Requests (TEST 6) ---');
  try {
    const resDash = await axios.get(`${API_BASE}/seller/dashboard/stats`, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'Authorization': `Bearer ${sellerToken}`,
        'x-channel': 'QUICK_COMMERCE',
      },
    });
    assert(resDash.status === 200, 'TEST 6: GET /seller/dashboard/stats returns 200 OK with x-channel header');
  } catch (err: any) {
    assert(false, 'TEST 6 failed with error', err.message);
  }

  // =========================================================================
  // SECTION 6: TEST 7 - ADMIN VERIFICATION
  // =========================================================================
  console.log('\n--- SECTION 6: Admin Routes Unbroken (TEST 7) ---');
  try {
    const adminToken = generateToken('6761647f0000000000000001', 'Admin', 'Super Admin');
    const resAdmin = await axios.get(`${API_BASE}/languages`, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    assert(resAdmin.status === 200, 'TEST 7: Admin API /languages returns 200 OK');
  } catch (err: any) {
    assert(false, 'TEST 7 failed with error', err.message);
  }

  // =========================================================================
  // SECTION 7: TEST 8 - CUSTOMER VERIFICATION
  // =========================================================================
  console.log('\n--- SECTION 7: Customer Routes Unbroken (TEST 8) ---');
  try {
    const resCustCat = await axios.get(`${API_BASE}/customer/categories`, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
      },
    });
    assert(resCustCat.status === 200, 'TEST 8: Customer GET /customer/categories returns 200 OK');

    const resCustProd = await axios.get(`${API_BASE}/customer/products`, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
      },
    });
    assert(resCustProd.status === 200, 'TEST 8: Customer GET /customer/products returns 200 OK');
  } catch (err: any) {
    assert(false, 'TEST 8 failed with error', err.message);
  }

  // =========================================================================
  // SECTION 8: TEST 11 - CHANNEL SWITCHING (QC -> ECOM -> QC)
  // =========================================================================
  console.log('\n--- SECTION 8: Dynamic Channel Switching (TEST 11) ---');
  try {
    // 1. Initial QC
    const r1 = await axios.get(`${API_BASE}/categories`, {
      headers: { 'Origin': FRONTEND_ORIGIN, 'Authorization': `Bearer ${sellerToken}`, 'x-channel': 'QUICK_COMMERCE' },
    });
    const qcCount1 = r1.data.data.length;

    // 2. Switch to ECOM
    const r2 = await axios.get(`${API_BASE}/categories`, {
      headers: { 'Origin': FRONTEND_ORIGIN, 'Authorization': `Bearer ${sellerToken}`, 'x-channel': 'ECOMMERCE' },
    });
    const ecomCount = r2.data.data.length;

    // 3. Switch back to QC
    const r3 = await axios.get(`${API_BASE}/categories`, {
      headers: { 'Origin': FRONTEND_ORIGIN, 'Authorization': `Bearer ${sellerToken}`, 'x-channel': 'QUICK_COMMERCE' },
    });
    const qcCount2 = r3.data.data.length;

    assert(qcCount1 === qcCount2, `TEST 11: Consistent item counts switching back to QC (${qcCount1} === ${qcCount2})`);
    assert(r2.data.data.every((c: any) => c.commerceChannels.includes('ECOMMERCE')), 'TEST 11: All items in Ecom channel valid for E-commerce');
    assert(r3.data.data.every((c: any) => c.commerceChannels.includes('QUICK_COMMERCE')), 'TEST 11: All items in QC channel valid for Quick Commerce');
  } catch (err: any) {
    assert(false, 'TEST 11 failed with error', err.message);
  }

  // =========================================================================
  // SECTION 9: SOCKET.IO VERIFICATION (SECTION 11)
  // =========================================================================
  console.log('\n--- SECTION 9: Socket.IO Live Connection Test ---');
  const socketSuccess = await new Promise<boolean>((resolve) => {
    const s = io('http://localhost:5000', {
      transports: ['websocket'],
      auth: { token: sellerToken },
    });
    const timeout = setTimeout(() => {
      s.disconnect();
      resolve(false);
    }, 5000);

    s.on('connect', () => {
      clearTimeout(timeout);
      s.disconnect();
      resolve(true);
    });

    s.on('connect_error', () => {
      clearTimeout(timeout);
      s.disconnect();
      resolve(false);
    });
  });
  assert(socketSuccess, 'Socket.IO client connected successfully over WebSocket to ws://localhost:5000/socket.io/');

  // Cleanup test fixtures
  console.log('\nCleaning up test fixtures...');
  await Category.deleteMany({ slug: { $in: ['verify-qc-cat', 'verify-ecom-cat', 'verify-both-cat'] } });
  await Product.deleteMany({ productName: { $in: ['Verify QC Product', 'Verify Ecom Product'] } });
  await Seller.deleteOne({ email: 'hybrid_verify_test@example.com' });
  console.log('Cleanup completed.\n');

  console.log('================================================================');
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed} ✅`);
  console.log(`FAILED: ${failed} ❌`);
  console.log('================================================================');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runVerification().catch((err) => {
  console.error('Fatal verification runner error:', err);
  process.exit(1);
});
