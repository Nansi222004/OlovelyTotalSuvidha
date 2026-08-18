/// <reference path="../types.d.ts" />
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Customer from '../models/Customer';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import Order from '../models/Order';
import Category from '../models/Category';
import Product from '../models/Product';
import { generateDeliveryOtp, verifyDeliveryOtp } from '../services/deliveryOtpService';
import { generateToken } from '../services/jwtService';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runDeliveryOtpTestSuite() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB for Delivery OTP Test Suite');

  const testResults: Array<{ id: string; test: string; status: 'PASS' | 'FAIL'; evidence: string }> = [];

  // Setup test entities
  const testCustomer = await Customer.create({
    name: 'OTP Test Customer',
    phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `otpcustomer_${Date.now()}@test.com`,
    status: 'Active',
    deliveryOtp: '7777',
  });

  const testSeller = await Seller.create({
    sellerName: 'OTP Test Seller',
    mobile: `8${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `otpseller_${Date.now()}@test.com`,
    storeName: 'OTP Test Store',
    category: 'Grocery',
    status: 'Approved',
  });

  const testDriverA = await Delivery.create({
    name: 'OTP Driver A (Authorized)',
    mobile: `7${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `otpdriverA_${Date.now()}@test.com`,
    password: 'Password123!',
    status: 'Active',
    isOnline: true,
  });

  const testDriverB = await Delivery.create({
    name: 'OTP Driver B (Unauthorized)',
    mobile: `7${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `otpdriverB_${Date.now()}@test.com`,
    password: 'Password123!',
    status: 'Active',
    isOnline: true,
  });

  const testOrder = await Order.create({
    orderNumber: `ORDTEST${Date.now()}`,
    orderDate: new Date(),
    customer: testCustomer._id,
    customerName: testCustomer.name,
    customerEmail: testCustomer.email,
    customerPhone: testCustomer.phone,
    deliveryAddress: {
      address: '123 Test St',
      city: 'Indore',
      pincode: '452001',
      latitude: 22.7196,
      longitude: 75.8577,
    },
    items: [],
    subtotal: 500,
    total: 500,
    paymentMethod: 'COD',
    status: 'Out for Delivery',
    deliveryBoy: testDriverA._id,
    deliveryOption: 'Standard',
    tipAmount: 0,
    giftPackaging: false,
  });

  console.log(`✓ Test Order Created: ${testOrder.orderNumber}`);

  // Set test mode active explicitly for tests 1-7
  process.env.NODE_ENV = 'development';
  process.env.DELIVERY_TEST_MODE = 'true';

  // -------------------------------------------------------------
  // TEST 1: DELIVERY_TEST_MODE=true -> Get OTP without GPS
  // -------------------------------------------------------------
  try {
    const res = await generateDeliveryOtp(testOrder._id.toString());
    const refreshed = await Order.findById(testOrder._id);
    if (res.success && refreshed?.deliveryOtp === '9999') {
      testResults.push({
        id: 'TEST 1',
        test: 'DELIVERY_TEST_MODE=true Get OTP without GPS',
        status: 'PASS',
        evidence: `OTP generated successfully: ${refreshed.deliveryOtp} (Test Mode Active)`,
      });
    } else {
      throw new Error(`Expected OTP 9999, got ${refreshed?.deliveryOtp}`);
    }
  } catch (err: any) {
    testResults.push({
      id: 'TEST 1',
      test: 'DELIVERY_TEST_MODE=true Get OTP without GPS',
      status: 'FAIL',
      evidence: err.message,
    });
  }

  // -------------------------------------------------------------
  // TEST 3: Enter 1234 -> Expected: Invalid OTP
  // -------------------------------------------------------------
  try {
    await verifyDeliveryOtp(testOrder._id.toString(), '1234');
    testResults.push({
      id: 'TEST 3',
      test: 'Enter Wrong OTP (1234)',
      status: 'FAIL',
      evidence: 'Expected verification to fail but it succeeded',
    });
  } catch (err: any) {
    if (err.message.includes('Invalid OTP')) {
      testResults.push({
        id: 'TEST 3',
        test: 'Enter Wrong OTP (1234)',
        status: 'PASS',
        evidence: `Correctly rejected: "${err.message}"`,
      });
    } else {
      testResults.push({
        id: 'TEST 3',
        test: 'Enter Wrong OTP (1234)',
        status: 'FAIL',
        evidence: `Unexpected error: ${err.message}`,
      });
    }
  }

  // -------------------------------------------------------------
  // TEST 4: Enter wrong OTP 5 times -> Expected: OTP locked
  // -------------------------------------------------------------
  try {
    // We already entered 1 wrong attempt in TEST 3. Enter 4 more failed attempts.
    for (let i = 0; i < 4; i++) {
      try {
        await verifyDeliveryOtp(testOrder._id.toString(), '0000');
      } catch (e) {}
    }
    // Now 5th attempt should be blocked
    await verifyDeliveryOtp(testOrder._id.toString(), '9999');
    testResults.push({
      id: 'TEST 4',
      test: 'Enter wrong OTP 5 times (Lockout)',
      status: 'FAIL',
      evidence: 'Expected lockout error after 5 failed attempts but OTP was accepted',
    });
  } catch (err: any) {
    if (err.message.includes('Too many incorrect OTP attempts')) {
      testResults.push({
        id: 'TEST 4',
        test: 'Enter wrong OTP 5 times (Lockout)',
        status: 'PASS',
        evidence: `Correctly locked out: "${err.message}"`,
      });
    } else {
      testResults.push({
        id: 'TEST 4',
        test: 'Enter wrong OTP 5 times (Lockout)',
        status: 'FAIL',
        evidence: `Unexpected lockout error message: ${err.message}`,
      });
    }
  }

  // Resend OTP to reset attempt counter for subsequent tests
  await generateDeliveryOtp(testOrder._id.toString());

  // -------------------------------------------------------------
  // TEST 5: Wait / Force Expiry -> Expected: OTP Expired
  // -------------------------------------------------------------
  try {
    const orderToExpire = await Order.findById(testOrder._id);
    if (orderToExpire) {
      orderToExpire.deliveryOtpExpiresAt = new Date(Date.now() - 1000); // 1 sec in past
      await orderToExpire.save();
    }
    await verifyDeliveryOtp(testOrder._id.toString(), '9999');
    testResults.push({
      id: 'TEST 5',
      test: 'Force Expiry Validation',
      status: 'FAIL',
      evidence: 'Expected expired OTP error but verification succeeded',
    });
  } catch (err: any) {
    if (err.message.includes('OTP has expired')) {
      testResults.push({
        id: 'TEST 5',
        test: 'Force Expiry Validation',
        status: 'PASS',
        evidence: `Correctly rejected expired OTP: "${err.message}"`,
      });
    } else {
      testResults.push({
        id: 'TEST 5',
        test: 'Force Expiry Validation',
        status: 'FAIL',
        evidence: `Unexpected expiry error: ${err.message}`,
      });
    }
  }

  // Regenerate valid non-expired OTP for remaining tests
  await generateDeliveryOtp(testOrder._id.toString());

  // -------------------------------------------------------------
  // TEST 6: Unauthorized Delivery Partner -> Expected: 403
  // -------------------------------------------------------------
  try {
    const { verifyDeliveryOtpController } = await import('../modules/delivery/controllers/deliveryOrderController');
    
    const testOrderUnauth = await Order.create({
      orderNumber: `ORDUNAUTH${Date.now()}`,
      orderDate: new Date(),
      customer: testCustomer._id,
      customerName: testCustomer.name,
      customerEmail: testCustomer.email,
      customerPhone: testCustomer.phone,
      deliveryAddress: {
        address: '123 Test St',
        city: 'Indore',
        pincode: '452001',
      },
      items: [],
      subtotal: 500,
      total: 500,
      paymentMethod: 'COD',
      status: 'Out for Delivery',
      deliveryBoy: testDriverA._id,
      deliveryOption: 'Standard',
      tipAmount: 0,
      giftPackaging: false,
    });

    let httpStatusCode = 0;
    let httpResponseBody: any = null;

    const fakeReq = {
      params: { id: testOrderUnauth._id.toString() },
      body: { otp: '9999' },
      user: { userId: testDriverB._id.toString(), userType: 'Delivery' },
      app: { get: () => null },
    } as any;

    const fakeRes: any = {
      status: (code: number) => {
        httpStatusCode = code;
        return fakeRes;
      },
      json: (data: any) => {
        httpResponseBody = data;
        return fakeRes;
      },
    };

    await verifyDeliveryOtpController(fakeReq, fakeRes, (err: any) => { if (err) console.error('TEST 6 ERR:', err); });
    await new Promise((r) => setTimeout(r, 200));

    await Order.deleteOne({ _id: testOrderUnauth._id });

    if (httpStatusCode === 403) {
      testResults.push({
        id: 'TEST 6',
        test: 'Unauthorized Rider (Driver B vs Order Assigned to Driver A)',
        status: 'PASS',
        evidence: `HTTP ${httpStatusCode} - "${httpResponseBody?.message}"`,
      });
    } else {
      testResults.push({
        id: 'TEST 6',
        test: 'Unauthorized Rider',
        status: 'FAIL',
        evidence: `Expected 403 Forbidden, got ${httpStatusCode}`,
      });
    }
  } catch (err: any) {
    testResults.push({
      id: 'TEST 6',
      test: 'Unauthorized Rider',
      status: 'FAIL',
      evidence: err.message,
    });
  }

  // -------------------------------------------------------------
  // TEST 2: Enter 9999 -> Expected: Delivered
  // -------------------------------------------------------------
  try {
    const res = await verifyDeliveryOtp(testOrder._id.toString(), '9999');
    const refreshed = await Order.findById(testOrder._id);
    if (res.success && refreshed?.status === 'Delivered') {
      testResults.push({
        id: 'TEST 2',
        test: 'Enter Correct OTP (9999)',
        status: 'PASS',
        evidence: `Order status updated to Delivered at ${refreshed.deliveredAt}`,
      });
    } else {
      throw new Error(`Expected Delivered, got ${refreshed?.status}`);
    }
  } catch (err: any) {
    testResults.push({
      id: 'TEST 2',
      test: 'Enter Correct OTP (9999)',
      status: 'FAIL',
      evidence: err.message,
    });
  }

  // -------------------------------------------------------------
  // TEST 7: Try OTP after order is Delivered -> Expected: Rejected
  // -------------------------------------------------------------
  try {
    await verifyDeliveryOtp(testOrder._id.toString(), '9999');
    testResults.push({
      id: 'TEST 7',
      test: 'Try OTP after order is Delivered',
      status: 'FAIL',
      evidence: 'Expected re-use rejection but OTP was accepted',
    });
  } catch (err: any) {
    if (err.message.includes('Order is already delivered')) {
      testResults.push({
        id: 'TEST 7',
        test: 'Try OTP after order is Delivered',
        status: 'PASS',
        evidence: `Correctly rejected re-used OTP: "${err.message}"`,
      });
    } else {
      testResults.push({
        id: 'TEST 7',
        test: 'Try OTP after order is Delivered',
        status: 'FAIL',
        evidence: `Unexpected error: ${err.message}`,
      });
    }
  }

  // -------------------------------------------------------------
  // TEST 8: DELIVERY_TEST_MODE=false -> Verify normal GPS distance enforced
  // -------------------------------------------------------------
  try {
    process.env.DELIVERY_TEST_MODE = 'false';
    const { sendDeliveryOtp } = await import('../modules/delivery/controllers/deliveryOrderController');
    
    // Create new active order for Test 8
    const testOrderGps = await Order.create({
      orderNumber: `ORDGPS${Date.now()}`,
      orderDate: new Date(),
      customer: testCustomer._id,
      customerName: testCustomer.name,
      customerEmail: testCustomer.email,
      customerPhone: testCustomer.phone,
      deliveryAddress: {
        address: 'Far Away Customer Address',
        city: 'Indore',
        pincode: '452001',
        latitude: 22.7196,
        longitude: 75.8577,
      },
      items: [],
      subtotal: 500,
      total: 500,
      paymentMethod: 'COD',
      status: 'Out for Delivery',
      deliveryBoy: testDriverA._id,
      deliveryOption: 'Standard',
      tipAmount: 0,
      giftPackaging: false,
    });

    let httpStatusCode = 0;
    let httpResponseBody: any = null;

    // Send coordinates 10km away from customer (22.8196, 75.9577)
    const fakeReq = {
      params: { id: testOrderGps._id.toString() },
      body: { latitude: 22.8196, longitude: 75.9577 },
      user: { userId: testDriverA._id.toString(), userType: 'Delivery' },
      app: { get: () => null },
    } as any;

    const fakeRes: any = {
      status: (code: number) => {
        httpStatusCode = code;
        return fakeRes;
      },
      json: (data: any) => {
        httpResponseBody = data;
        return fakeRes;
      },
    };

    await sendDeliveryOtp(fakeReq, fakeRes, () => {});
    await new Promise((r) => setTimeout(r, 200));

    if (httpStatusCode === 403 && httpResponseBody?.code === 'DISTANCE_REQUIREMENT_NOT_SATISFIED') {
      testResults.push({
        id: 'TEST 8',
        test: 'DELIVERY_TEST_MODE=false GPS Distance Restriction (>500m Blocked)',
        status: 'PASS',
        evidence: `HTTP ${httpStatusCode} - "${httpResponseBody?.message}"`,
      });
    } else {
      testResults.push({
        id: 'TEST 8',
        test: 'DELIVERY_TEST_MODE=false GPS Distance Restriction',
        status: 'FAIL',
        evidence: `Expected 403 DISTANCE_REQUIREMENT_NOT_SATISFIED, got ${httpStatusCode} ${JSON.stringify(httpResponseBody)}`,
      });
    }

    await Order.deleteOne({ _id: testOrderGps._id });
  } catch (err: any) {
    testResults.push({
      id: 'TEST 8',
      test: 'DELIVERY_TEST_MODE=false GPS Distance Restriction',
      status: 'FAIL',
      evidence: err.message,
    });
  }

  // Cleanup test entities
  await Customer.deleteOne({ _id: testCustomer._id });
  await Seller.deleteOne({ _id: testSeller._id });
  await Delivery.deleteOne({ _id: testDriverA._id });
  await Delivery.deleteOne({ _id: testDriverB._id });
  await Order.deleteOne({ _id: testOrder._id });
  await mongoose.disconnect();

  console.log('\n===============================================================');
  console.log('DELIVERY OTP TEST MODE SUITE RESULTS');
  console.log('===============================================================\n');

  let allPassed = true;
  testResults.forEach((t) => {
    const icon = t.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${t.id}] ${t.test}: ${t.status}`);
    console.log(`   Evidence: ${t.evidence}\n`);
    if (t.status !== 'PASS') allPassed = false;
  });

  if (allPassed) {
    console.log('🎉 ALL 8 DELIVERY OTP AUTOMATED TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME TESTS FAILED. CHECK EVIDENCE LOGS ABOVE.');
    process.exit(1);
  }
}

runDeliveryOtpTestSuite().catch((err) => {
  console.error('Unhandled error in test suite:', err);
  process.exit(1);
});
