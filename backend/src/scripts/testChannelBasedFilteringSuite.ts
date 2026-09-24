import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Seller from '../models/Seller';
import Category from '../models/Category';
import Product from '../models/Product';
import { getCategories } from '../modules/seller/controllers/categoryController';
import { getProducts } from '../modules/seller/controllers/productController';
import { generateToken } from '../services/jwtService';

import dns from 'node:dns';
import connectDB from '../config/db';

dotenv.config({ path: path.join(__dirname, '../../.env') });

try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore if platform restrictions apply
}

// Mock express response
function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.data = payload;
      return this;
    },
    setHeader(key: string, val: string) {
      this.headers[key] = val;
      return this;
    },
  };
  return res;
}

// Invoke controller wrapped in promise
async function invokeController(fn: any, req: any): Promise<{ statusCode: number; data: any }> {
  const res = createMockRes();
  await new Promise<void>((resolve) => {
    const originalJson = res.json.bind(res);
    res.json = (payload: any) => {
      originalJson(payload);
      resolve();
      return res;
    };
    fn(req, res, (err: any) => {
      if (err) {
        res.statusCode = err.statusCode || 500;
        res.data = { success: false, message: err.message };
        resolve();
      } else {
        resolve();
      }
    });
  });
  return { statusCode: res.statusCode, data: res.data };
}

