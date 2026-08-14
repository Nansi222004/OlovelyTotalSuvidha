import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import Admin from '../models/Admin';
import Seller from '../models/Seller';
import Customer from '../models/Customer';
import Otp from '../models/Otp';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api/v1`;

// Test results storage
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];
let testUsers: {
  admin: { id: string; mobile: string; email: string; role: string }[];
  seller: { id: string; mobile: string; email: string }[];
  customer: { id: string; mobile: string; email: string }[];
} = {
  admin: [],
  seller: [],
  customer: [],
};

// Helper function to add test result
function addResult(name: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
  testResults.push({ name, status, message, details });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⊘';
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  console.log(`${color}${icon}\x1b[0m ${name}: ${message}`);
  if (details && status === 'FAIL') {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

// Helper function to make API requests
async function apiRequest(method: 'GET' | 'POST', endpoint: string, data?: any, token?: string) {
  try {
    const config: any = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (data) {
      config.data = data;
    }
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    return {
      success: false,
      data: error.response?.data || { message: error.message },
      status: error.response?.status || 500,
    };
  }
}

// Cleanup function - delete test users
async function cleanupTestUsers() {
  try {
    // Delete test admins
    await Admin.deleteMany({ mobile: { $regex: /^9\d{9}$/ } });
    // Delete test sellers
    await Seller.deleteMany({ mobile: { $regex: /^8\d{9}$/ } });
    // Delete test customers
    await Customer.deleteMany({ phone: { $regex: /^7\d{9}$/ } });
    // Delete test OTPs
    await Otp.deleteMany({ mobile: { $regex: /^[789]\d{9}$/ } });
    addResult('Cleanup', 'PASS', 'Test users cleaned up');
  } catch (error: any) {
    addResult('Cleanup', 'FAIL', `Failed to cleanup: ${error.message}`);
  }
}

// ==================== ADMIN TESTS ====================

async function testAdminRegistration() {
  console.log('\n📋 Testing Admin Registration...');

  // Test 1: Register Super Admin
  const superAdminData = {
    firstName: 'Super',
    lastName: 'Admin',
    mobile: '9000000001',
    email: 'superadmin@test.com',
    password: 'password123',
    role: 'Super Admin',
  };
  let result = await apiRequest('POST', '/auth/admin/register', superAdminData);
  if (result.success && result.data.success) {
    testUsers.admin.push({
      id: result.data.data.user.id,
      mobile: superAdminData.mobile,
      email: superAdminData.email,
      role: 'Super Admin',
    });
    addResult('Admin Register - Super Admin', 'PASS', 'Super Admin registered successfully');
  } else {
    addResult('Admin Register - Super Admin', 'FAIL', 'Failed to register Super Admin', result.data);
  }

  // Test 2: Register Regular Admin
  const adminData = {
    firstName: 'Regular',
    lastName: 'Admin',
    mobile: '9000000002',
    email: 'admin@test.com',
    password: 'password123',
    role: 'Admin',
  };
  result = await apiRequest('POST', '/auth/admin/register', adminData);
  if (result.success && result.data.success) {
    testUsers.admin.push({
      id: result.data.data.user.id,
      mobile: adminData.mobile,
      email: adminData.email,
      role: 'Admin',
    });
    addResult('Admin Register - Regular Admin', 'PASS', 'Regular Admin registered successfully');
  } else {
    addResult('Admin Register - Regular Admin', 'FAIL', 'Failed to register Admin', result.data);
  }

  // Test 3: Duplicate mobile registration
  result = await apiRequest('POST', '/auth/admin/register', adminData);
  if (!result.success && result.status === 409) {
    addResult('Admin Register - Duplicate Mobile', 'PASS', 'Correctly rejected duplicate mobile');
  } else {
    addResult('Admin Register - Duplicate Mobile', 'FAIL', 'Should reject duplicate mobile', result.data);
  }

  // Test 4: Invalid mobile format
  result = await apiRequest('POST', '/auth/admin/register', {
    ...adminData,
    mobile: '12345',
  });
  if (!result.success && result.status === 400) {
    addResult('Admin Register - Invalid Mobile', 'PASS', 'Correctly rejected invalid mobile format');
  } else {
    addResult('Admin Register - Invalid Mobile', 'FAIL', 'Should reject invalid mobile', result.data);
  }

  // Test 5: Missing required fields
  result = await apiRequest('POST', '/auth/admin/register', {
    firstName: 'Test',
  });
  if (!result.success && result.status === 400) {
    addResult('Admin Register - Missing Fields', 'PASS', 'Correctly rejected missing fields');
  } else {
    addResult('Admin Register - Missing Fields', 'FAIL', 'Should reject missing fields', result.data);
  }
}

async function testAdminSendOTP() {
  console.log('\n📋 Testing Admin Send OTP...');

  if (testUsers.admin.length === 0) {
    addResult('Admin Send OTP', 'SKIP', 'No admin users available');
    return;
  }

  const admin = testUsers.admin[0];

  // Test 1: Send OTP to existing admin
  let result = await apiRequest('POST', '/auth/admin/send-otp', { mobile: admin.mobile });
  if (result.success && result.data.success) {
    addResult('Admin Send OTP - Valid Mobile', 'PASS', 'OTP sent successfully');
  } else {
    addResult('Admin Send OTP - Valid Mobile', 'FAIL', 'Failed to send OTP', result.data);
  }

  // Test 2: Send OTP to non-existent admin
  result = await apiRequest('POST', '/auth/admin/send-otp', { mobile: '9999999999' });
  if (!result.success && result.status === 404) {
    addResult('Admin Send OTP - Non-existent Mobile', 'PASS', 'Correctly rejected non-existent admin');
  } else {
    addResult('Admin Send OTP - Non-existent Mobile', 'FAIL', 'Should reject non-existent admin', result.data);
  }

  // Test 3: Invalid mobile format
  result = await apiRequest('POST', '/auth/admin/send-otp', { mobile: '12345' });
  if (!result.success && result.status === 400) {
    addResult('Admin Send OTP - Invalid Format', 'PASS', 'Correctly rejected invalid mobile format');
  } else {
    addResult('Admin Send OTP - Invalid Format', 'FAIL', 'Should reject invalid format', result.data);
  }

  // Test 4: Missing mobile
  result = await apiRequest('POST', '/auth/admin/send-otp', {});
  if (!result.success && result.status === 400) {
    addResult('Admin Send OTP - Missing Mobile', 'PASS', 'Correctly rejected missing mobile');
  } else {
    addResult('Admin Send OTP - Missing Mobile', 'FAIL', 'Should reject missing mobile', result.data);
  }
}

async function testAdminVerifyOTP() {
  console.log('\n📋 Testing Admin Verify OTP (Login)...');

  if (testUsers.admin.length === 0) {
    addResult('Admin Verify OTP', 'SKIP', 'No admin users available');
    return;
  }

  const admin = testUsers.admin[0];

  // First, send OTP
  await apiRequest('POST', '/auth/admin/send-otp', { mobile: admin.mobile });

  // Wait for OTP to be saved to database
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Debug: Check if OTP exists in database
  const otpRecord = await Otp.findOne({ mobile: admin.mobile, userType: 'Admin', isVerified: false }).sort({ createdAt: -1 });
  if (!otpRecord) {
    addResult('Admin Verify OTP - Valid OTP', 'FAIL', 'OTP not found in database after sending', { mobile: admin.mobile });
    return;
  }

  // Use the actual OTP from database instead of hardcoded value
  const actualOTP = otpRecord.otp;

  // Test 1: Verify with correct OTP
  let result = await apiRequest('POST', '/auth/admin/verify-otp', {
    mobile: admin.mobile,
    otp: actualOTP,
  });
  if (result.success && result.data.success && result.data.data.token) {
    addResult('Admin Verify OTP - Valid OTP', 'PASS', 'Login successful with valid OTP');
  } else {
    addResult('Admin Verify OTP - Valid OTP', 'FAIL', 'Failed to login with valid OTP', result.data);
  }

  // Send OTP again for next test
  await apiRequest('POST', '/auth/admin/send-otp', { mobile: admin.mobile });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Verify with incorrect OTP
  result = await apiRequest('POST', '/auth/admin/verify-otp', {
    mobile: admin.mobile,
    otp: '000000',
  });
  if (!result.success && result.status === 401) {
    addResult('Admin Verify OTP - Invalid OTP', 'PASS', 'Correctly rejected invalid OTP');
  } else {
    addResult('Admin Verify OTP - Invalid OTP', 'FAIL', 'Should reject invalid OTP', result.data);
  }

  // Test 3: Invalid mobile format
  result = await apiRequest('POST', '/auth/admin/verify-otp', {
    mobile: '12345',
    otp: '123456',
  });
  if (!result.success && result.status === 400) {
    addResult('Admin Verify OTP - Invalid Mobile', 'PASS', 'Correctly rejected invalid mobile');
  } else {
    addResult('Admin Verify OTP - Invalid Mobile', 'FAIL', 'Should reject invalid mobile', result.data);
  }

  // Test 4: Invalid OTP format
  result = await apiRequest('POST', '/auth/admin/verify-otp', {
    mobile: admin.mobile,
    otp: '123',
  });
  if (!result.success && result.status === 400) {
    addResult('Admin Verify OTP - Invalid OTP Format', 'PASS', 'Correctly rejected invalid OTP format');
  } else {
    addResult('Admin Verify OTP - Invalid OTP Format', 'FAIL', 'Should reject invalid OTP format', result.data);
  }
}

// ==================== SELLER TESTS ====================

async function testSellerRegistration() {
  console.log('\n📋 Testing Seller Registration...');

  const sellerData = {
    sellerName: 'Test Seller',
    mobile: '8000000001',
    email: 'seller1@test.com',
    password: 'password123',
    storeName: 'Test Store',
    category: 'Electronics',
    address: '',
    city: '',
    serviceableArea: 'Test Area',
  };

  // Test 1: Register seller
  let result = await apiRequest('POST', '/auth/seller/register', sellerData);
  if (result.success && result.data.success) {
    testUsers.seller.push({
      id: result.data.data.user.id,
      mobile: sellerData.mobile,
      email: sellerData.email,
    });
    addResult('Seller Register - Valid Data', 'PASS', 'Seller registered successfully');
  } else {
    addResult('Seller Register - Valid Data', 'FAIL', 'Failed to register seller', result.data);
  }

  // Test 2: Duplicate mobile
  result = await apiRequest('POST', '/auth/seller/register', sellerData);
  if (!result.success && result.status === 409) {
    addResult('Seller Register - Duplicate Mobile', 'PASS', 'Correctly rejected duplicate mobile');
  } else {
    addResult('Seller Register - Duplicate Mobile', 'FAIL', 'Should reject duplicate mobile', result.data);
  }

  // Test 3: Missing required fields
  result = await apiRequest('POST', '/auth/seller/register', {
    sellerName: 'Test',
  });
  if (!result.success && result.status === 400) {
    addResult('Seller Register - Missing Fields', 'PASS', 'Correctly rejected missing fields');
  } else {
    addResult('Seller Register - Missing Fields', 'FAIL', 'Should reject missing fields', result.data);
  }
}

async function testSellerSendOTP() {
  console.log('\n📋 Testing Seller Send OTP...');

  if (testUsers.seller.length === 0) {
    addResult('Seller Send OTP', 'SKIP', 'No seller users available');
    return;
  }

  const seller = testUsers.seller[0];

  // Test 1: Send OTP to existing seller
  let result = await apiRequest('POST', '/auth/seller/send-otp', { mobile: seller.mobile });
  if (result.success && result.data.success) {
    addResult('Seller Send OTP - Valid Mobile', 'PASS', 'OTP sent successfully');
  } else {
    addResult('Seller Send OTP - Valid Mobile', 'FAIL', 'Failed to send OTP', result.data);
  }

  // Test 2: Non-existent seller
  result = await apiRequest('POST', '/auth/seller/send-otp', { mobile: '8999999999' });
  if (!result.success && result.status === 404) {
    addResult('Seller Send OTP - Non-existent Mobile', 'PASS', 'Correctly rejected non-existent seller');
  } else {
    addResult('Seller Send OTP - Non-existent Mobile', 'FAIL', 'Should reject non-existent seller', result.data);
  }
}

async function testSellerVerifyOTP() {
  console.log('\n📋 Testing Seller Verify OTP (Login)...');

  if (testUsers.seller.length === 0) {
    addResult('Seller Verify OTP', 'SKIP', 'No seller users available');
    return;
  }

  const seller = testUsers.seller[0];

  // Send OTP first
  await apiRequest('POST', '/auth/seller/send-otp', { mobile: seller.mobile });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Debug: Check if OTP exists in database
  const otpRecord = await Otp.findOne({ mobile: seller.mobile, userType: 'Seller', isVerified: false }).sort({ createdAt: -1 });
  if (!otpRecord) {
    addResult('Seller Verify OTP - Valid OTP', 'FAIL', 'OTP not found in database after sending', { mobile: seller.mobile });
    return;
  }

  // Use the actual OTP from database instead of hardcoded value
  const actualOTP = otpRecord.otp;

  // Test 1: Verify with correct OTP
  let result = await apiRequest('POST', '/auth/seller/verify-otp', {
    mobile: seller.mobile,
    otp: actualOTP,
  });
  if (result.success && result.data.success && result.data.data.token) {
    addResult('Seller Verify OTP - Valid OTP', 'PASS', 'Login successful with valid OTP');
  } else {
    addResult('Seller Verify OTP - Valid OTP', 'FAIL', 'Failed to login with valid OTP', result.data);
  }

  // Send OTP again
  await apiRequest('POST', '/auth/seller/send-otp', { mobile: seller.mobile });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Invalid OTP
  result = await apiRequest('POST', '/auth/seller/verify-otp', {
    mobile: seller.mobile,
    otp: '000000',
  });
  if (!result.success && result.status === 401) {
    addResult('Seller Verify OTP - Invalid OTP', 'PASS', 'Correctly rejected invalid OTP');
  } else {
    addResult('Seller Verify OTP - Invalid OTP', 'FAIL', 'Should reject invalid OTP', result.data);
  }
}

// ==================== CUSTOMER TESTS ====================

async function testCustomerRegistration() {
  console.log('\n📋 Testing Customer Registration...');

  const customerData = {
    name: 'Test Customer',
    mobile: '7000000001',
    email: 'customer1@test.com',
    dateOfBirth: '1990-01-01',
  };

  // Test 1: Register customer
  let result = await apiRequest('POST', '/auth/customer/register', customerData);
  if (result.success && result.data.success) {
    testUsers.customer.push({
      id: result.data.data.user.id,
      mobile: customerData.mobile,
      email: customerData.email,
    });
    addResult('Customer Register - Valid Data', 'PASS', 'Customer registered successfully');
  } else {
    addResult('Customer Register - Valid Data', 'FAIL', 'Failed to register customer', result.data);
  }

  // Test 2: Duplicate mobile
  result = await apiRequest('POST', '/auth/customer/register', customerData);
  if (!result.success && result.status === 409) {
    addResult('Customer Register - Duplicate Mobile', 'PASS', 'Correctly rejected duplicate mobile');
  } else {
    addResult('Customer Register - Duplicate Mobile', 'FAIL', 'Should reject duplicate mobile', result.data);
  }

  // Test 3: Missing required fields
  result = await apiRequest('POST', '/auth/customer/register', {
    name: 'Test',
  });
  if (!result.success && result.status === 400) {
    addResult('Customer Register - Missing Fields', 'PASS', 'Correctly rejected missing fields');
  } else {
    addResult('Customer Register - Missing Fields', 'FAIL', 'Should reject missing fields', result.data);
  }
}

async function testCustomerSendOTP() {
  console.log('\n📋 Testing Customer Send OTP...');

  if (testUsers.customer.length === 0) {
    addResult('Customer Send OTP', 'SKIP', 'No customer users available');
    return;
  }

  const customer = testUsers.customer[0];

  // Test 1: Send OTP to existing customer
  let result = await apiRequest('POST', '/auth/customer/send-sms-otp', { mobile: customer.mobile });
  if (result.success && result.data.success) {
    addResult('Customer Send OTP - Valid Mobile', 'PASS', 'OTP sent successfully');
  } else {
    addResult('Customer Send OTP - Valid Mobile', 'FAIL', 'Failed to send OTP', result.data);
  }

  // Test 2: Non-existent customer
  result = await apiRequest('POST', '/auth/customer/send-sms-otp', { mobile: '7999999999' });
  if (!result.success && result.status === 404) {
    addResult('Customer Send OTP - Non-existent Mobile', 'PASS', 'Correctly rejected non-existent customer');
  } else {
    addResult('Customer Send OTP - Non-existent Mobile', 'FAIL', 'Should reject non-existent customer', result.data);
  }
}

async function testCustomerVerifyOTP() {
  console.log('\n📋 Testing Customer Verify OTP (Login)...');

  if (testUsers.customer.length === 0) {
    addResult('Customer Verify OTP', 'SKIP', 'No customer users available');
    return;
  }

  const customer = testUsers.customer[0];

  // Send OTP first
  const sendResult = await apiRequest('POST', '/auth/customer/send-sms-otp', { mobile: customer.mobile });
  const sessionId = sendResult.data?.sessionId;
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Debug: Check if OTP exists in database
  const otpRecord = await Otp.findOne({ mobile: customer.mobile, userType: 'Customer', isVerified: false }).sort({ createdAt: -1 });
  if (!otpRecord) {
    addResult('Customer Verify OTP - Valid OTP', 'FAIL', 'OTP not found in database after sending', { mobile: customer.mobile });
    return;
  }

  // Use the actual OTP from database instead of hardcoded value
  const actualOTP = otpRecord.otp;

  // Test 1: Verify with correct OTP
  let result = await apiRequest('POST', '/auth/customer/verify-sms-otp', {
    mobile: customer.mobile,
    otp: actualOTP,
    sessionId: sessionId || 'OTP_SESSION_' + customer.mobile,
  });
  if (result.success && result.data.success && result.data.data.token) {
    addResult('Customer Verify OTP - Valid OTP', 'PASS', 'Login successful with valid OTP');
  } else {
    addResult('Customer Verify OTP - Valid OTP', 'FAIL', 'Failed to login with valid OTP', result.data);
  }

  // Send OTP again
  const sendResult2 = await apiRequest('POST', '/auth/customer/send-sms-otp', { mobile: customer.mobile });
  const sessionId2 = sendResult2.data?.sessionId;
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Invalid OTP
  result = await apiRequest('POST', '/auth/customer/verify-sms-otp', {
    mobile: customer.mobile,
    otp: '000000',
    sessionId: sessionId2 || 'OTP_SESSION_' + customer.mobile,
  });
  if (!result.success && result.status === 401) {
    addResult('Customer Verify OTP - Invalid OTP', 'PASS', 'Correctly rejected invalid OTP');
  } else {
    addResult('Customer Verify OTP - Invalid OTP', 'FAIL', 'Should reject invalid OTP', result.data);
  }
}

// ==================== DELETE TESTS ====================

async function testDeleteUsers() {
  console.log('\n📋 Testing User Deletion...');

  try {
    // Delete test admins
    const adminDeleteResult = await Admin.deleteMany({
      _id: { $in: testUsers.admin.map((u) => new mongoose.Types.ObjectId(u.id)) },
    });
    if (adminDeleteResult.deletedCount > 0) {
      addResult('Delete - Admin Users', 'PASS', `Deleted ${adminDeleteResult.deletedCount} admin(s)`);
    } else {
      addResult('Delete - Admin Users', 'SKIP', 'No admins to delete');
    }

    // Delete test sellers
    const sellerDeleteResult = await Seller.deleteMany({
      _id: { $in: testUsers.seller.map((u) => new mongoose.Types.ObjectId(u.id)) },
    });
    if (sellerDeleteResult.deletedCount > 0) {
      addResult('Delete - Seller Users', 'PASS', `Deleted ${sellerDeleteResult.deletedCount} seller(s)`);
    } else {
      addResult('Delete - Seller Users', 'SKIP', 'No sellers to delete');
    }

    // Delete test customers
    const customerDeleteResult = await Customer.deleteMany({
      _id: { $in: testUsers.customer.map((u) => new mongoose.Types.ObjectId(u.id)) },
    });
    if (customerDeleteResult.deletedCount > 0) {
      addResult('Delete - Customer Users', 'PASS', `Deleted ${customerDeleteResult.deletedCount} customer(s)`);
    } else {
      addResult('Delete - Customer Users', 'SKIP', 'No customers to delete');
    }

    // Verify deletion
    const remainingAdmins = await Admin.countDocuments({
      _id: { $in: testUsers.admin.map((u) => new mongoose.Types.ObjectId(u.id)) },
    });
    const remainingSellers = await Seller.countDocuments({
      _id: { $in: testUsers.seller.map((u) => new mongoose.Types.ObjectId(u.id)) },
    });
    const remainingCustomers = await Customer.countDocuments({
      _id: { $in: testUsers.customer.map((u) => new mongoose.Types.ObjectId(u.id)) },
    });

    if (remainingAdmins === 0 && remainingSellers === 0 && remainingCustomers === 0) {
      addResult('Delete - Verification', 'PASS', 'All test users successfully deleted');
    } else {
      addResult('Delete - Verification', 'FAIL', `Some users still exist: Admins: ${remainingAdmins}, Sellers: ${remainingSellers}, Customers: ${remainingCustomers}`);
    }
  } catch (error: any) {
    addResult('Delete - Error', 'FAIL', `Failed to delete users: ${error.message}`);
  }
}

// ==================== MAIN TEST RUNNER ====================

async function runTests() {
  console.log('\n🚀 Starting Authentication Test Suite...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Base: ${API_BASE}\n`);

  // Connect to MongoDB
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB\n');
  } catch (error: any) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }

  // Cleanup before tests
  await cleanupTestUsers();

  // Run all tests
  try {
    // Admin tests
    await testAdminRegistration();
    await testAdminSendOTP();
    await testAdminVerifyOTP();

    // Seller tests
    await testSellerRegistration();
    await testSellerSendOTP();
    await testSellerVerifyOTP();

    // Customer tests
    await testCustomerRegistration();
    await testCustomerSendOTP();
    await testCustomerVerifyOTP();

    // Delete tests
    await testDeleteUsers();

    // Final cleanup
    await cleanupTestUsers();
  } catch (error: any) {
    console.error('❌ Test execution error:', error.message);
  }

  // Generate report
  generateReport();

  // Close MongoDB connection
  await mongoose.connection.close();
  console.log('\n✓ MongoDB connection closed');
}

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST REPORT');
  console.log('='.repeat(80));

  const passed = testResults.filter((r) => r.status === 'PASS').length;
  const failed = testResults.filter((r) => r.status === 'FAIL').length;
  const skipped = testResults.filter((r) => r.status === 'SKIP').length;
  const total = testResults.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`\x1b[32m✓ Passed: ${passed}\x1b[0m`);
  console.log(`\x1b[31m✗ Failed: ${failed}\x1b[0m`);
  console.log(`\x1b[33m⊘ Skipped: ${skipped}\x1b[0m`);
  console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(2)}%`);

  if (failed > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('❌ FAILED TESTS:');
    console.log('-'.repeat(80));
    testResults
      .filter((r) => r.status === 'FAIL')
      .forEach((result) => {
        console.log(`\n✗ ${result.name}`);
        console.log(`  Message: ${result.message}`);
        if (result.details) {
          console.log(`  Details: ${JSON.stringify(result.details, null, 2)}`);
        }
      });
  }

  console.log('\n' + '='.repeat(80));
  console.log('Test Suite Completed');
  console.log('='.repeat(80) + '\n');

  // Save report to file
  const report = {
    summary: {
      total,
      passed,
      failed,
      skipped,
      successRate: `${((passed / total) * 100).toFixed(2)}%`,
    },
    results: testResults,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
  console.log('📄 Detailed report saved to: test-report.json\n');
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


