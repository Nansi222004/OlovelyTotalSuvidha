/**
 * testAccountDeletionSuite.ts
 *
 * Dedicated Integration Test Suite for Self-Service Account Deletion across all 3 roles:
 * 1. Customer
 * 2. Seller
 * 3. Delivery Partner
 *
 * SAFETY GUARANTEES:
 * - Uses ONLY dedicated test accounts created during test execution with distinct test prefixes.
 * - Asserts connected DB name is "test".
 * - Never modifies real production records.
 * - Does NOT run dropDatabase() or drop().
 * - Cleans up only the dedicated test fixtures.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { generateToken } from '../services/jwtService';

import Customer from '../models/Customer';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import DeliveryAssignment from '../models/DeliveryAssignment';
import WithdrawRequest from '../models/WithdrawRequest';
import Return from '../models/Return';
import Product from '../models/Product';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api/v1';

interface TestResult {
  role: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(role: string, name: string, passed: boolean, details: string) {
  results.push({ role, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${role}] ${icon}: ${name} - ${details}`);
}

async function runSuite() {
  console.log('======================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE SELF-SERVICE ACCOUNT DELETION TEST SUITE');
  console.log('======================================================================');

  const mongoUri = process.env.MONGODB_URI || '';
  if (!mongoUri) throw new Error('MONGODB_URI not found in environment');

  await mongoose.connect(mongoUri);
  const currentDbName = mongoose.connection.name;
  console.log(`Connected to MongoDB database: "${currentDbName}"`);

  if (currentDbName !== 'test') {
    throw new Error(`SAFETY CHECK FAILED: Expected database "test", got "${currentDbName}"`);
  }

  // Define unique test IDs / identifiers
  const testRunId = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
  const testCustPhone = `981000${testRunId}`; // 10 digits
  const testCustEmail = `test_del_cust_${testRunId}@test.com`;

  const testSellerPhone = `982000${testRunId}`; // 10 digits
  const testSellerEmail = `test_del_seller_${testRunId}@test.com`;

  const testDeliveryPhone = `983000${testRunId}`; // 10 digits
  const testDeliveryEmail = `test_del_dp_${testRunId}@test.com`;

  let testCustomerId: string = '';
  let testSellerId: string = '';
  let testDeliveryId: string = '';
  let testProductId: string = '';
  let testOrderId: string = '';
  let testOrderItemId: string = '';
  let testAssignmentId: string = '';
  let testWithdrawalId: string = '';

  let customerToken: string = '';
  let sellerToken: string = '';
  let deliveryToken: string = '';

  try {
    // -------------------------------------------------------------------------
    // SETUP FIXTURES
    // -------------------------------------------------------------------------
    console.log('\n--- Creating Dedicated Test Accounts ---');

    // 1. Create Dedicated Test Customer
    const testCustomer = await Customer.create({
      name: 'Test Deletion Customer',
      phone: testCustPhone,
      email: testCustEmail,
      refCode: `REF${testRunId}`,
      deliveryOtp: '1234',
      status: 'Active',
      registrationDate: new Date(),
      totalOrders: 0,
      totalSpent: 0,
      walletAmount: 0,
    });
    testCustomerId = (testCustomer._id as any).toString();
    customerToken = generateToken(testCustomerId, 'Customer');
    console.log(`Created test customer: ${testCustomerId} (${testCustPhone})`);

    // 2. Create Dedicated Test Seller
    const testSeller = await Seller.create({
      sellerName: 'Test Deletion Seller',
      password: 'TestPassword123!',
      email: testSellerEmail,
      mobile: testSellerPhone,
      storeName: `Test Store ${testRunId}`,
      category: 'Grocery',
      address: '123 Test Street',
      city: 'Delhi',
      requireProductApproval: false,
    });
    testSellerId = (testSeller._id as any).toString();
    sellerToken = generateToken(testSellerId, 'Seller');
    console.log(`Created test seller: ${testSellerId} (${testSellerEmail})`);

    // Create a test product for this seller
    const testProduct = await Product.create({
      productName: `Test Product ${testRunId}`,
      seller: testSeller._id,
      category: new mongoose.Types.ObjectId(),
      brand: new mongoose.Types.ObjectId(),
      galleryImages: [],
      price: 100,
      stock: 10,
      publish: true,
      popular: false,
      dealOfDay: false,
      status: 'Active',
    });
    testProductId = (testProduct._id as any).toString();

    // 3. Create Dedicated Test Delivery Partner
    const testDelivery = await Delivery.create({
      name: 'Test Deletion Delivery Partner',
      mobile: testDeliveryPhone,
      email: testDeliveryEmail,
      password: 'TestPassword123!',
      address: '456 Test Road',
      city: 'Delhi',
      status: 'Active',
      isOnline: false,
      available: 'Not Available',
      balance: 0,
      cashCollected: 0,
      pendingAdminPayout: 0,
      settings: { notifications: true, location: true, sound: true },
    });
    testDeliveryId = (testDelivery._id as any).toString();
    deliveryToken = generateToken(testDeliveryId, 'Delivery');
    console.log(`Created test delivery partner: ${testDeliveryId} (${testDeliveryPhone})`);

    // =========================================================================
    // SECTION 1: CUSTOMER SELF-DELETION TESTS
    // =========================================================================
    console.log('\n--- SECTION 1: Customer Self-Deletion Tests ---');

    // 1.1 Customer Active Orders Restriction
    const activeCustOrder = await Order.create({
      orderNumber: `ORD-CUST-${testRunId}`,
      customer: testCustomer._id,
      customerName: testCustomer.name,
      customerPhone: testCustomer.phone,
      deliveryAddress: {
        address: '123 Test Street',
        city: 'Delhi',
        pincode: '110001',
      },
      items: [],
      subtotal: 100,
      tax: 0,
      shipping: 0,
      platformFee: 0,
      discount: 0,
      total: 100,
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Received',
    });
    testOrderId = (activeCustOrder._id as any).toString();

    const custBlockedRes = await axios.delete(`${API_BASE}/customer/account`, {
      headers: { Authorization: `Bearer ${customerToken}` },
      validateStatus: () => true,
    });
    record(
      'CUSTOMER',
      'Active order blocks customer deletion',
      custBlockedRes.status === 400 && custBlockedRes.data?.success === false,
      `Status: ${custBlockedRes.status}, Message: ${custBlockedRes.data?.message}`
    );

    // Cancel the order so it is no longer active
    activeCustOrder.status = 'Cancelled';
    await activeCustOrder.save();

    // 1.2 Customer Wallet Balance Restriction
    testCustomer.walletAmount = 50;
    await testCustomer.save();

    const custWalletBlockedRes = await axios.delete(`${API_BASE}/customer/account`, {
      headers: { Authorization: `Bearer ${customerToken}` },
      validateStatus: () => true,
    });
    record(
      'CUSTOMER',
      'Positive wallet balance blocks customer deletion',
      custWalletBlockedRes.status === 400 && custWalletBlockedRes.data?.success === false,
      `Status: ${custWalletBlockedRes.status}, Message: ${custWalletBlockedRes.data?.message}`
    );

    testCustomer.walletAmount = 0;
    await testCustomer.save();

    // 1.3 Successful Customer Self-Deletion
    const custDeleteRes = await axios.delete(`${API_BASE}/customer/account`, {
      headers: { Authorization: `Bearer ${customerToken}` },
      validateStatus: () => true,
    });
    record(
      'CUSTOMER',
      'Customer self-deletion succeeds when obligations cleared',
      custDeleteRes.status === 200 && custDeleteRes.data?.success === true,
      `Status: ${custDeleteRes.status}, Message: ${custDeleteRes.data?.message}`
    );

    // 1.4 Customer Document Removed from DB
    const custInDb = await Customer.findById(testCustomerId);
    record(
      'CUSTOMER',
      'Customer document deleted from MongoDB',
      custInDb === null,
      `Found in DB: ${custInDb !== null}`
    );

    // 1.5 Subsequent Customer Request with Old Token returns CUSTOMER_DELETED
    const custOldTokenRes = await axios.get(`${API_BASE}/customer/profile`, {
      headers: { Authorization: `Bearer ${customerToken}` },
      validateStatus: () => true,
    });
    record(
      'CUSTOMER',
      'Old Customer token returns 401 CUSTOMER_DELETED',
      custOldTokenRes.status === 401 && custOldTokenRes.data?.code === 'CUSTOMER_DELETED',
      `Status: ${custOldTokenRes.status}, Code: ${custOldTokenRes.data?.code}`
    );

    // 1.6 Verify Historical Order Preserved
    const orderInDb = await Order.findById(testOrderId);
    record(
      'CUSTOMER',
      'Historical order document is safely preserved',
      orderInDb !== null && orderInDb.customer.toString() === testCustomerId,
      `Order exists: ${orderInDb !== null}, customer: ${orderInDb?.customer}`
    );

    // =========================================================================
    // SECTION 2: SELLER SELF-DELETION TESTS
    // =========================================================================
    console.log('\n--- SECTION 2: Seller Self-Deletion Tests ---');

    // 2.1 Seller Active Order Items Restriction
    const testOrderItem = await OrderItem.create({
      order: activeCustOrder._id,
      product: testProduct._id,
      seller: testSeller._id,
      productName: testProduct.productName,
      unitPrice: 100,
      quantity: 1,
      total: 100,
      subtotal: 100,
      isWholesale: false,
      status: 'Pending',
      sellerStatus: 'Pending',
      commissionRate: 0,
      commissionAmount: 0,
      isReturnable: false,
      returnWindowDays: 0,
    });
    testOrderItemId = (testOrderItem._id as any).toString();

    const sellerBlockedRes = await axios.delete(`${API_BASE}/auth/seller/account`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
      validateStatus: () => true,
    });
    record(
      'SELLER',
      'Active order items block seller deletion',
      sellerBlockedRes.status === 400 && sellerBlockedRes.data?.success === false,
      `Status: ${sellerBlockedRes.status}, Message: ${sellerBlockedRes.data?.message}`
    );

    // Update order item to Delivered
    testOrderItem.status = 'Delivered';
    await testOrderItem.save();

    // 2.2 Seller Pending Withdrawal Restriction
    const sellerWithdrawal = await WithdrawRequest.create({
      userId: testSeller._id,
      userType: 'SELLER',
      amount: 500,
      status: 'Pending',
      paymentMethod: 'Bank Transfer',
      accountDetails: 'Test Account 12345',
    });
    testWithdrawalId = (sellerWithdrawal._id as any).toString();

    const sellerWithdrawalBlockedRes = await axios.delete(`${API_BASE}/auth/seller/account`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
      validateStatus: () => true,
    });
    record(
      'SELLER',
      'Pending withdrawal blocks seller deletion',
      sellerWithdrawalBlockedRes.status === 400 && sellerWithdrawalBlockedRes.data?.success === false,
      `Status: ${sellerWithdrawalBlockedRes.status}, Message: ${sellerWithdrawalBlockedRes.data?.message}`
    );

    await WithdrawRequest.findByIdAndDelete(testWithdrawalId);

    // 2.3 Successful Seller Self-Deletion
    const sellerDeleteRes = await axios.delete(`${API_BASE}/auth/seller/account`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
      validateStatus: () => true,
    });
    record(
      'SELLER',
      'Seller self-deletion succeeds when obligations cleared',
      sellerDeleteRes.status === 200 && sellerDeleteRes.data?.success === true,
      `Status: ${sellerDeleteRes.status}, Message: ${sellerDeleteRes.data?.message}`
    );

    // 2.4 Seller Document Removed from DB
    const sellerInDb = await Seller.findById(testSellerId);
    record(
      'SELLER',
      'Seller document deleted from MongoDB',
      sellerInDb === null,
      `Found in DB: ${sellerInDb !== null}`
    );

    // 2.5 Seller Products Deactivated / Unpublished
    const productInDb = await Product.findById(testProductId);
    record(
      'SELLER',
      'Seller products deactivated/set to Inactive and unpublished',
      productInDb !== null && productInDb.status === 'Inactive' && productInDb.publish === false,
      `Product status: ${productInDb?.status}, publish: ${productInDb?.publish}`
    );

    // 2.6 Subsequent Seller Request with Old Token returns SELLER_DELETED
    const sellerOldTokenRes = await axios.get(`${API_BASE}/auth/seller/profile`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
      validateStatus: () => true,
    });
    record(
      'SELLER',
      'Old Seller token returns 401 SELLER_DELETED',
      sellerOldTokenRes.status === 401 && sellerOldTokenRes.data?.code === 'SELLER_DELETED',
      `Status: ${sellerOldTokenRes.status}, Code: ${sellerOldTokenRes.data?.code}`
    );

    // =========================================================================
    // SECTION 3: DELIVERY PARTNER SELF-DELETION TESTS
    // =========================================================================
    console.log('\n--- SECTION 3: Delivery Partner Self-Deletion Tests ---');

    // 3.1 Delivery Partner Active Assignment Restriction
    const dpAssignment = await DeliveryAssignment.create({
      order: activeCustOrder._id,
      deliveryBoy: testDelivery._id,
      assignedAt: new Date(),
      assignedBy: new mongoose.Types.ObjectId(),
      status: 'In Transit',
    });
    testAssignmentId = (dpAssignment._id as any).toString();

    const dpBlockedRes = await axios.delete(`${API_BASE}/delivery/account`, {
      headers: { Authorization: `Bearer ${deliveryToken}` },
      validateStatus: () => true,
    });
    record(
      'DELIVERY',
      'Active delivery assignment blocks delivery partner deletion',
      dpBlockedRes.status === 400 && dpBlockedRes.data?.success === false,
      `Status: ${dpBlockedRes.status}, Message: ${dpBlockedRes.data?.message}`
    );

    // Clear active delivery assignment
    dpAssignment.status = 'Delivered';
    await dpAssignment.save();

    // 3.2 Delivery Partner Cash Collected Restriction
    testDelivery.cashCollected = 250;
    await testDelivery.save();

    const dpCashBlockedRes = await axios.delete(`${API_BASE}/delivery/account`, {
      headers: { Authorization: `Bearer ${deliveryToken}` },
      validateStatus: () => true,
    });
    record(
      'DELIVERY',
      'Unremitted cash collected blocks delivery partner deletion',
      dpCashBlockedRes.status === 400 && dpCashBlockedRes.data?.success === false,
      `Status: ${dpCashBlockedRes.status}, Message: ${dpCashBlockedRes.data?.message}`
    );

    testDelivery.cashCollected = 0;
    await testDelivery.save();

    // 3.3 Successful Delivery Partner Self-Deletion
    const dpDeleteRes = await axios.delete(`${API_BASE}/delivery/account`, {
      headers: { Authorization: `Bearer ${deliveryToken}` },
      validateStatus: () => true,
    });
    record(
      'DELIVERY',
      'Delivery partner self-deletion succeeds when obligations cleared',
      dpDeleteRes.status === 200 && dpDeleteRes.data?.success === true,
      `Status: ${dpDeleteRes.status}, Message: ${dpDeleteRes.data?.message}`
    );

    // 3.4 Delivery Partner Document Removed from DB
    const dpInDb = await Delivery.findById(testDeliveryId);
    record(
      'DELIVERY',
      'Delivery Partner document deleted from MongoDB',
      dpInDb === null,
      `Found in DB: ${dpInDb !== null}`
    );

    // 3.5 Subsequent Delivery Partner Request returns DELIVERY_PARTNER_DELETED
    const dpOldTokenRes = await axios.get(`${API_BASE}/auth/delivery/profile`, {
      headers: { Authorization: `Bearer ${deliveryToken}` },
      validateStatus: () => true,
    });
    record(
      'DELIVERY',
      'Old Delivery Partner token returns 401 DELIVERY_PARTNER_DELETED',
      dpOldTokenRes.status === 401 && dpOldTokenRes.data?.code === 'DELIVERY_PARTNER_DELETED',
      `Status: ${dpOldTokenRes.status}, Code: ${dpOldTokenRes.data?.code}`
    );

    // =========================================================================
    // SECTION 4: NEGATIVE & SECURITY TESTS
    // =========================================================================
    console.log('\n--- SECTION 4: Negative & Security Tests ---');

    // Create a fresh customer, seller, and delivery partner for cross-role testing
    const securityCust = await Customer.create({
      name: 'Security Test Customer',
      phone: `984000${testRunId}`,
      email: `security_cust_${testRunId}@test.com`,
      refCode: `REFC${testRunId}`,
      deliveryOtp: '1234',
      status: 'Active',
      registrationDate: new Date(),
    });
    const secCustToken = generateToken(securityCust._id.toString(), 'Customer');

    const securitySeller = await Seller.create({
      sellerName: 'Security Test Seller',
      password: 'TestPassword123!',
      email: `security_seller_${testRunId}@test.com`,
      mobile: `985000${testRunId}`,
      storeName: `Security Store ${testRunId}`,
      category: 'Grocery',
      address: 'Security St',
      city: 'Delhi',
      requireProductApproval: false,
    });
    const secSellerToken = generateToken(securitySeller._id.toString(), 'Seller');

    const securityDp = await Delivery.create({
      name: 'Security Test DP',
      mobile: `986000${testRunId}`,
      email: `security_dp_${testRunId}@test.com`,
      password: 'TestPassword123!',
      address: 'Security Rd',
      city: 'Delhi',
      status: 'Active',
      isOnline: false,
      available: 'Not Available',
      balance: 0,
      cashCollected: 0,
      pendingAdminPayout: 0,
      settings: { notifications: true, location: true, sound: true },
    });
    const secDpToken = generateToken(securityDp._id.toString(), 'Delivery');

    // 4.1 Cross-Role: Customer cannot delete Seller
    const custOnSellerRes = await axios.delete(`${API_BASE}/auth/seller/account`, {
      headers: { Authorization: `Bearer ${secCustToken}` },
      validateStatus: () => true,
    });
    record(
      'SECURITY',
      'Customer token CANNOT delete Seller account',
      custOnSellerRes.status === 403 || custOnSellerRes.status === 401,
      `Status: ${custOnSellerRes.status}`
    );

    // 4.2 Cross-Role: Customer cannot delete Delivery Partner
    const custOnDpRes = await axios.delete(`${API_BASE}/delivery/account`, {
      headers: { Authorization: `Bearer ${secCustToken}` },
      validateStatus: () => true,
    });
    record(
      'SECURITY',
      'Customer token CANNOT delete Delivery Partner account',
      custOnDpRes.status === 403 || custOnDpRes.status === 401,
      `Status: ${custOnDpRes.status}`
    );

    // 4.3 Cross-Role: Seller cannot delete Customer
    const sellerOnCustRes = await axios.delete(`${API_BASE}/customer/account`, {
      headers: { Authorization: `Bearer ${secSellerToken}` },
      validateStatus: () => true,
    });
    record(
      'SECURITY',
      'Seller token CANNOT delete Customer account',
      sellerOnCustRes.status === 403 || sellerOnCustRes.status === 401,
      `Status: ${sellerOnCustRes.status}`
    );

    // 4.4 Cross-Role: Seller cannot delete Delivery Partner
    const sellerOnDpRes = await axios.delete(`${API_BASE}/delivery/account`, {
      headers: { Authorization: `Bearer ${secSellerToken}` },
      validateStatus: () => true,
    });
    record(
      'SECURITY',
      'Seller token CANNOT delete Delivery Partner account',
      sellerOnDpRes.status === 403 || sellerOnDpRes.status === 401,
      `Status: ${sellerOnDpRes.status}`
    );

    // 4.5 Cross-Role: Delivery Partner cannot delete Customer
    const dpOnCustRes = await axios.delete(`${API_BASE}/customer/account`, {
      headers: { Authorization: `Bearer ${secDpToken}` },
      validateStatus: () => true,
    });
    record(
      'SECURITY',
      'Delivery Partner token CANNOT delete Customer account',
      dpOnCustRes.status === 403 || dpOnCustRes.status === 401,
      `Status: ${dpOnCustRes.status}`
    );

    // 4.6 Cross-Role: Delivery Partner cannot delete Seller
    const dpOnSellerRes = await axios.delete(`${API_BASE}/auth/seller/account`, {
      headers: { Authorization: `Bearer ${secDpToken}` },
      validateStatus: () => true,
    });
    record(
      'SECURITY',
      'Delivery Partner token CANNOT delete Seller account',
      dpOnSellerRes.status === 403 || dpOnSellerRes.status === 401,
      `Status: ${dpOnSellerRes.status}`
    );

    // 4.7 Unauthenticated requests
    const unauthCustRes = await axios.delete(`${API_BASE}/customer/account`, { validateStatus: () => true });
    record('SECURITY', 'Unauthenticated Customer delete rejected (401)', unauthCustRes.status === 401, `Status: ${unauthCustRes.status}`);

    const unauthSellerRes = await axios.delete(`${API_BASE}/auth/seller/account`, { validateStatus: () => true });
    record('SECURITY', 'Unauthenticated Seller delete rejected (401)', unauthSellerRes.status === 401, `Status: ${unauthSellerRes.status}`);

    const unauthDpRes = await axios.delete(`${API_BASE}/delivery/account`, { validateStatus: () => true });
    record('SECURITY', 'Unauthenticated Delivery delete rejected (401)', unauthDpRes.status === 401, `Status: ${unauthDpRes.status}`);

    // 4.8 Invalid token
    const invalidTokenRes = await axios.delete(`${API_BASE}/customer/account`, {
      headers: { Authorization: 'Bearer invalid.token.value' },
      validateStatus: () => true,
    });
    record('SECURITY', 'Invalid token is rejected (401)', invalidTokenRes.status === 401, `Status: ${invalidTokenRes.status}`);

    // 4.9 Double-deletion protection (calling delete on already deleted customer)
    const doubleCustDeleteRes = await axios.delete(`${API_BASE}/customer/account`, {
      headers: { Authorization: `Bearer ${customerToken}` },
      validateStatus: () => true,
    });
    record(
      'SECURITY',
      'Repeated delete on already deleted customer safely rejected (401)',
      doubleCustDeleteRes.status === 401 && doubleCustDeleteRes.data?.code === 'CUSTOMER_DELETED',
      `Status: ${doubleCustDeleteRes.status}, Code: ${doubleCustDeleteRes.data?.code}`
    );

    // Clean up security test accounts
    await Customer.findByIdAndDelete(securityCust._id);
    await Seller.findByIdAndDelete(securitySeller._id);
    await Delivery.findByIdAndDelete(securityDp._id);

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP TARGETED TEST FIXTURES ONLY
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up dedicated test fixtures ---');
    if (testCustomerId) await Customer.findByIdAndDelete(testCustomerId);
    if (testSellerId) await Seller.findByIdAndDelete(testSellerId);
    if (testDeliveryId) await Delivery.findByIdAndDelete(testDeliveryId);
    if (testProductId) await Product.findByIdAndDelete(testProductId);
    if (testOrderItemId) await OrderItem.findByIdAndDelete(testOrderItemId);
    if (testAssignmentId) await DeliveryAssignment.findByIdAndDelete(testAssignmentId);
    if (testWithdrawalId) await WithdrawRequest.findByIdAndDelete(testWithdrawalId);
    if (testOrderId) await Order.findByIdAndDelete(testOrderId);
    // Also clean up any orders created during test
    await Order.deleteMany({ orderNumber: { $regex: testRunId } });

    await mongoose.disconnect();
    console.log('MongoDB disconnected cleanly.');
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n======================================================================');
  console.log('📊 TEST SUMMARY RESULTS');
  console.log('======================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Tests : ${total}`);
  console.log(`Passed      : ${passed}`);
  console.log(`Failed      : ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(` - [${r.role}] ${r.name}: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n✨ ALL TESTS PASSED SUCCESSFULLY! ✨');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
