import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import { generateToken } from '../services/jwtService';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

async function runApprovalGatingTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING UNIFIED ACCOUNT-APPROVAL GATING TEST SUITE');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/grocery-delivery';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const TEST_SELLER_PHONE = '9999911111';
  const TEST_DELIVERY_PHONE = '9999922222';

  // Clean up any existing test records
  await Seller.deleteMany({ mobile: TEST_SELLER_PHONE });
  await Delivery.deleteMany({ mobile: TEST_DELIVERY_PHONE });

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? '- ' + details : ''}`);
      testsFailed++;
    }
  }

  try {
    // ==========================================
    // 1. SELLER APPROVAL GATING TESTS
    // ==========================================
    console.log('\n--- [1] SELLER APPROVAL GATING ---');

    // 1.1 Create pending seller
    const testSeller = await Seller.create({
      sellerName: 'QA Test Vendor',
      mobile: TEST_SELLER_PHONE,
      email: 'qatestvendor@example.com',
      storeName: 'QA Vendor Store',
      category: 'Groceries',
      categories: ['Groceries'],
      address: '123 Test Market',
      city: 'Indore',
      status: 'Pending',
      balance: 0,
    });

    assert(testSeller.status === 'Pending', 'Seller created with initial status: Pending');

    // 1.2 Generate Seller JWT token
    const sellerToken = generateToken(
      testSeller._id.toString(),
      'Seller'
    );

    const sellerHeaders = {
      Authorization: `Bearer ${sellerToken}`,
    };

    // 1.3 Profile endpoint should succeed (200 OK)
    try {
      const res = await axios.get(`${API_BASE}/auth/seller/profile`, { headers: sellerHeaders });
      assert(
        res.status === 200 && res.data.data.status === 'Pending',
        'Pending Seller can access profile endpoint (returns status: Pending)'
      );
    } catch (err: any) {
      assert(false, 'Pending Seller profile check failed', err.message);
    }

    // 1.4 Operational Seller APIs should return 403 with ACCOUNT_PENDING_APPROVAL
    const sellerOperationalEndpoints = [
      { name: 'Products List', url: `${API_BASE}/products`, method: 'get' },
      { name: 'Orders List', url: `${API_BASE}/orders`, method: 'get' },
      { name: 'Dashboard Stats', url: `${API_BASE}/seller/dashboard/stats`, method: 'get' },
      { name: 'Wallet Balance', url: `${API_BASE}/seller/wallet-new/balance`, method: 'get' },
    ];

    for (const ep of sellerOperationalEndpoints) {
      try {
        await axios({ method: ep.method, url: ep.url, headers: sellerHeaders });
        assert(false, `Pending Seller called ${ep.name} (Should have been blocked with 403)`);
      } catch (err: any) {
        const is403 = err.response?.status === 403;
        const code = err.response?.data?.code;
        assert(
          is403 && code === 'ACCOUNT_PENDING_APPROVAL',
          `Pending Seller blocked on ${ep.name} with HTTP 403 & code: ACCOUNT_PENDING_APPROVAL`
        );
      }
    }

    // 1.5 Admin approves seller
    await Seller.findByIdAndUpdate(testSeller._id, { status: 'Approved' });
    console.log('  👑 Admin approved seller in DB');

    // 1.6 Verify same session now has access (auto-unlock)
    try {
      const profileRes = await axios.get(`${API_BASE}/auth/seller/profile`, { headers: sellerHeaders });
      assert(
        profileRes.status === 200 && profileRes.data.data.status === 'Approved',
        'Live DB status revalidated as Approved using SAME session token'
      );

      const productsRes = await axios.get(`${API_BASE}/products`, { headers: sellerHeaders });
      assert(
        productsRes.status === 200,
        'Approved Seller can access /products operational endpoint without re-login'
      );

      const dashboardRes = await axios.get(`${API_BASE}/seller/dashboard/stats`, { headers: sellerHeaders });
      assert(
        dashboardRes.status === 200,
        'Approved Seller can access /seller/dashboard/stats operational endpoint'
      );
    } catch (err: any) {
      assert(false, 'Approved Seller operations failed', err.response?.data?.message || err.message);
    }

    // ==========================================
    // 2. DELIVERY PARTNER APPROVAL GATING TESTS
    // ==========================================
    console.log('\n--- [2] DELIVERY PARTNER APPROVAL GATING ---');

    // 2.1 Create inactive/pending delivery partner
    const testDelivery = await Delivery.create({
      name: 'QA Test Rider',
      mobile: TEST_DELIVERY_PHONE,
      email: 'qatestrider@example.com',
      password: 'hashedpassword123',
      address: '456 Rider Way',
      city: 'Indore',
      status: 'Inactive',
      available: 'Not Available',
    });

    assert(testDelivery.status === 'Inactive', 'Delivery partner created with initial status: Inactive');

    // 2.2 Generate Delivery JWT token
    const deliveryToken = generateToken(
      testDelivery._id.toString(),
      'Delivery'
    );

    const deliveryHeaders = {
      Authorization: `Bearer ${deliveryToken}`,
    };

    // 2.3 Profile endpoint should succeed (200 OK)
    try {
      const res = await axios.get(`${API_BASE}/auth/delivery/profile`, { headers: deliveryHeaders });
      assert(
        res.status === 200 && res.data.data.status === 'Inactive',
        'Inactive Delivery partner can access profile endpoint (returns status: Inactive)'
      );
    } catch (err: any) {
      assert(false, 'Inactive Delivery profile check failed', err.message);
    }

    // 2.4 Operational Delivery APIs should return 403 with ACCOUNT_PENDING_APPROVAL
    const deliveryOperationalEndpoints = [
      { name: 'Today Orders', url: `${API_BASE}/delivery/orders/today`, method: 'get' },
      { name: 'Dashboard Stats', url: `${API_BASE}/delivery/dashboard/stats`, method: 'get' },
      { name: 'Wallet Balance', url: `${API_BASE}/delivery/wallet/balance`, method: 'get' },
      { name: 'Update Status (Go Online)', url: `${API_BASE}/delivery/status`, method: 'put', data: { available: 'Available' } },
    ];

    for (const ep of deliveryOperationalEndpoints) {
      try {
        await axios({ method: ep.method, url: ep.url, headers: deliveryHeaders, data: ep.data });
        assert(false, `Inactive Delivery partner called ${ep.name} (Should have been blocked with 403)`);
      } catch (err: any) {
        const is403 = err.response?.status === 403;
        const code = err.response?.data?.code;
        assert(
          is403 && code === 'ACCOUNT_PENDING_APPROVAL',
          `Inactive Delivery partner blocked on ${ep.name} with HTTP 403 & code: ACCOUNT_PENDING_APPROVAL`
        );
      }
    }

    // 2.5 Admin activates delivery partner
    await Delivery.findByIdAndUpdate(testDelivery._id, { status: 'Active' });
    console.log('  👑 Admin activated delivery partner in DB');

    // 2.6 Verify same session now has access (auto-unlock)
    try {
      const profileRes = await axios.get(`${API_BASE}/auth/delivery/profile`, { headers: deliveryHeaders });
      assert(
        profileRes.status === 200 && profileRes.data.data.status === 'Active',
        'Live DB status revalidated as Active using SAME session token'
      );

      const ordersRes = await axios.get(`${API_BASE}/delivery/orders/today`, { headers: deliveryHeaders });
      assert(
        ordersRes.status === 200,
        'Active Delivery partner can access /delivery/orders/today operational endpoint without re-login'
      );

      const statsRes = await axios.get(`${API_BASE}/delivery/dashboard/stats`, { headers: deliveryHeaders });
      assert(
        statsRes.status === 200,
        'Active Delivery partner can access /delivery/dashboard/stats operational endpoint'
      );
    } catch (err: any) {
      assert(false, 'Active Delivery partner operations failed', err.response?.data?.message || err.message);
    }

    // ==========================================
    // 3. SECURITY BYPASS & REGRESSION TESTS
    // ==========================================
    console.log('\n--- [3] SECURITY BYPASS & REGRESSION CHECKS ---');

    // 3.1 Unauthenticated direct access blocked
    try {
      await axios.get(`${API_BASE}/products`);
      assert(false, 'Unauthenticated request to /products was not blocked');
    } catch (err: any) {
      assert(err.response?.status === 401, 'Unauthenticated request rejected with HTTP 401');
    }

    // 3.2 Wrong role access blocked (Delivery token calling Seller endpoint)
    try {
      await axios.get(`${API_BASE}/products`, { headers: deliveryHeaders });
      assert(false, 'Delivery partner calling Seller /products was not blocked');
    } catch (err: any) {
      assert(err.response?.status === 403, 'Cross-role unauthorized access rejected with HTTP 403');
    }

    // 3.3 Customer public routes unaffected
    try {
      const headerCatsRes = await axios.get(`${API_BASE}/header-categories`);
      assert(headerCatsRes.status === 200, 'Customer public API /header-categories remains fully accessible');
    } catch (err: any) {
      assert(false, 'Customer public API check failed', err.message);
    }

  } finally {
    // Cleanup test records
    await Seller.deleteMany({ mobile: TEST_SELLER_PHONE });
    await Delivery.deleteMany({ mobile: TEST_DELIVERY_PHONE });
    console.log('\n🧹 Cleaned up test database records');
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('====================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runApprovalGatingTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
