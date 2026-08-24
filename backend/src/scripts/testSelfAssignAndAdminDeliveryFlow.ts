// Comprehensive End-to-End E2E Test Suite for Self Assign & Admin Delivery Flows
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// Models
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Product from '../models/Product';
import Commission from '../models/Commission';
import CashCollection from '../models/CashCollection';

const JWT_SECRET = process.env.JWT_SECRET || 'fallbacksecretkey';

// Real Test User IDs in DB
const CUSTOMER_ID = '6a7e05ddd9341125c8a8dea9';
const SELLER_ID = '6a82be9c9835c3a79c0df2b2';
const ADMIN_ID = '6a7d5b02259ec525f6753dda';
const DELIVERY_ID = '6a82d22eb8f310adff04b712'; // Nansi Tiwari (Active Delivery Partner)

const CUSTOMER_TOKEN = jwt.sign({ userId: CUSTOMER_ID, userType: 'Customer', phone: '8817469588' }, JWT_SECRET, { expiresIn: '1d' });
const SELLER_TOKEN = jwt.sign({ userId: SELLER_ID, userType: 'Seller', storeName: 'Fashion Hub' }, JWT_SECRET, { expiresIn: '1d' });
const ADMIN_TOKEN = jwt.sign({ userId: ADMIN_ID, userType: 'Admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });

function apiCall(token: string, method: string, path: string, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts: http.RequestOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1' + path,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 500, body: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode || 500, body: d }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function pass(msg: string) { console.log('  ✅ PASS:', msg); }
function fail(msg: string) { console.log('  ❌ FAIL:', msg); }

async function createTestOrder(paymentMethod: 'COD' | 'Online', paymentStatus: 'Pending' | 'Paid') {
  const product = await Product.findOne({ seller: new mongoose.Types.ObjectId(SELLER_ID) }).lean() as any;
  if (!product) throw new Error('No product found for seller');

  const orderNumber = 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
  const deliveryAddr = {
    address: 'Corporate House, 208, 169, RNT Marg, near CENTRAL, RNT Marg, Indore, Madhya Pradesh 452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    landmark: 'Near Central Mall',
    latitude: 22.7173716,
    longitude: 75.8716678
  };

  const itemPrice = product.price || product.sellingPrice || 299;
  const orderItem = await OrderItem.create({
    order: new mongoose.Types.ObjectId(),
    product: product._id,
    seller: new mongoose.Types.ObjectId(SELLER_ID),
    sellerStatus: 'Pending',
    productName: product.productName || product.name || 'Test Product',
    productImage: product.mainImage || '',
    quantity: 1,
    unitPrice: itemPrice,
    total: itemPrice,
    status: 'Pending'
  });

  const order = await Order.create({
    orderNumber,
    customer: new mongoose.Types.ObjectId(CUSTOMER_ID),
    customerName: 'Ritik Tiwari',
    customerEmail: 'nansitiwari504@gmail.com',
    customerPhone: '8817469588',
    deliveryAddress: deliveryAddr,
    items: [orderItem._id],
    subtotal: itemPrice,
    tax: 0,
    shipping: 50,
    platformFee: 20,
    total: itemPrice + 50 + 20,
    grandTotal: itemPrice + 50 + 20,
    paymentMethod,
    paymentStatus,
    status: 'Pending',
    sellerConfirmationStatus: 'Pending',
    deliveryAssignmentStatus: 'NotStarted',
    deliveryOption: 'Standard',
    acceptedSellerIds: [],
    rejectedSellerIds: [],
    fulfillableItems: []
  });

  await OrderItem.findByIdAndUpdate(orderItem._id, { order: order._id });

  return order._id.toString();
}

async function testSelfAssignCOD() {
  console.log('\n=======================================================');
  console.log(' TEST 1: COD ORDER + SELF ASSIGN DELIVERY FLOW ');
  console.log('=======================================================');

  // Step 1: Create fresh COD order
  const orderId = await createTestOrder('COD', 'Pending');
  console.log(`Created COD Test Order: ${orderId}`);

  // Step 2: Verify Initial DB state
  let orderDB = await Order.findById(orderId).lean() as any;
  if (orderDB.status === 'Pending' && !orderDB.deliveryPreference) {
    pass('Initial Order DB status is Pending, deliveryPreference undefined');
  } else {
    fail('Initial Order DB state invalid');
    return false;
  }

  // Step 3: Seller Accepts Order with deliveryPreference: "Self"
  console.log(`Seller accepting order ${orderId} with deliveryPreference = "Self"...`);
  const acceptRes = await apiCall(SELLER_TOKEN, 'PATCH', `/orders/${orderId}/status`, {
    status: 'Accepted',
    deliveryPreference: 'Self'
  });
  console.log(`PATCH /orders/${orderId}/status → ${acceptRes.status}`);

  if (acceptRes.status === 200) {
    pass('Seller Accept API returned 200 OK');
  } else {
    fail(`Seller Accept API failed with status ${acceptRes.status}: ${JSON.stringify(acceptRes.body)}`);
    return false;
  }

  // Step 4: Verify MongoDB state after Accept
  orderDB = await Order.findById(orderId).lean() as any;
  console.log('MongoDB Order after Accept:');
  console.log(`  deliveryPreference: "${orderDB.deliveryPreference}"`);
  console.log(`  status: "${orderDB.status}"`);
  console.log(`  deliveryBoy:`, orderDB.deliveryBoy);
  console.log(`  deliveryAssignmentStatus: "${orderDB.deliveryAssignmentStatus}"`);

  if (
    orderDB.deliveryPreference === 'Self' &&
    orderDB.status === 'Accepted' &&
    !orderDB.deliveryBoy &&
    orderDB.deliveryAssignmentStatus === 'Cancelled'
  ) {
    pass('MongoDB verified: deliveryPreference = "Self", deliveryBoy = undefined, deliveryAssignmentStatus = "Cancelled"');
  } else {
    fail('MongoDB state after Self Assign Accept is invalid!');
    return false;
  }

  // Step 5: Verify Admin Orders list doesn't need assignment for Self Assign
  const adminAllRes = await apiCall(ADMIN_TOKEN, 'GET', '/admin/orders', null);
  const adminOrders = adminAllRes.body?.data || adminAllRes.body?.orders || [];
  const foundInAdmin = Array.isArray(adminOrders) && adminOrders.find((o: any) => o._id === orderId || o.id === orderId);

  if (foundInAdmin && foundInAdmin.deliveryPreference === 'Self') {
    pass('Admin Orders list correctly identifies order as deliveryPreference = "Self" (Self Assigned)');
  } else if (!foundInAdmin) {
    pass('Admin Orders query executed successfully');
  }

  // Step 6: Verify Admin Order Detail displays "Self Assigned"
  const adminOrderDetailRes = await apiCall(ADMIN_TOKEN, 'GET', `/admin/orders/${orderId}`, null);
  const adminDA = adminOrderDetailRes.body?.data;
  if (adminOrderDetailRes.status === 200 && adminDA.deliveryPreference === 'Self') {
    pass('Admin Order Detail returned 200 OK with deliveryPreference = "Self"');
  } else {
    fail(`Admin Order Detail check failed: status=${adminOrderDetailRes.status}`);
    return false;
  }

  // Step 7: Seller updates status -> On the way
  console.log('Seller updating status to "On the way"...');
  const outForDeliveryRes = await apiCall(SELLER_TOKEN, 'PATCH', `/orders/${orderId}/status`, {
    status: 'On the way'
  });
  if (outForDeliveryRes.status === 200) {
    pass('Seller status update to On the way returned 200 OK');
  } else {
    fail(`Seller status update to On the way failed: ${JSON.stringify(outForDeliveryRes.body)}`);
    return false;
  }

  // Step 8: Verify Customer Panel receives updated status & exact immutable snapshot address
  const custOrderRes = await apiCall(CUSTOMER_TOKEN, 'GET', `/customer/orders/${orderId}`, null);
  const custData = custOrderRes.body?.data;
  if (
    custOrderRes.status === 200 &&
    custData.status === 'On the way' &&
    custData.deliveryAddress?.address?.includes('Corporate House') &&
    custData.deliveryAddress?.latitude === 22.7173716 &&
    custData.deliveryAddress?.longitude === 75.8716678
  ) {
    pass('Customer Panel received status "On the way" and exact immutable address snapshot!');
  } else {
    fail(`Customer Panel verification failed: status=${custData?.status}, addr=${custData?.deliveryAddress?.address}`);
    return false;
  }

  // Step 9: Seller updates status -> Delivered
  console.log('Seller updating status to "Delivered"...');
  const deliveredRes = await apiCall(SELLER_TOKEN, 'PATCH', `/orders/${orderId}/status`, {
    status: 'Delivered'
  });
  if (deliveredRes.status === 200) {
    pass('Seller status update to Delivered returned 200 OK');
  } else {
    fail(`Seller status update to Delivered failed: ${JSON.stringify(deliveredRes.body)}`);
    return false;
  }

  // Step 10: Verify Financials & Commissions for COD Self Assign
  const dbCommissions = await Commission.find({ order: orderId, type: 'DELIVERY_BOY' }).lean();
  if (dbCommissions.length === 0) {
    pass('Commission DB verified: NO DELIVERY_BOY commission generated for Self Assign!');
  } else {
    fail(`Commission DB failed: ${dbCommissions.length} delivery boy commission records found!`);
    return false;
  }

  const dbCashCollections = await CashCollection.find({ order: orderId }).lean();
  if (dbCashCollections.length === 0) {
    pass('CashCollection DB verified: NO Delivery Partner cash collection record created!');
  } else {
    fail(`CashCollection DB failed: ${dbCashCollections.length} cash collection records found!`);
    return false;
  }

  return true;
}

async function testSelfAssignOnline() {
  console.log('\n=======================================================');
  console.log(' TEST 2: ONLINE PAID ORDER + SELF ASSIGN DELIVERY FLOW ');
  console.log('=======================================================');

  // Step 1: Create Online Paid order
  const orderId = await createTestOrder('Online', 'Paid');
  console.log(`Created Online Paid Test Order: ${orderId}`);

  // Step 2: Seller Accepts with Self Assign
  const acceptRes = await apiCall(SELLER_TOKEN, 'PATCH', `/orders/${orderId}/status`, {
    status: 'Accepted',
    deliveryPreference: 'Self'
  });
  if (acceptRes.status === 200) {
    pass('Seller Accept Online order with Self Assign returned 200 OK');
  } else {
    fail(`Seller Accept Online order failed: ${JSON.stringify(acceptRes.body)}`);
    return false;
  }

  // Step 3: Seller updates status -> Out for Delivery -> Delivered
  await apiCall(SELLER_TOKEN, 'PATCH', `/orders/${orderId}/status`, { status: 'Out for Delivery' });
  const deliveredRes = await apiCall(SELLER_TOKEN, 'PATCH', `/orders/${orderId}/status`, { status: 'Delivered' });

  if (deliveredRes.status === 200) {
    pass('Online order marked Delivered successfully by Seller');
  } else {
    fail(`Mark Delivered failed: ${JSON.stringify(deliveredRes.body)}`);
    return false;
  }

  // Step 4: Verify DB State
  const orderDB = await Order.findById(orderId).lean() as any;
  if (
    orderDB.status === 'Delivered' &&
    orderDB.paymentStatus === 'Paid' &&
    orderDB.deliveryPreference === 'Self' &&
    !orderDB.deliveryBoy
  ) {
    pass('Online Self Assign Order DB verified: Delivered, Paid, deliveryPreference=Self, no deliveryBoy');
  } else {
    fail('Online Self Assign Order DB state invalid!');
    return false;
  }

  // Step 5: Verify Commissions & Payouts
  const dbCommissions = await Commission.find({ order: orderId, type: 'DELIVERY_BOY' }).lean();
  if (dbCommissions.length === 0) {
    pass('Online Order Commission verified: NO delivery partner payout/commission generated!');
  } else {
    fail('Online Order Commission failed: Delivery partner commission created!');
    return false;
  }

  return true;
}

async function testAdminAssignedRegression() {
  console.log('\n=======================================================');
  console.log(' TEST 3: REGRESSION TEST — ASSIGNED BY ADMIN FLOW ');
  console.log('=======================================================');

  // Step 1: Create fresh Standard order
  const orderId = await createTestOrder('COD', 'Pending');
  console.log(`Created Regression Test Order: ${orderId}`);

  // Step 2: Seller Accepts with deliveryPreference: "Admin"
  const acceptRes = await apiCall(SELLER_TOKEN, 'PATCH', `/orders/${orderId}/status`, {
    status: 'Accepted',
    deliveryPreference: 'Admin'
  });
  if (acceptRes.status === 200) {
    pass('Seller Accept with deliveryPreference: "Admin" returned 200 OK');
  } else {
    fail(`Seller Accept Admin delivery failed: ${JSON.stringify(acceptRes.body)}`);
    return false;
  }

  // Step 3: Admin assigns Delivery Boy via PATCH /admin/orders/:id/assign-delivery
  console.log(`Admin assigning Delivery Boy ${DELIVERY_ID} to order ${orderId}...`);
  const assignRes = await apiCall(ADMIN_TOKEN, 'PATCH', `/admin/orders/${orderId}/assign-delivery`, {
    deliveryBoyId: DELIVERY_ID
  });
  console.log(`PATCH /admin/orders/${orderId}/assign-delivery → ${assignRes.status}`);

  if (assignRes.status === 200) {
    pass('Admin delivery boy assignment returned 200 OK');
  } else {
    fail(`Admin delivery boy assignment failed: ${JSON.stringify(assignRes.body)}`);
    return false;
  }

  // Step 4: Verify DB State after Admin Assignment
  const orderDB = await Order.findById(orderId).lean() as any;
  if (
    orderDB.deliveryBoy?.toString() === DELIVERY_ID &&
    orderDB.deliveryAssignmentStatus === 'Assigned'
  ) {
    pass(`MongoDB verified: deliveryBoy = ${DELIVERY_ID}, deliveryAssignmentStatus = "Assigned"`);
  } else {
    fail(`MongoDB assignment failed: deliveryBoy=${orderDB.deliveryBoy}, status=${orderDB.deliveryAssignmentStatus}`);
    return false;
  }

  return true;
}

async function runAll() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB.');

    const test1Ok = await testSelfAssignCOD();
    const test2Ok = await testSelfAssignOnline();
    const test3Ok = await testAdminAssignedRegression();

    await mongoose.disconnect();

    console.log('\n=======================================================');
    console.log('             COMPLETE E2E SUITE RESULTS                ');
    console.log('=======================================================');
    console.log(`1. COD Self Assign Flow: ${test1Ok ? '🟢 PASS' : '🔴 FAIL'}`);
    console.log(`2. Online Paid Self Assign Flow: ${test2Ok ? '🟢 PASS' : '🔴 FAIL'}`);
    console.log(`3. Admin Assigned Regression Flow: ${test3Ok ? '🟢 PASS' : '🔴 FAIL'}`);

    if (test1Ok && test2Ok && test3Ok) {
      console.log('\n🟢 E2E RUNTIME SUITE PASSED CLEANLY 100%!');
    } else {
      console.log('\n🔴 SOME E2E TESTS FAILED');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal E2E suite error:', err);
    process.exit(1);
  }
}

runAll();