async function runChannelFilteringSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING SELLER CHANNEL-BASED FILTERING TEST SUITE');
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

  try {
    // -------------------------------------------------------------------------
    // Setup Isolated Fixtures
    // -------------------------------------------------------------------------
    console.log('Setting up isolated test categories and sellers...');

    // 1. Categories
    const qcOnlyCategory = await Category.findOneAndUpdate(
      { slug: 'test-qc-only-cat' },
      {
        name: 'Test QC Only Category',
        slug: 'test-qc-only-cat',
        status: 'Active',
        parentId: null,
        commerceChannels: ['QUICK_COMMERCE'],
      },
      { upsert: true, new: true }
    );

    const ecomOnlyCategory = await Category.findOneAndUpdate(
      { slug: 'test-ecom-only-cat' },
      {
        name: 'Test Ecom Only Category',
        slug: 'test-ecom-only-cat',
        status: 'Active',
        parentId: null,
        commerceChannels: ['ECOMMERCE'],
      },
      { upsert: true, new: true }
    );

    const bothCategory = await Category.findOneAndUpdate(
      { slug: 'test-both-cat' },
      {
        name: 'Test Both Channels Category',
        slug: 'test-both-cat',
        status: 'Active',
        parentId: null,
        commerceChannels: ['QUICK_COMMERCE', 'ECOMMERCE'],
      },
      { upsert: true, new: true }
    );

    // 2. Hybrid Seller
    const hybridSeller = await Seller.findOneAndUpdate(
      { email: 'hybrid_filter_test@example.com' },
      {
        sellerName: 'Hybrid Filter Test Seller',
        storeName: 'Hybrid Filter Test Store',
        email: 'hybrid_filter_test@example.com',
        mobile: '9888877771',
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

    // 3. QC Only Seller
    const qcSeller = await Seller.findOneAndUpdate(
      { email: 'qc_filter_test@example.com' },
      {
        sellerName: 'QC Filter Test Seller',
        storeName: 'QC Filter Test Store',
        email: 'qc_filter_test@example.com',
        mobile: '9888877772',
        vendorType: 'QUICK_COMMERCE',
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

    // 4. Products for Hybrid Seller
    const qcProduct = await Product.findOneAndUpdate(
      { productName: 'Test Hybrid QC Product' },
      {
        productName: 'Test Hybrid QC Product',
        seller: hybridSeller._id,
        category: qcOnlyCategory._id,
        productType: 'QUICK_COMMERCE',
        price: 150,
        stock: 50,
        publish: true,
        status: 'Active',
      },
      { upsert: true, new: true }
    );

    const ecomProduct = await Product.findOneAndUpdate(
      { productName: 'Test Hybrid Ecom Product' },
      {
        productName: 'Test Hybrid Ecom Product',
        seller: hybridSeller._id,
        category: ecomOnlyCategory._id,
        productType: 'ECOMMERCE',
        price: 499,
        stock: 30,
        publish: true,
        status: 'Active',
      },
      { upsert: true, new: true }
    );

    console.log('Fixtures initialized successfully.\n');

    // -------------------------------------------------------------------------
    // TEST 1: Seller = HYBRID, Channel = QUICK_COMMERCE -> Categories
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Seller = HYBRID, Channel = QUICK_COMMERCE -> /seller/category ---');
    {
      const req: any = {
        query: { channel: 'QUICK_COMMERCE' },
        headers: {},
        user: { userId: hybridSeller._id.toString(), userType: 'Seller' },
      };
      const res = await invokeController(getCategories, req);
      assert(res.statusCode === 200, 'getCategories returns 200 OK');
      assert(res.data?.success === true, 'Response indicates success: true');
      const cats: any[] = res.data?.data || [];
      const hasQcOnly = cats.some((c) => c._id.toString() === qcOnlyCategory._id.toString());
      const hasBoth = cats.some((c) => c._id.toString() === bothCategory._id.toString());
      const hasEcomOnly = cats.some((c) => c._id.toString() === ecomOnlyCategory._id.toString());
      assert(hasQcOnly, 'QC-only category IS present');
      assert(hasBoth, 'Both-channel category IS present');
      assert(!hasEcomOnly, 'E-commerce-only category is NOT present (strictly excluded)');
      const allQcValid = cats.every((c) => c.commerceChannels?.includes('QUICK_COMMERCE'));
      assert(allQcValid, 'Every category in response includes QUICK_COMMERCE in commerceChannels');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Seller = HYBRID, Channel = ECOMMERCE -> Categories
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Seller = HYBRID, Channel = ECOMMERCE -> /seller/category ---');
    {
      const req: any = {
        query: { channel: 'ECOMMERCE' },
        headers: {},
        user: { userId: hybridSeller._id.toString(), userType: 'Seller' },
      };
      const res = await invokeController(getCategories, req);
      assert(res.statusCode === 200, 'getCategories returns 200 OK');
      assert(res.data?.success === true, 'Response indicates success: true');
      const cats: any[] = res.data?.data || [];
      const hasQcOnly = cats.some((c) => c._id.toString() === qcOnlyCategory._id.toString());
      const hasBoth = cats.some((c) => c._id.toString() === bothCategory._id.toString());
      const hasEcomOnly = cats.some((c) => c._id.toString() === ecomOnlyCategory._id.toString());
      assert(hasEcomOnly, 'Ecom-only category IS present');
      assert(hasBoth, 'Both-channel category IS present');
      assert(!hasQcOnly, 'Quick-Commerce-only category is NOT present (strictly excluded)');
      const allEcomValid = cats.every((c) => c.commerceChannels?.includes('ECOMMERCE'));
      assert(allEcomValid, 'Every category in response includes ECOMMERCE in commerceChannels');
    }

    // -------------------------------------------------------------------------
    // TEST 3: Seller = HYBRID, Channel = QUICK_COMMERCE -> Products
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Seller = HYBRID, Channel = QUICK_COMMERCE -> /seller/product/list ---');
    {
      const req: any = {
        query: { channel: 'QUICK_COMMERCE' },
        headers: {},
        user: { userId: hybridSeller._id.toString(), userType: 'Seller' },
      };
      const res = await invokeController(getProducts, req);
      assert(res.statusCode === 200, 'getProducts returns 200 OK');
      assert(res.data?.success === true, 'Response indicates success: true');
      const prods: any[] = res.data?.data || [];
      const hasQcProd = prods.some((p) => p._id.toString() === qcProduct._id.toString());
      const hasEcomProd = prods.some((p) => p._id.toString() === ecomProduct._id.toString());
      assert(hasQcProd, 'QUICK_COMMERCE product IS present');
      assert(!hasEcomProd, 'ECOMMERCE product is NOT present (strictly excluded)');
      const allQcProds = prods.every((p) => p.productType === 'QUICK_COMMERCE');
      assert(allQcProds, 'Every product returned has productType: QUICK_COMMERCE');
    }

    // -------------------------------------------------------------------------
    // TEST 4: Seller = HYBRID, Channel = ECOMMERCE -> Products
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Seller = HYBRID, Channel = ECOMMERCE -> /seller/product/list ---');
    {
      const req: any = {
        query: { channel: 'ECOMMERCE' },
        headers: {},
        user: { userId: hybridSeller._id.toString(), userType: 'Seller' },
      };
      const res = await invokeController(getProducts, req);
      assert(res.statusCode === 200, 'getProducts returns 200 OK');
      assert(res.data?.success === true, 'Response indicates success: true');
      const prods: any[] = res.data?.data || [];
      const hasQcProd = prods.some((p) => p._id.toString() === qcProduct._id.toString());
      const hasEcomProd = prods.some((p) => p._id.toString() === ecomProduct._id.toString());
      assert(hasEcomProd, 'ECOMMERCE product IS present');
      assert(!hasQcProd, 'QUICK_COMMERCE product is NOT present (strictly excluded)');
      const allEcomProds = prods.every((p) => p.productType === 'ECOMMERCE');
      assert(allEcomProds, 'Every product returned has productType: ECOMMERCE');
    }

    // -------------------------------------------------------------------------
    // TEST 5 & 6: Switching Channel (QC -> Ecom -> QC) - Freshness & Zero Stale Results
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5 & 6: Switching Channel (QC -> Ecom -> QC) Verification ---');
    {
      // First QC request
      const reqQc1: any = {
        query: { channel: 'QUICK_COMMERCE' },
        headers: {},
        user: { userId: hybridSeller._id.toString(), userType: 'Seller' },
      };
      const resQc1 = await invokeController(getCategories, reqQc1);
      const qcCats1 = resQc1.data?.data || [];

      // Switch to ECOM
      const reqEcom: any = {
        query: { channel: 'ECOMMERCE' },
        headers: {},
        user: { userId: hybridSeller._id.toString(), userType: 'Seller' },
      };
      const resEcom = await invokeController(getCategories, reqEcom);
      const ecomCats = resEcom.data?.data || [];
      assert(!ecomCats.some((c: any) => c.slug === 'test-qc-only-cat'), 'Ecom result has no QC-only categories');
      assert(ecomCats.some((c: any) => c.slug === 'test-ecom-only-cat'), 'Ecom result has Ecom-only category');

      // Switch back to QC
      const reqQc2: any = {
        query: { channel: 'QUICK_COMMERCE' },
        headers: {},
        user: { userId: hybridSeller._id.toString(), userType: 'Seller' },
      };
      const resQc2 = await invokeController(getCategories, reqQc2);
      const qcCats2 = resQc2.data?.data || [];
      assert(!qcCats2.some((c: any) => c.slug === 'test-ecom-only-cat'), 'Switched-back QC result has no Ecom-only categories');
      assert(qcCats2.some((c: any) => c.slug === 'test-qc-only-cat'), 'Switched-back QC result has QC-only category');
      assert(qcCats1.length === qcCats2.length, 'Exact same count returned when returning to QC channel');
    }

    // -------------------------------------------------------------------------
    // TEST 7: Direct API request with channel query
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Direct Unauthenticated API Request with Selected Channel ---');
    {
      const reqQc: any = {
        query: { channel: 'QUICK_COMMERCE' },
        headers: {},
      };
      const resQc = await invokeController(getCategories, reqQc);
      const qcCats: any[] = resQc.data?.data || [];
      const qcValid = qcCats.every((c) => c.commerceChannels?.includes('QUICK_COMMERCE'));
      assert(qcValid, 'Direct API with ?channel=QUICK_COMMERCE returns only QC-valid categories');

      const reqEcom: any = {
        query: { channel: 'ECOMMERCE' },
        headers: {},
      };
      const resEcom = await invokeController(getCategories, reqEcom);
      const ecomCats: any[] = resEcom.data?.data || [];
      const ecomValid = ecomCats.every((c) => c.commerceChannels?.includes('ECOMMERCE'));
      assert(ecomValid, 'Direct API with ?channel=ECOMMERCE returns only E-commerce-valid categories');
    }

    // -------------------------------------------------------------------------
    // TEST 8: Unauthorized Channel Access Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Unauthorized Channel Access Rejection ---');
    {
      // QC-only seller requesting ECOMMERCE categories
      const reqQcToEcomCat: any = {
        query: { channel: 'ECOMMERCE' },
        headers: {},
        user: { userId: qcSeller._id.toString(), userType: 'Seller' },
      };
      const resQcToEcomCat = await invokeController(getCategories, reqQcToEcomCat);
      assert(resQcToEcomCat.statusCode === 403, 'QC-only seller requesting ECOMMERCE category list rejected with 403 (got 403)');

      // QC-only seller requesting ECOMMERCE products
      const reqQcToEcomProd: any = {
        query: { channel: 'ECOMMERCE' },
        headers: {},
        user: { userId: qcSeller._id.toString(), userType: 'Seller' },
      };
      const resQcToEcomProd = await invokeController(getProducts, reqQcToEcomProd);
      assert(resQcToEcomProd.statusCode === 403, 'QC-only seller requesting ECOMMERCE product list rejected with 403 (got 403)');
    }

    // -------------------------------------------------------------------------
    // TEST 9: Search/Filter/Pagination strictly within selected channel
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Search/Filter/Pagination within selected channel ---');
    {
      // Search for "Test Hybrid" on QC channel
      const reqSearchQc: any = {
        query: { channel: 'QUICK_COMMERCE', search: 'Test Hybrid' },
        headers: {},
        user: { userId: hybridSeller._id.toString(), userType: 'Seller' },
      };
      const resSearchQc = await invokeController(getProducts, reqSearchQc);
      const searchProds: any[] = resSearchQc.data?.data || [];
      assert(searchProds.some((p) => p._id.toString() === qcProduct._id.toString()), 'Search on QC returns QC match');
      assert(!searchProds.some((p) => p._id.toString() === ecomProduct._id.toString()), 'Search on QC does NOT return Ecom product with same search string');

      // Search for "Test Hybrid" on ECOM channel
      const reqSearchEcom: any = {
        query: { channel: 'ECOMMERCE', search: 'Test Hybrid' },
        headers: {},
        user: { userId: hybridSeller._id.toString(), userType: 'Seller' },
      };
      const resSearchEcom = await invokeController(getProducts, reqSearchEcom);
      const searchEcomProds: any[] = resSearchEcom.data?.data || [];
      assert(searchEcomProds.some((p) => p._id.toString() === ecomProduct._id.toString()), 'Search on ECOM returns ECOM match');
      assert(!searchEcomProds.some((p) => p._id.toString() === qcProduct._id.toString()), 'Search on ECOM does NOT return QC product with same search string');
    }

    // -------------------------------------------------------------------------
    // TEST 10: Vendor Isolation & Ownership Check
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Seller Ownership / Vendor Isolation ---');
    {
      // QC Seller requesting their own products on QC
      const reqQcOwn: any = {
        query: { channel: 'QUICK_COMMERCE' },
        headers: {},
        user: { userId: qcSeller._id.toString(), userType: 'Seller' },
      };
      const resQcOwn = await invokeController(getProducts, reqQcOwn);
      const ownProds: any[] = resQcOwn.data?.data || [];
      // Must not contain products of hybrid seller
      const containsHybrid = ownProds.some((p) => p.seller?.toString() === hybridSeller._id.toString());
      assert(!containsHybrid, 'QC Seller cannot see products of Hybrid Seller (Strict Ownership Enforced)');
    }

  } finally {
    // Teardown test fixtures
    console.log('\n--- Cleaning up test fixtures ---');
    await Category.deleteMany({ slug: { $in: ['test-qc-only-cat', 'test-ecom-only-cat', 'test-both-cat'] } });
    await Product.deleteMany({ productName: { $in: ['Test Hybrid QC Product', 'Test Hybrid Ecom Product'] } });
    await Seller.deleteMany({ email: { $in: ['hybrid_filter_test@example.com', 'qc_filter_test@example.com'] } });
    console.log('Test fixtures cleaned up.');
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed} ✅`);
  console.log(`FAILED: ${failed} ❌`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runChannelFilteringSuite().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
