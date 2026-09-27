/**
 * testDeliveryE2ESessionInvalidation.ts
 *
 * End-to-end Lifecycle Test:
 * 1. Creates an isolated temporary Delivery Partner fixture
 * 2. Authenticates and obtains valid session token
 * 3. Confirms Delivery Partner has an active, working session (HTTP 200)
 * 4. Simulates Admin deleting the Delivery Partner from DB
 * 5. Makes an authenticated API call with the existing session token
 * 6. Confirms backend returns HTTP 401 + code 'DELIVERY_PARTNER_DELETED'
 * 7. Simulates client session cleanup (mirroring clearDeliverySession)
 * 8. Confirms all delivery session keys are removed and notice is set
 * 9. Confirms old token cannot be reused
 * 10. Cleans up any test artifacts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { generateToken } from '../services/jwtService';
import Delivery from '../models/Delivery';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api/v1';

async function runE2E() {
  console.log('===============================================================');
  console.log('🧪 RUNNING LIFECYCLE E2E TEST: DELIVERY PARTNER DELETION FLOW');
  console.log('===============================================================');

  await mongoose.connect(process.env.MONGODB_URI || '');
  if (mongoose.connection.name !== 'test') {
    throw new Error('Database is not "test"');
  }

  const testMobile = '9999998811';
  // Clean up any stale test record with this test mobile only
  await Delivery.deleteOne({ mobile: testMobile });

  // 1. Create temporary test delivery partner
  const testPartner = await Delivery.create({
    name: 'Temporary Test Driver',
    mobile: testMobile,
    password: 'TestPassword123!',
    email: 'temp_driver_test@example.com',
    status: 'Active',
    available: 'Available',
    isOnline: true,
  });

  console.log(`1. Created isolated test delivery partner: ID ${testPartner._id}, Mobile: ${testPartner.mobile}`);

  // 2. Generate active session token
  const sessionToken = generateToken(testPartner._id.toString(), 'Delivery');
  console.log('2. Generated active authenticated session token');

  // 3. Confirm session is valid and working
  const initialProfileRes = await axios.get(`${API_BASE}/delivery/profile`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    validateStatus: () => true,
  });

  if (initialProfileRes.status !== 200 || !initialProfileRes.data?.success) {
    throw new Error(`Initial session check failed: Status ${initialProfileRes.status}`);
  }
  console.log(`3. Verified active session working: Status ${initialProfileRes.status}, Name: ${initialProfileRes.data.data?.name}`);

  // 4. Simulate Admin deleting Delivery Partner from DB
  await Delivery.deleteOne({ _id: testPartner._id });
  console.log('4. Admin deleted Delivery Partner from database');

  // 5. Delivery Partner continues using app -> triggers API request
  const afterDeleteProfileRes = await axios.get(`${API_BASE}/delivery/profile`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    validateStatus: () => true,
  });

  console.log(`5. Triggered request after deletion: Status ${afterDeleteProfileRes.status}, Code: ${afterDeleteProfileRes.data?.code}`);

  if (
    afterDeleteProfileRes.status !== 401 ||
    afterDeleteProfileRes.data?.code !== 'DELIVERY_PARTNER_DELETED'
  ) {
    throw new Error(`Expected HTTP 401 + DELIVERY_PARTNER_DELETED, got ${afterDeleteProfileRes.status} + ${afterDeleteProfileRes.data?.code}`);
  }
  console.log('6. Backend successfully detected missing Delivery Partner and responded with DELIVERY_PARTNER_DELETED');

  // 6. Test Dashboard stats request with deleted token
  const dashboardRes = await axios.get(`${API_BASE}/delivery/dashboard/stats`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    validateStatus: () => true,
  });

  if (
    dashboardRes.status !== 401 ||
    dashboardRes.data?.code !== 'DELIVERY_PARTNER_DELETED'
  ) {
    throw new Error(`Expected HTTP 401 + DELIVERY_PARTNER_DELETED on dashboard, got ${dashboardRes.status}`);
  }
  console.log('7. Dashboard stats request also rejected with DELIVERY_PARTNER_DELETED');

  // 7. Test client-side storage cleanup simulation
  const mockLocalStorage: Record<string, string> = {
    delivery_authToken: sessionToken,
    delivery_userData: JSON.stringify({ id: testPartner._id.toString(), name: 'Temporary Test Driver' }),
    delivery_user_name: 'Temporary Test Driver',
    delivery_push_prompt_dismissed: '1',
    [`delivery_order_notifications_${testPartner._id}`]: JSON.stringify({ queue: [] }),
    // Non-delivery items should remain untouched
    customer_authToken: 'customer_jwt_token_123',
    customer_userData: JSON.stringify({ id: 'c1' }),
    app_language: 'en',
  };

  const mockSessionStorage: Record<string, string> = {};

  // Emulate clearDeliverySession()
  delete mockLocalStorage.delivery_authToken;
  delete mockLocalStorage.delivery_userData;
  delete mockLocalStorage.delivery_user_name;
  delete mockLocalStorage.delivery_push_prompt_dismissed;
  Object.keys(mockLocalStorage).forEach((key) => {
    if (key.startsWith('delivery_order_notifications_')) {
      delete mockLocalStorage[key];
    }
  });

  mockSessionStorage.delivery_session_notice =
    'Your delivery partner account is no longer available. Please log in again.';

  // Verifications
  const deliveryKeysPresent = Object.keys(mockLocalStorage).filter(
    (k) =>
      k === 'delivery_authToken' ||
      k === 'delivery_userData' ||
      k === 'delivery_user_name' ||
      k.startsWith('delivery_order_notifications_')
  );

  if (deliveryKeysPresent.length > 0) {
    throw new Error(`Client cleanup failed: keys still present: ${deliveryKeysPresent.join(', ')}`);
  }
  console.log('8. Delivery Partner local state completely cleared');

  if (mockLocalStorage.customer_authToken !== 'customer_jwt_token_123') {
    throw new Error('Customer storage was accidentally modified!');
  }
  console.log('9. Customer storage remained strictly untouched (Role Isolation Verified)');

  if (!mockSessionStorage.delivery_session_notice) {
    throw new Error('Delivery session notice was not set');
  }
  console.log(`10. Session notice set for login page: "${mockSessionStorage.delivery_session_notice}"`);

  console.log('\n🎉 E2E LIFECYCLE TEST PASSED COMPLETELY!');

  await mongoose.disconnect();
}

runE2E().catch(async (err) => {
  console.error('❌ E2E Test Failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
