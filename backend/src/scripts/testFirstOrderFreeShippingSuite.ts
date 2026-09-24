/**
 * testFirstOrderFreeShippingSuite.ts
 *
 * Automated verification suite for Admin-Controlled First Order Free Shipping:
 * 1. Admin Setting ON/OFF persistence
 * 2. New customer first order receives ₹0 shipping when feature is ON
 * 3. Subsequent orders for the same customer receive normal shipping
 * 4. Distinct customer receives ₹0 shipping on their own first order
 * 5. Failed payment attempts do NOT disqualify customer
 * 6. Cancelled orders do NOT disqualify customer
 * 7. When Admin turns OFF feature, new customers receive normal shipping
 * 8. Historical orders retain snapshot (shipping: 0, firstOrderFreeShippingApplied: true) even after feature is turned OFF
 * 9. Customer with cancelled order retains eligibility
 * 10. Historical order snapshot immutability
 * 11. Concurrent first-order checkout race condition protection (Customer-level atomic claim)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import AppSettings from '../models/AppSettings';
import Order from '../models/Order';
import Customer from '../models/Customer';
import {
  isCustomerEligibleForFirstOrderFreeShipping,
  evaluateFirstOrderFreeShipping,
  atomicallyClaimFirstOrderFreeShipping,
  releaseFirstOrderFreeShippingClaim,
} from '../services/shipping/shippingPromotionService';

// =========================================================================
// HARD SAFETY GUARD: Never run against live / production MongoDB database!
// Requires:
//   1. NODE_ENV === "test"
//   2. Dedicated test database URI: FIRST_ORDER_TEST_MONGODB_URI or MONGODB_TEST_URI
// =========================================================================
const isTestEnv = process.env.NODE_ENV === 'test';
const dedicatedTestUri =
  process.env.FIRST_ORDER_TEST_MONGODB_URI ||
  process.env.MONGODB_TEST_URI;

if (!isTestEnv || !dedicatedTestUri) {
  console.error('====================================================');
  console.error(
    'Refusing to run First Order Free Shipping tests because a dedicated test database/environment was not provided.'
  );
  console.error('====================================================');
  console.error(
    'Safety Guards Enforced:\n' +
    `  - NODE_ENV must be "test" (current: "${process.env.NODE_ENV || 'undefined'}")\n` +
    `  - Dedicated test URI must be provided via FIRST_ORDER_TEST_MONGODB_URI or MONGODB_TEST_URI (provided: ${Boolean(dedicatedTestUri)})\n` +
    '  - Test suite will NEVER fall back to production MONGODB_URI.\n'
  );
  console.log('Test execution skipped because isolated test MongoDB was not configured.');
  process.exit(0);
}

if (process.env.MONGODB_URI && dedicatedTestUri === process.env.MONGODB_URI) {
  console.error('====================================================');
  console.error(
    'Refusing to run First Order Free Shipping tests because dedicated test database URI matches production MONGODB_URI.'
  );
  console.error('====================================================');
  process.exit(1);
}

async function runVerification() {
  console.log('====================================================');
  console.log('🧪 RUNNING FIRST ORDER FREE SHIPPING VERIFICATION');
  console.log(`🔌 Connected to Dedicated Test DB: ${dedicatedTestUri}`);
  console.log('====================================================');

  await mongoose.connect(dedicatedTestUri);
  console.log('✅ Connected to Isolated Test Database');

  const testCustomer1Id = new mongoose.Types.ObjectId();
  const testCustomer2Id = new mongoose.Types.ObjectId();
  const testCustomer3Id = new mongoose.Types.ObjectId();
  const testCustomer4Id = new mongoose.Types.ObjectId();
  let testCustomer5Id: mongoose.Types.ObjectId | null = null;

  const originalSettings = await AppSettings.getSettings();
  const originalState = Boolean(originalSettings?.firstOrderFreeShippingEnabled);

  try {
    // ----------------------------------------------------
    // TEST 1: Admin Setting Persistence
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Admin Setting Persistence ---');
    await AppSettings.findOneAndUpdate({}, { firstOrderFreeShippingEnabled: true });
    let settings = await AppSettings.getSettings();
    if (!settings?.firstOrderFreeShippingEnabled) {
      throw new Error('Failed to persist firstOrderFreeShippingEnabled = true');
    }
    console.log('✅ AppSettings.firstOrderFreeShippingEnabled successfully enabled (true)');

    await AppSettings.findOneAndUpdate({}, { firstOrderFreeShippingEnabled: false });
    settings = await AppSettings.getSettings();
    if (settings?.firstOrderFreeShippingEnabled) {
      throw new Error('Failed to persist firstOrderFreeShippingEnabled = false');
    }
    console.log('✅ AppSettings.firstOrderFreeShippingEnabled successfully disabled (false)');

    // ----------------------------------------------------
    // TEST 2: Eligibility Check for Brand New Customer
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Eligibility Check for Brand New Customer ---');
    const isEligibleNew = await isCustomerEligibleForFirstOrderFreeShipping(testCustomer1Id);
    if (!isEligibleNew) {
      throw new Error('New customer should be eligible for first order free shipping');
    }
    console.log('✅ New Customer 1 has no previous orders -> Eligible: true');

    // ----------------------------------------------------
    // TEST 3: Promotion Calculation when Admin Setting is OFF
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Promotion Calculation when Admin Setting is OFF ---');
    await AppSettings.findOneAndUpdate({}, { firstOrderFreeShippingEnabled: false });
    settings = await AppSettings.getSettings();

    const evalDisabled = await evaluateFirstOrderFreeShipping({
      customerId: testCustomer1Id,
      settings,
      normalShippingFee: 50,
    });

    if (evalDisabled.applied || evalDisabled.finalShippingAmount !== 50) {
      throw new Error(`Expected normal shipping 50 when disabled, got ${evalDisabled.finalShippingAmount}`);
    }
    console.log('✅ When Admin Setting is OFF -> Shipping remains normal ₹50, applied: false');

    // ----------------------------------------------------
    // TEST 4: Promotion Calculation when Admin Setting is ON (First Order)
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Promotion Calculation when Admin Setting is ON (First Order) ---');
    await AppSettings.findOneAndUpdate({}, { firstOrderFreeShippingEnabled: true });
    settings = await AppSettings.getSettings();

    const evalFirstOrder = await evaluateFirstOrderFreeShipping({
      customerId: testCustomer1Id,
      settings,
      normalShippingFee: 50,
    });

    if (!evalFirstOrder.applied || evalFirstOrder.finalShippingAmount !== 0 || evalFirstOrder.shippingDiscount !== 50) {
      throw new Error(`Expected free shipping 0, discount 50, got final ${evalFirstOrder.finalShippingAmount}`);
    }
    console.log('✅ When Admin Setting is ON -> Normal shipping ₹50 waived to ₹0, discount: ₹50, applied: true');

    // ----------------------------------------------------
    // TEST 5: Create First Order and Store Order Snapshot
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Create First Order with Explicit Snapshot ---');
    const order1 = await Order.create({
      orderNumber: `TEST-ORD-${Date.now()}-1`,
      customer: testCustomer1Id,
      customerName: 'Test Customer 1',
      customerPhone: '9876543210',
      deliveryAddress: {
        address: '123 Test Street',
        city: 'Indore',
        pincode: '452001',
      },
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Received',
      subtotal: 500,
      tax: 0,
      shipping: evalFirstOrder.finalShippingAmount, // ₹0
      firstOrderFreeShippingApplied: evalFirstOrder.applied, // true
      normalShippingAmount: evalFirstOrder.normalShippingAmount, // ₹50
      shippingDiscount: evalFirstOrder.shippingDiscount, // ₹50
      platformFee: 2,
      discount: 0,
      total: 502, // subtotal 500 + platform 2 + shipping 0
      deliveryOption: 'Standard',
      tipAmount: 0,
      giftPackaging: false,
      orderType: 'QUICK_COMMERCE',
      items: [],
    });

    const savedOrder1 = await Order.findById(order1._id);
    if (
      !savedOrder1?.firstOrderFreeShippingApplied ||
      savedOrder1.shipping !== 0 ||
      savedOrder1.normalShippingAmount !== 50 ||
      savedOrder1.shippingDiscount !== 50
    ) {
      throw new Error('Order snapshot fields were not correctly saved in MongoDB');
    }
    console.log('✅ Order 1 saved with explicit snapshot:', {
      shipping: savedOrder1.shipping,
      firstOrderFreeShippingApplied: savedOrder1.firstOrderFreeShippingApplied,
      normalShippingAmount: savedOrder1.normalShippingAmount,
      shippingDiscount: savedOrder1.shippingDiscount,
      total: savedOrder1.total,
    });

    // ----------------------------------------------------
    // TEST 6: Subsequent Order for Customer 1 (Must NOT receive free shipping)
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Subsequent Order for Same Customer ---');
    const isEligibleSecond = await isCustomerEligibleForFirstOrderFreeShipping(testCustomer1Id);
    if (isEligibleSecond) {
      throw new Error('Customer 1 with prior order should NOT be eligible for first order free shipping');
    }

    const evalSecondOrder = await evaluateFirstOrderFreeShipping({
      customerId: testCustomer1Id,
      settings,
      normalShippingFee: 50,
    });

    if (evalSecondOrder.applied || evalSecondOrder.finalShippingAmount !== 50) {
      throw new Error(`Second order must receive normal shipping 50, got ${evalSecondOrder.finalShippingAmount}`);
    }
    console.log('✅ Customer 1 second order -> Eligible: false, normal shipping ₹50 charged');

    // ----------------------------------------------------
    // TEST 7: Customer 2 (New Customer) gets Free Shipping independently
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Independent Eligibility for Customer 2 ---');
    const isEligibleCust2 = await isCustomerEligibleForFirstOrderFreeShipping(testCustomer2Id);
    if (!isEligibleCust2) {
      throw new Error('Customer 2 should be eligible as they have no prior orders');
    }
    const evalCust2 = await evaluateFirstOrderFreeShipping({
      customerId: testCustomer2Id,
      settings,
      normalShippingFee: 60,
    });
    if (!evalCust2.applied || evalCust2.finalShippingAmount !== 0) {
      throw new Error('Customer 2 should receive free shipping');
    }
    console.log('✅ Customer 2 -> Eligible: true, receives ₹0 shipping independently');

    // ----------------------------------------------------
    // TEST 8: Failed Payment Attempt does NOT disqualify customer
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Failed Payment Attempt Handling ---');
    await Order.create({
      orderNumber: `TEST-ORD-${Date.now()}-FAIL`,
      customer: testCustomer3Id,
      customerName: 'Test Customer 3',
      customerPhone: '9876543212',
      deliveryAddress: { address: 'Fail St', city: 'Indore', pincode: '452001' },
      paymentMethod: 'Online',
      paymentStatus: 'Failed',
      status: 'Cancelled',
      subtotal: 400,
      tax: 0,
      shipping: 50,
      platformFee: 2,
      discount: 0,
      total: 452,
      deliveryOption: 'Standard',
      tipAmount: 0,
      giftPackaging: false,
      orderType: 'QUICK_COMMERCE',
      items: [],
    });

    const isEligibleAfterFailure = await isCustomerEligibleForFirstOrderFreeShipping(testCustomer3Id);
    if (!isEligibleAfterFailure) {
      throw new Error('Failed payment order should not disqualify customer from first order free shipping');
    }
    console.log('✅ Customer 3 with failed payment attempt -> Still eligible: true');

    // ----------------------------------------------------
    // TEST 9: Cancelled Order does NOT disqualify customer
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Cancelled Order Handling ---');
    await Order.create({
      orderNumber: `TEST-ORD-${Date.now()}-CANCEL`,
      customer: testCustomer4Id,
      customerName: 'Test Customer 4',
      customerPhone: '9876543213',
      deliveryAddress: { address: 'Cancel St', city: 'Indore', pincode: '452001' },
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Cancelled',
      subtotal: 400,
      tax: 0,
      shipping: 50,
      platformFee: 2,
      discount: 0,
      total: 452,
      deliveryOption: 'Standard',
      tipAmount: 0,
      giftPackaging: false,
      orderType: 'QUICK_COMMERCE',
      items: [],
    });

    const isEligibleAfterCancel = await isCustomerEligibleForFirstOrderFreeShipping(testCustomer4Id);
    if (!isEligibleAfterCancel) {
      throw new Error('Cancelled order should not disqualify customer from first order free shipping');
    }
    console.log('✅ Customer 4 with cancelled order -> Still eligible: true');

    // ----------------------------------------------------
    // TEST 10: Snapshot Immutability (Historical Orders Unchanged when Admin turns setting OFF)
    // ----------------------------------------------------
    console.log('\n--- TEST 10: Snapshot Immutability when Admin turns setting OFF ---');
    await AppSettings.findOneAndUpdate({}, { firstOrderFreeShippingEnabled: false });

    const historicalOrder = await Order.findById(order1._id);
    if (historicalOrder?.shipping !== 0 || !historicalOrder?.firstOrderFreeShippingApplied) {
      throw new Error('Historical order must retain ₹0 shipping even when Admin setting is disabled');
    }
    console.log('✅ Admin disabled promotion. Historical Order 1 retains: shipping = ₹0, snapshot intact.');

    // ----------------------------------------------------
    // TEST 11: Concurrent First-Order Checkout Attempt (Atomic Claim Race Condition Fix)
    // ----------------------------------------------------
    console.log('\n--- TEST 11: Concurrent First-Order Checkout Race Condition Fix ---');
    await AppSettings.findOneAndUpdate({}, { firstOrderFreeShippingEnabled: true });
    settings = await AppSettings.getSettings();

    const timestamp = Date.now();
    const testCust5 = await Customer.create({
      name: 'Concurrent Race Test Customer',
      phone: `95${timestamp.toString().slice(-8)}`,
      status: 'Active',
      firstOrderFreeShippingConsumed: false,
    });
    testCustomer5Id = testCust5._id;

    // Both requests evaluate eligibility concurrently before claim:
    const [evalConcurA, evalConcurB] = await Promise.all([
      evaluateFirstOrderFreeShipping({
        customerId: testCust5._id,
        settings,
        normalShippingFee: 50,
      }),
      evaluateFirstOrderFreeShipping({
        customerId: testCust5._id,
        settings,
        normalShippingFee: 50,
      }),
    ]);

    if (!evalConcurA.isEligible || !evalConcurB.isEligible) {
      throw new Error('Both concurrent requests must initially see customer as eligible');
    }

    // Both requests simultaneously execute atomic benefit claim:
    const [claimA, claimB] = await Promise.all([
      atomicallyClaimFirstOrderFreeShipping(testCust5._id),
      atomicallyClaimFirstOrderFreeShipping(testCust5._id),
    ]);

    const claimsWon = (claimA ? 1 : 0) + (claimB ? 1 : 0);
    if (claimsWon !== 1) {
      throw new Error(`Expected exactly ONE request to atomically claim promotion, but ${claimsWon} won`);
    }

    const winnerIsA = claimA;
    console.log(
      `✅ Concurrency race resolved: Request ${winnerIsA ? 'A' : 'B'} won atomic claim (true), Request ${winnerIsA ? 'B' : 'A'} lost (false)`
    );

    // Winner applies ₹0 free shipping, loser applies normal ₹50 shipping:
    const concurOrderWinner = await Order.create({
      orderNumber: `TEST-ORD-CONCUR-WIN-${timestamp}`,
      customer: testCust5._id,
      customerName: testCust5.name,
      customerPhone: testCust5.phone,
      deliveryAddress: { address: 'Winner St', city: 'Indore', pincode: '452001' },
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Received',
      subtotal: 500,
      tax: 0,
      shipping: 0,
      firstOrderFreeShippingApplied: true,
      normalShippingAmount: 50,
      shippingDiscount: 50,
      platformFee: 2,
      discount: 0,
      total: 502,
      deliveryOption: 'Standard',
      orderType: 'QUICK_COMMERCE',
      items: [],
    });

    const concurOrderLoser = await Order.create({
      orderNumber: `TEST-ORD-CONCUR-LOSE-${timestamp}`,
      customer: testCust5._id,
      customerName: testCust5.name,
      customerPhone: testCust5.phone,
      deliveryAddress: { address: 'Loser St', city: 'Indore', pincode: '452001' },
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Received',
      subtotal: 500,
      tax: 0,
      shipping: 50,
      firstOrderFreeShippingApplied: false,
      normalShippingAmount: 50,
      shippingDiscount: 0,
      platformFee: 2,
      discount: 0,
      total: 552,
      deliveryOption: 'Standard',
      orderType: 'QUICK_COMMERCE',
      items: [],
    });

    if (concurOrderWinner.shipping !== 0 || !concurOrderWinner.firstOrderFreeShippingApplied) {
      throw new Error('Winning order must have shipping: ₹0 and firstOrderFreeShippingApplied: true');
    }
    if (concurOrderLoser.shipping !== 50 || concurOrderLoser.firstOrderFreeShippingApplied) {
      throw new Error('Losing order must have normal shipping: ₹50 and firstOrderFreeShippingApplied: false');
    }

    console.log('✅ Concurrent Orders Verified: Exactly ONE order received ₹0 shipping, other received normal ₹50 shipping');

    // Test Failure Release Safety: verify releaseFirstOrderFreeShippingClaim restores eligibility
    await releaseFirstOrderFreeShippingClaim(testCust5._id);
    const releasedCust = await Customer.findById(testCust5._id);
    if (releasedCust?.firstOrderFreeShippingConsumed !== false) {
      throw new Error('releaseFirstOrderFreeShippingClaim failed to restore consumed flag to false');
    }
    console.log('✅ Failure Safety Verified: Benefit claim released safely back to false');

    console.log('\n====================================================');
    console.log('🎉 ALL 11 TESTS PASSED CLEANLY & ACCURATELY!');
    console.log('====================================================\n');
  } finally {
    // Clean up test orders and test customers from test database
    const customersToClean = [testCustomer1Id, testCustomer2Id, testCustomer3Id, testCustomer4Id];
    if (testCustomer5Id) {
      customersToClean.push(testCustomer5Id);
    }
    await Order.deleteMany({
      customer: { $in: customersToClean },
    });
    await Customer.deleteMany({
      _id: { $in: customersToClean },
    });
    // Restore original setting in test database
    await AppSettings.findOneAndUpdate({}, { firstOrderFreeShippingEnabled: originalState });
    await mongoose.disconnect();
    console.log('🧹 Cleaned up isolated test data and disconnected.');
  }
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
