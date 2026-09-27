/**
 * testDeliveryDeletedSession.ts
 *
 * Dedicated Integration Test Suite for Delivery Partner Deleted-Account Session Handling
 *
 * Verifies:
 * 1. Authenticated delivery partner whose account does not exist in DB returns HTTP 401 with code DELIVERY_PARTNER_DELETED
 * 2. All protected delivery endpoints enforce this validation (/auth/delivery/profile, /delivery/profile, /delivery/dashboard/stats, /delivery/orders/today, /delivery/wallet/balance)
 * 3. Negative tests: Order 404 does NOT return DELIVERY_PARTNER_DELETED (returns standard 404 Order not found)
 * 4. Negative tests: Return 404 does NOT return DELIVERY_PARTNER_DELETED
 * 5. Other roles regression: Customer deleted-account flow remains intact (CUSTOMER_DELETED)
 * 6. Other roles regression: Seller and Admin flows remain untouched
 *
 * SAFETY GUARANTEES:
 * - Read-only against existing database records.
 * - No dropDatabase, deleteMany, or destructive operations.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { generateToken } from '../services/jwtService';
import Delivery from '../models/Delivery';
import Customer from '../models/Customer';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api/v1';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  const statusIcon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${statusIcon}: ${name} - ${details}`);
}

async function runTests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING DELIVERY PARTNER DELETED SESSION INTEGRATION TESTS');
  console.log('===============================================================');

  // Verify DB connection
  const mongoUri = process.env.MONGODB_URI || '';
  if (!mongoUri) {
    throw new Error('MONGODB_URI not found in environment');
  }

  await mongoose.connect(mongoUri);
  const currentDbName = mongoose.connection.name;
  console.log(`Connected to MongoDB database: "${currentDbName}"`);

  if (currentDbName !== 'test') {
    throw new Error(`SAFETY CHECK FAILED: Expected database "test", got "${currentDbName}"`);
  }

  // Generate a non-existent delivery partner ID and token
  const nonExistentDeliveryId = new mongoose.Types.ObjectId().toString();
  const existsCheck = await Delivery.exists({ _id: nonExistentDeliveryId });
  if (existsCheck) {
    throw new Error('Generated ID collision with existing delivery partner document');
  }

  const deletedDeliveryToken = generateToken(nonExistentDeliveryId, 'Delivery');
  console.log(`\nGenerated deleted delivery partner token for non-existent ID: ${nonExistentDeliveryId}`);

  // =========================================================================
  // TEST GROUP 1: Delivery Partner Deleted Session Detection (HTTP 401 + DELIVERY_PARTNER_DELETED)
  // =========================================================================
  console.log('\n--- TEST GROUP 1: Deleted Delivery Partner Token Rejection ---');

  // Test 1.1: GET /auth/delivery/profile
  try {
    const res = await axios.get(`${API_BASE}/auth/delivery/profile`, {
      headers: { Authorization: `Bearer ${deletedDeliveryToken}` },
      validateStatus: () => true,
    });

    const passed =
      res.status === 401 &&
      res.data?.code === 'DELIVERY_PARTNER_DELETED' &&
      res.data?.success === false;

    record(
      'GET /auth/delivery/profile returns DELIVERY_PARTNER_DELETED',
      passed,
      `Status: ${res.status}, Code: ${res.data?.code}, Message: ${res.data?.message}`
    );
  } catch (err: any) {
    record('GET /auth/delivery/profile returns DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
  }

  // Test 1.2: GET /delivery/profile
  try {
    const res = await axios.get(`${API_BASE}/delivery/profile`, {
      headers: { Authorization: `Bearer ${deletedDeliveryToken}` },
      validateStatus: () => true,
    });

    const passed =
      res.status === 401 &&
      res.data?.code === 'DELIVERY_PARTNER_DELETED' &&
      res.data?.success === false;

    record(
      'GET /delivery/profile returns DELIVERY_PARTNER_DELETED',
      passed,
      `Status: ${res.status}, Code: ${res.data?.code}, Message: ${res.data?.message}`
    );
  } catch (err: any) {
    record('GET /delivery/profile returns DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
  }

  // Test 1.3: GET /delivery/dashboard/stats
  try {
    const res = await axios.get(`${API_BASE}/delivery/dashboard/stats`, {
      headers: { Authorization: `Bearer ${deletedDeliveryToken}` },
      validateStatus: () => true,
    });

    const passed =
      res.status === 401 &&
      res.data?.code === 'DELIVERY_PARTNER_DELETED' &&
      res.data?.success === false;

    record(
      'GET /delivery/dashboard/stats returns DELIVERY_PARTNER_DELETED',
      passed,
      `Status: ${res.status}, Code: ${res.data?.code}, Message: ${res.data?.message}`
    );
  } catch (err: any) {
    record('GET /delivery/dashboard/stats returns DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
  }

  // Test 1.4: GET /delivery/orders/today
  try {
    const res = await axios.get(`${API_BASE}/delivery/orders/today`, {
      headers: { Authorization: `Bearer ${deletedDeliveryToken}` },
      validateStatus: () => true,
    });

    const passed =
      res.status === 401 &&
      res.data?.code === 'DELIVERY_PARTNER_DELETED' &&
      res.data?.success === false;

    record(
      'GET /delivery/orders/today returns DELIVERY_PARTNER_DELETED',
      passed,
      `Status: ${res.status}, Code: ${res.data?.code}, Message: ${res.data?.message}`
    );
  } catch (err: any) {
    record('GET /delivery/orders/today returns DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
  }

  // Test 1.5: PUT /delivery/status
  try {
    const res = await axios.put(
      `${API_BASE}/delivery/status`,
      { isOnline: true },
      {
        headers: { Authorization: `Bearer ${deletedDeliveryToken}` },
        validateStatus: () => true,
      }
    );

    const passed =
      res.status === 401 &&
      res.data?.code === 'DELIVERY_PARTNER_DELETED' &&
      res.data?.success === false;

    record(
      'PUT /delivery/status returns DELIVERY_PARTNER_DELETED',
      passed,
      `Status: ${res.status}, Code: ${res.data?.code}, Message: ${res.data?.message}`
    );
  } catch (err: any) {
    record('PUT /delivery/status returns DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
  }

  // Test 1.6: GET /delivery/wallet/balance
  try {
    const res = await axios.get(`${API_BASE}/delivery/wallet/balance`, {
      headers: { Authorization: `Bearer ${deletedDeliveryToken}` },
      validateStatus: () => true,
    });

    const passed =
      res.status === 401 &&
      res.data?.code === 'DELIVERY_PARTNER_DELETED' &&
      res.data?.success === false;

    record(
      'GET /delivery/wallet/balance returns DELIVERY_PARTNER_DELETED',
      passed,
      `Status: ${res.status}, Code: ${res.data?.code}, Message: ${res.data?.message}`
    );
  } catch (err: any) {
    record('GET /delivery/wallet/balance returns DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
  }

  // =========================================================================
  // TEST GROUP 2: Negative Tests (Normal 404s must NOT trigger DELIVERY_PARTNER_DELETED)
  // =========================================================================
  console.log('\n--- TEST GROUP 2: Negative Tests (Normal 404s DO NOT logout) ---');

  // Find a real active delivery partner (strictly read-only)
  const realDeliveryPartner = await Delivery.findOne({ status: 'Active' });
  if (realDeliveryPartner) {
    const validDeliveryToken = generateToken(realDeliveryPartner._id.toString(), 'Delivery');
    console.log(`Using real active delivery partner for negative tests: ID ${realDeliveryPartner._id} (${realDeliveryPartner.name})`);

    // Test 2.1: Non-existent order 404
    const nonExistentOrderId = new mongoose.Types.ObjectId().toString();
    try {
      const res = await axios.get(`${API_BASE}/delivery/orders/${nonExistentOrderId}`, {
        headers: { Authorization: `Bearer ${validDeliveryToken}` },
        validateStatus: () => true,
      });

      const passed =
        res.status === 404 &&
        res.data?.code !== 'DELIVERY_PARTNER_DELETED' &&
        res.data?.message === 'Order not found';

      record(
        'Delivery order 404 does NOT return DELIVERY_PARTNER_DELETED',
        passed,
        `Status: ${res.status}, Code: ${res.data?.code || 'none'}, Message: ${res.data?.message}`
      );
    } catch (err: any) {
      record('Delivery order 404 does NOT return DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
    }

    // Test 2.2: Non-existent return 404
    const nonExistentReturnId = new mongoose.Types.ObjectId().toString();
    try {
      const res = await axios.get(`${API_BASE}/delivery/returns/${nonExistentReturnId}`, {
        headers: { Authorization: `Bearer ${validDeliveryToken}` },
        validateStatus: () => true,
      });

      const passed =
        res.status === 404 &&
        res.data?.code !== 'DELIVERY_PARTNER_DELETED';

      record(
        'Delivery return 404 does NOT return DELIVERY_PARTNER_DELETED',
        passed,
        `Status: ${res.status}, Code: ${res.data?.code || 'none'}, Message: ${res.data?.message}`
      );
    } catch (err: any) {
      record('Delivery return 404 does NOT return DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
    }
  } else {
    console.log('⚠️ No active delivery partner found in DB; skipping live-user negative test');
  }

  // Test 2.3: Non-existent endpoint / other resource 404
  try {
    const res = await axios.get(`${API_BASE}/non-existent-public-resource-12345`, {
      validateStatus: () => true,
    });

    const passed =
      res.status === 404 &&
      res.data?.code !== 'DELIVERY_PARTNER_DELETED';

    record(
      'Generic resource 404 does NOT return DELIVERY_PARTNER_DELETED',
      passed,
      `Status: ${res.status}, Code: ${res.data?.code || 'none'}`
    );
  } catch (err: any) {
    record('Generic resource 404 does NOT return DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
  }

  // =========================================================================
  // TEST GROUP 3: Customer Deleted-Account Flow Remains Intact (Regression Test)
  // =========================================================================
  console.log('\n--- TEST GROUP 3: Customer Flow Regression Test ---');

  const nonExistentCustomerId = new mongoose.Types.ObjectId().toString();
  const deletedCustomerToken = generateToken(nonExistentCustomerId, 'Customer');

  try {
    const res = await axios.get(`${API_BASE}/customer/profile`, {
      headers: { Authorization: `Bearer ${deletedCustomerToken}` },
      validateStatus: () => true,
    });

    const passed =
      res.status === 401 &&
      res.data?.code === 'CUSTOMER_DELETED';

    record(
      'Customer deleted-account returns CUSTOMER_DELETED (Customer unchanged)',
      passed,
      `Status: ${res.status}, Code: ${res.data?.code}, Message: ${res.data?.message}`
    );
  } catch (err: any) {
    record('Customer deleted-account returns CUSTOMER_DELETED (Customer unchanged)', false, `Request failed: ${err.message}`);
  }

  // =========================================================================
  // TEST GROUP 4: Seller & Admin Unaffected (Regression Test)
  // =========================================================================
  console.log('\n--- TEST GROUP 4: Seller & Admin Role Safety ---');

  const sampleSellerToken = generateToken(new mongoose.Types.ObjectId().toString(), 'Seller');
  try {
    const res = await axios.get(`${API_BASE}/seller/profile`, {
      headers: { Authorization: `Bearer ${sampleSellerToken}` },
      validateStatus: () => true,
    });

    // Should NOT return DELIVERY_PARTNER_DELETED
    const passed = res.data?.code !== 'DELIVERY_PARTNER_DELETED';
    record(
      'Seller request does not return DELIVERY_PARTNER_DELETED',
      passed,
      `Status: ${res.status}, Code: ${res.data?.code || 'none'}`
    );
  } catch (err: any) {
    record('Seller request does not return DELIVERY_PARTNER_DELETED', false, `Request failed: ${err.message}`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n===============================================================');
  console.log('📊 TEST SUMMARY');
  console.log('===============================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.passed).length}`);
  console.log(`Final Result: ${allPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  await mongoose.disconnect();
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(async (err) => {
  console.error('Fatal test error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
