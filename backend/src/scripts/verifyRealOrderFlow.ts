/// <reference path="../types.d.ts" />
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Customer from '../models/Customer';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import AppSettings from '../models/AppSettings';
import Commission from '../models/Commission';
import WalletTransaction from '../models/WalletTransaction';
import CashCollection from '../models/CashCollection';
import { calculateCODOrderBreakdown, processCODOrderDelivery, getOrderEarningBreakdown } from '../services/commissionService';
import { getFinancialDashboard } from '../modules/admin/controllers/adminWalletController';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runRealOrderVerification() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB for Real Order COD Verification\n');

  const testResults: Array<{ id: string; test: string; status: 'PASS' | 'FAIL'; evidence: string }> = [];

  // 1. Setup Test Entities
  const testCustomer = await Customer.create({
    name: 'Real Order Customer',
    phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `realordercust_${Date.now()}@test.com`,
    password: 'password123',
    status: 'Active',
  });

  const testSeller = await Seller.create({
    sellerName: 'Fashion Hub Owner',
    mobile: `8${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `fashionhub_${Date.now()}@test.com`,
    password: 'password123',
    storeName: 'Fashion Hub',
    category: 'Fashion',
    status: 'Approved',
    balance: 0,
    commissionRate: 10, // 10% seller commission
  });

  const testDriver = await Delivery.create({
    name: 'Speedy Delivery Boy',
    mobile: `7${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `speedy_${Date.now()}@test.com`,
    password: 'password123',
    status: 'Active',
    commissionRate: 5, // 5% delivery commission
    balance: 0,
    pendingAdminPayout: 0,
    cashCollected: 0,
  });

  // Ensure dynamic free shipping threshold is ₹500
  await AppSettings.findOneAndUpdate(
    {},
    { freeDeliveryThreshold: 500 },
    { upsert: true, new: true }
  );

  // 2. Create Order: Product ₹900 + Platform Fee ₹2 + Free Delivery (Threshold ₹500) = Total ₹902
  const realOrder = await Order.create({
    orderNumber: `ORD_REAL_COD_${Date.now()}`,
    orderDate: new Date(),
    customer: testCustomer._id,
    customerName: testCustomer.name,
    customerEmail: testCustomer.email,
    customerPhone: testCustomer.phone,
    deliveryAddress: {
      address: '123 Main St',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
    },
    subtotal: 900,
    tax: 0,
    shipping: 0, // Free Delivery (> ₹500)
    platformFee: 2,
    total: 902,
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Processed',
    deliveryPreference: 'Admin',
    deliveryBoy: testDriver._id,
    deliveryBoyStatus: 'Assigned',
    items: [],
  });

  const Product = require('../models/Product').default;
  const testProduct = await Product.create({
    productName: 'Designer Silk Saree',
    price: 900,
    discPrice: 900,
    seller: testSeller._id,
    category: new mongoose.Types.ObjectId(),
    sku: `SKU_${Date.now()}`,
    mainImage: '/saree.png',
  });

  const orderItem = await OrderItem.create({
    order: realOrder._id,
    product: testProduct._id,
    productName: 'Designer Silk Saree',
    seller: testSeller._id,
    unitPrice: 900,
    quantity: 1,
    total: 900,
    commissionRate: 10,
    commissionAmount: 90,
  });

  realOrder.items = [orderItem._id];
  await Order.findByIdAndUpdate(realOrder._id, { items: [orderItem._id] });

  console.log(`===============================================================`);
  console.log(`CREATED TEST ORDER: ${realOrder.orderNumber}`);
  console.log(`Product Subtotal: ₹900 | Platform Fee: ₹2 | Shipping: ₹0 | Total: ₹902`);
  console.log(`===============================================================\n`);

  // -----------------------------------------------------------------
  // STEP 1: Verify Admin Order Details Breakdown Calculation
  // -----------------------------------------------------------------
  try {
    const breakdown = await getOrderEarningBreakdown(realOrder._id.toString());
    const adminProductComm = breakdown.adminProductCommission; // 90
    const platformFee = breakdown.platformFee; // 2
    const deliveryShare = breakdown.deliveryBoyCommission; // 45
    const sellerEarning = breakdown.sellerEarnings.get(testSeller._id.toString()) || 0; // 810
    const adminNetEarning = breakdown.totalAdminEarning; // 47

    const ledgerTotal = sellerEarning + deliveryShare + adminNetEarning;

    if (
      adminProductComm === 90 &&
      platformFee === 2 &&
      deliveryShare === 45 &&
      sellerEarning === 810 &&
      adminNetEarning === 47 &&
      ledgerTotal === 902
    ) {
      testResults.push({
        id: 'STEP 1',
        test: 'Admin Order Details Breakdown shows Admin Net = ₹47 (NOT ₹92)',
        status: 'PASS',
        evidence: `Admin Net: ₹${adminNetEarning}, Product Comm: ₹${adminProductComm}, Platform Fee: ₹${platformFee}, Rider Share: ₹${deliveryShare}, Seller Earning: ₹${sellerEarning}, Total Ledger: ₹${ledgerTotal}`,
      });
    } else {
      throw new Error(`Breakdown mismatch! Net: ${adminNetEarning}, Seller: ${sellerEarning}, Rider: ${deliveryShare}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'STEP 1', test: 'Admin Order Details Breakdown', status: 'FAIL', evidence: err.message });
  }

  // -----------------------------------------------------------------
  // STEP 2: Process COD Delivery (Delivered Order)
  // -----------------------------------------------------------------
  try {
    await processCODOrderDelivery(realOrder._id.toString());
    await Order.findByIdAndUpdate(realOrder._id, { status: 'Delivered', deliveredAt: new Date() });

    const updatedDriver = await Delivery.findById(testDriver._id);
    const updatedSeller = await Seller.findById(testSeller._id);

    const riderTxns = await WalletTransaction.find({ userId: testDriver._id.toString(), relatedOrder: realOrder._id.toString() });
    const sellerTxns = await WalletTransaction.find({ userId: testSeller._id.toString(), relatedOrder: realOrder._id.toString() });

    if (
      updatedDriver?.balance === 45 &&
      updatedDriver?.pendingAdminPayout === 902 &&
      riderTxns.length === 1 &&
      updatedSeller?.balance === 0 &&
      sellerTxns.length === 0
    ) {
      testResults.push({
        id: 'STEP 2',
        test: 'Delivery Boy Wallet credited ₹45, COD Owed = ₹902, Seller pending settlement',
        status: 'PASS',
        evidence: `Driver Balance: ₹${updatedDriver?.balance}, Rider COD Owed: ₹${updatedDriver?.pendingAdminPayout}, Rider Txns: ${riderTxns.length}, Seller Txns (Pending COD): ${sellerTxns.length}`,
      });
    } else {
      throw new Error(`Delivery processing mismatch! Driver balance: ${updatedDriver?.balance}, Owed: ${updatedDriver?.pendingAdminPayout}, Rider Txns: ${riderTxns.length}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'STEP 2', test: 'Process COD Delivery', status: 'FAIL', evidence: err.message });
  }

  // -----------------------------------------------------------------
  // STEP 3: Verify Admin Wallet Dashboard State (Pending COD = ₹902)
  // -----------------------------------------------------------------
  try {
    let payloadResult: any = null;
    const req: any = {};
    const res: any = {
      status: function(code: number) { return this; },
      json: function(payload: any) { payloadResult = payload; return this; },
    };

    await (getFinancialDashboard as any)(req, res, () => {});

    const pendingCOD = payloadResult?.data?.pendingFromDeliveryBoy ?? payloadResult?.data?.pendingAmountFromDeliveryBoy;

    if (pendingCOD === 902) {
      testResults.push({
        id: 'STEP 3',
        test: 'Admin Wallet Dashboard shows Pending from Delivery Boy (COD) = ₹902',
        status: 'PASS',
        evidence: `Dashboard Pending COD: ₹${pendingCOD}, Total Platform Earning: ₹${payloadResult?.data?.totalPlatformEarning}`,
      });
    } else {
      throw new Error(`Admin Wallet dashboard mismatch! Pending COD: ${pendingCOD}, full payload: ${JSON.stringify(payloadResult)}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'STEP 3', test: 'Admin Wallet Dashboard State', status: 'FAIL', evidence: err.message });
  }

  // -----------------------------------------------------------------
  // STEP 4: Test Idempotency (Repeat COD Settlement Callback)
  // -----------------------------------------------------------------
  try {
    await processCODOrderDelivery(realOrder._id.toString()); // Call 2nd time

    const riderTxns2 = await WalletTransaction.find({ userId: testDriver._id.toString(), relatedOrder: realOrder._id.toString() });
    const updatedDriver2 = await Delivery.findById(testDriver._id);

    if (riderTxns2.length === 1 && updatedDriver2?.balance === 45 && updatedDriver2?.pendingAdminPayout === 902) {
      testResults.push({
        id: 'STEP 4',
        test: 'Idempotency Guard blocks duplicate settlement (Rider Txns = 1, Balance = ₹45, COD Owed = ₹902)',
        status: 'PASS',
        evidence: `Rider Txns after 2nd call: ${riderTxns2.length}, Balance: ₹${updatedDriver2?.balance}, COD Owed: ₹${updatedDriver2?.pendingAdminPayout}`,
      });
    } else {
      throw new Error(`Idempotency failure! Rider Txns count: ${riderTxns2.length}, Balance: ${updatedDriver2?.balance}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'STEP 4', test: 'Idempotency Guard', status: 'FAIL', evidence: err.message });
  }

  // -----------------------------------------------------------------
  // STEP 5: Mark COD Received by Admin
  // -----------------------------------------------------------------
  try {
    // Admin marks order COD as paid
    await Order.findByIdAndUpdate(realOrder._id, { codPaidToAdminAt: new Date() });
    // Rider settles cash collection with Admin
    await Delivery.findByIdAndUpdate(testDriver._id, { pendingAdminPayout: 0 });
    await CashCollection.updateMany({ order: realOrder._id }, { status: 'Received', receivedAt: new Date() });

    // Verify Admin Wallet Dashboard Pending COD becomes ₹0
    let payloadResultAfter: any = null;
    const req: any = {};
    const res: any = {
      status: function(code: number) { return this; },
      json: function(payload: any) { payloadResultAfter = payload; return this; },
    };

    await (getFinancialDashboard as any)(req, res, () => {});

    const pendingCODAfter = payloadResultAfter?.data?.pendingFromDeliveryBoy ?? payloadResultAfter?.data?.pendingAmountFromDeliveryBoy;

    if (pendingCODAfter === 0) {
      testResults.push({
        id: 'STEP 5',
        test: 'After Admin receives COD, Pending from Delivery Boy becomes ₹0',
        status: 'PASS',
        evidence: `Pending COD after payment: ₹${pendingCODAfter}`,
      });
    } else {
      throw new Error(`Post-COD Admin Wallet mismatch! Pending COD: ${pendingCODAfter}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'STEP 5', test: 'Mark COD Received', status: 'FAIL', evidence: err.message });
  }

  // -----------------------------------------------------------------
  // STEP 6: Final Ledger Accounting Verification
  // -----------------------------------------------------------------
  try {
    const finalBreakdown = await getOrderEarningBreakdown(realOrder._id.toString());
    const finalSeller = finalBreakdown.sellerEarnings.get(testSeller._id.toString()) || 0; // 810
    const finalRider = finalBreakdown.deliveryBoyCommission; // 45
    const finalAdminNet = finalBreakdown.totalAdminEarning; // 47
    const sumTotal = finalSeller + finalRider + finalAdminNet; // 902

    if (finalSeller === 810 && finalRider === 45 && finalAdminNet === 47 && sumTotal === 902) {
      testResults.push({
        id: 'STEP 6',
        test: 'Final Accounting Ledger strictly balances: ₹810 + ₹45 + ₹47 = ₹902',
        status: 'PASS',
        evidence: `Seller: ₹${finalSeller}, Rider: ₹${finalRider}, Admin Net: ₹${finalAdminNet}, Sum: ₹${sumTotal}`,
      });
    } else {
      throw new Error(`Ledger balance mismatch! Sum: ${sumTotal}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'STEP 6', test: 'Final Accounting Ledger', status: 'FAIL', evidence: err.message });
  }

  // Cleanup test entities
  await Customer.deleteOne({ _id: testCustomer._id });
  await Seller.deleteOne({ _id: testSeller._id });
  await Delivery.deleteOne({ _id: testDriver._id });
  await Product.deleteOne({ _id: testProduct._id });
  await Order.deleteOne({ _id: realOrder._id });
  await OrderItem.deleteOne({ _id: orderItem._id });
  await Commission.deleteMany({ order: realOrder._id });
  await WalletTransaction.deleteMany({ relatedOrder: realOrder._id });
  await CashCollection.deleteMany({ order: realOrder._id });

  console.log(`===============================================================`);
  console.log(`REAL ORDER VERIFICATION SUITE RESULTS`);
  console.log(`===============================================================\n`);

  let allPassed = true;
  for (const result of testResults) {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${result.id}] ${result.test}: ${result.status}`);
    console.log(`   Evidence: ${result.evidence}\n`);
    if (result.status === 'FAIL') allPassed = false;
  }

  if (allPassed) {
    console.log(`🎉 REAL ORDER COD FLOW VERIFICATION PASSED 100% SUCCESSFULLY!\n`);
  } else {
    console.error(`❌ SOME VERIFICATION TESTS FAILED.`);
    process.exit(1);
  }

  await mongoose.disconnect();
}

runRealOrderVerification().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
