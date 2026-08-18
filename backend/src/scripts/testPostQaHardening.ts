import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

async function runHardeningTests() {
  console.log('================================================================');
  console.log('  POST-QA PRODUCTION HARDENING & REGRESSION VERIFICATION');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
    }
  }

  // TEST 1: Duplicate Schema Indexes Verification
  console.log('\n--- 1. Testing Schema Duplicate Indexes Removal ---');
  const OrderModel = (await import('../models/Order')).default;
  const CategoryModel = (await import('../models/Category')).default;
  const PaymentModel = (await import('../models/Payment')).default;

  const orderIndexes = OrderModel.schema.indexes();
  const categoryIndexes = CategoryModel.schema.indexes();
  const paymentIndexes = PaymentModel.schema.indexes();
  
  // Verify exactly 1 index definition per unique field (no redundant duplicates)
  const orderNumberIndexCount = orderIndexes.filter((idx: any) => idx[0].orderNumber !== undefined).length;
  assert(orderNumberIndexCount === 1, `Order Schema has exactly 1 orderNumber index (Found: ${orderNumberIndexCount})`);

  const categoryNameIndexCount = categoryIndexes.filter((idx: any) => idx[0].name !== undefined && Object.keys(idx[0]).length === 1).length;
  assert(categoryNameIndexCount === 1, `Category Schema has exactly 1 single-field name index (Found: ${categoryNameIndexCount})`);

  const paymentTxnIndexCount = paymentIndexes.filter((idx: any) => idx[0].transactionId !== undefined && Object.keys(idx[0]).length === 1).length;
  assert(paymentTxnIndexCount === 1, `Payment Schema has exactly 1 transactionId index (Found: ${paymentTxnIndexCount})`);

  // TEST 2: Customer Phone / Mobile Compatibility
  console.log('\n--- 2. Testing Customer Phone / Mobile Virtual Compatibility ---');
  const CustomerModel = (await import('../models/Customer')).default;
  const testPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const custDoc = new CustomerModel({
    name: 'Hardening Test Customer',
    email: `hardening_${Date.now()}@olovelytest.com`,
    phone: testPhone,
  });
  await custDoc.save();

  assert(custDoc.phone === testPhone, 'Customer.phone reads direct value');
  assert(custDoc.mobile === testPhone, 'Customer.mobile virtual getter returns exact phone value');

  const jsonCust = custDoc.toJSON();
  assert(jsonCust.mobile === testPhone && jsonCust.phone === testPhone, 'Customer.toJSON() includes both phone and mobile virtual');

  // TEST 3: Razorpay Webhook Idempotency & Signature Safety
  console.log('\n--- 3. Testing Razorpay Webhook Idempotency & Signature Safety ---');
  const { handleWebhook } = await import('../services/paymentService');

  const testOrder = await OrderModel.create({
    orderNumber: `ORD-HARDEN-${Date.now()}`,
    customer: custDoc._id,
    customerName: custDoc.name,
    customerEmail: custDoc.email,
    customerPhone: custDoc.phone,
    deliveryAddress: {
      address: '123 Test St',
      city: 'Indore',
      pincode: '452001',
    },
    subtotal: 500,
    total: 500,
    paymentMethod: 'Online',
    paymentStatus: 'Pending',
    status: 'Pending',
    deliveryOption: 'Standard',
    tipAmount: 0,
    giftPackaging: false,
  });

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_123';
  process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

  const mockPaymentId = `pay_test_${Date.now()}`;
  const mockRazorpayOrderId = `order_rzp_${Date.now()}`;

  const webhookPayload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: mockPaymentId,
          order_id: mockRazorpayOrderId,
          amount: 50000,
          currency: 'INR',
          status: 'captured',
          notes: {
            orderId: testOrder._id.toString(),
          },
        },
      },
    },
  };

  const validSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(webhookPayload))
    .digest('hex');

  // Webhook Delivery #1
  const delivery1 = await handleWebhook(webhookPayload, validSignature);
  assert(delivery1.success === true, 'Webhook Delivery #1: Valid signature accepted');

  const updatedOrder1 = await OrderModel.findById(testOrder._id);
  assert(updatedOrder1?.paymentStatus === 'Paid', 'Webhook Delivery #1: Order marked as Paid');
  assert(updatedOrder1?.paymentId === mockPaymentId, 'Webhook Delivery #1: Order paymentId recorded');

  const paymentRecords1 = await PaymentModel.find({ razorpayPaymentId: mockPaymentId });
  assert(paymentRecords1.length === 1 && paymentRecords1[0].status === 'Completed', 'Webhook Delivery #1: Exactly 1 Completed Payment record created');

  // Webhook Delivery #2 (Duplicate delivery of the exact same event)
  const delivery2 = await handleWebhook(webhookPayload, validSignature);
  assert(delivery2.success === true, 'Webhook Delivery #2 (Duplicate): Acknowledged idempotently');

  const paymentRecords2 = await PaymentModel.find({ razorpayPaymentId: mockPaymentId });
  assert(paymentRecords2.length === 1, 'Webhook Delivery #2 (Duplicate): No duplicate Payment record created');

  const updatedOrder2 = await OrderModel.findById(testOrder._id);
  assert(updatedOrder2?.paymentStatus === 'Paid', 'Webhook Delivery #2 (Duplicate): Order remains in Paid status without re-modification');

  // Webhook Delivery #3 (Tampered signature rejection)
  const tamperedDelivery = await handleWebhook(webhookPayload, 'invalid_tampered_signature_hex');
  assert(tamperedDelivery.success === false, 'Webhook Delivery #3: Tampered signature correctly rejected');

  // TEST 4: Legacy Branding Scan (Excluding documentation & seed data)
  console.log('\n--- 4. Repository Scan for Legacy User-Facing Branding ---');
  const legacyKeywords = ['Dhakad', 'Snazzy', 'Zoogno'];
  let legacyMatchesCount = 0;
  const legacyFoundList: string[] = [];

  function scanSourceFiles(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'reports') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanSourceFiles(fullPath);
      } else if (entry.isFile() && /\.(tsx|ts|jsx|html)$/.test(entry.name)) {
        // Exclude test runner scripts, seed scripts, and DLT provider templates (documented external dependency)
        if (
          fullPath.includes('comprehensiveQaRunner') ||
          fullPath.includes('deepDiveQaSuite') ||
          fullPath.includes('testPostQaHardening') ||
          fullPath.includes('seed') ||
          fullPath.includes('otpService.ts') // DLT Provider Required Fallback Templates
        ) continue;
        
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const kw of legacyKeywords) {
          if (content.includes(kw)) {
            legacyMatchesCount++;
            legacyFoundList.push(`${path.relative(process.cwd(), fullPath)} contains "${kw}"`);
            break;
          }
        }
      }
    }
  }

  scanSourceFiles(path.join(__dirname, '..'));
  scanSourceFiles(path.join(__dirname, '../../../frontend/src'));

  assert(legacyMatchesCount === 0, `Zero user-facing legacy brand names in active source code (Found: ${legacyMatchesCount})`, legacyFoundList.join(', '));

  // TEST 5: Push Notification Test Endpoint Message Check
  console.log('\n--- 5. Testing Push Notification Branding ---');
  const fcmRoutesFile = fs.readFileSync(path.join(__dirname, '../routes/fcmTokenRoutes.ts'), 'utf8');
  assert(fcmRoutesFile.includes('Olovely Total Suvidha') && !fcmRoutesFile.includes('Dhakad Snazzy'), 'FCM test notification route contains Olovely Total Suvidha branding');

  // TEST 6: CORS Configuration Check
  console.log('\n--- 6. Testing CORS Configuration Cleanliness ---');
  const serverFile = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');
  const socketFile = fs.readFileSync(path.join(__dirname, '../socket/socketService.ts'), 'utf8');
  const corsHelperFile = fs.readFileSync(path.join(__dirname, '../utils/corsHelper.ts'), 'utf8');

  assert(!serverFile.includes('dhakadsnazzy.com'), 'server.ts has no hardcoded legacy domains');
  assert(!socketFile.includes('dhakadsnazzy.com'), 'socketService.ts has no hardcoded legacy domains');
  assert(!corsHelperFile.includes('dhakadsnazzy.com'), 'corsHelper.ts has no hardcoded legacy domains');

  // Cleanup
  await CustomerModel.deleteOne({ _id: custDoc._id });
  await OrderModel.deleteOne({ _id: testOrder._id });
  await PaymentModel.deleteMany({ razorpayPaymentId: mockPaymentId });
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log(`POST-QA HARDENING AUDIT COMPLETED: ${passedTests}/${totalTests} PASSED`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runHardeningTests().catch((err) => {
  console.error('Hardening test error:', err);
  process.exit(1);
});
