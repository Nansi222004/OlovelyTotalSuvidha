import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import connectDB from '../config/db';
import Seller from '../models/Seller';
import Admin from '../models/Admin';
import { sendOTP as sendOTPService, verifyOTP as verifyOTPService } from '../services/otpService';
import { generateToken } from '../services/jwtService';

// Load environment variables
dotenv.config();

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const API_BASE = `${BACKEND_URL}/api/v1`;

// Test results storage
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];

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
async function apiRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  token?: string
) {
  try {
    const config: any = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    const axiosError = error as AxiosError;
    return {
      success: false,
      data: axiosError.response?.data || { message: error.message },
      status: axiosError.response?.status || 500,
      error: error.message,
    };
  }
}

// Get admin token for testing
async function getAdminToken(): Promise<string | null> {
  try {
    // Use default admin or create test admin
    const adminMobile = '9000000001';
    let admin = await Admin.findOne({ mobile: adminMobile });

    if (!admin) {
      admin = await Admin.create({
        firstName: 'Test',
        lastName: 'Admin',
        mobile: adminMobile,
        email: `testadmin${Date.now()}@test.com`,
        password: 'Test123!',
        role: 'Admin',
      });
    }

    // Send OTP
    await sendOTPService(adminMobile, 'Admin', true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get OTP from database
    const otpRecord = await (await import('../models/Otp')).default.findOne({
      mobile: adminMobile,
      userType: 'Admin',
      isVerified: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return null;
    }

    // Verify OTP and get token
    const isValid = await verifyOTPService(adminMobile, otpRecord.otp, 'Admin');
    if (!isValid) {
      return null;
    }

    // Generate token
    const token = generateToken(admin._id.toString(), 'Admin', admin.role);
    return token;
  } catch (error: any) {
    console.error('Error getting admin token:', error);
    return null;
  }
}

// Test Vendor Approval Flow
async function testVendorApproval() {
  console.log('\n🏪 Testing Vendor Approval Functionality...\n');

  let adminToken: string | null = null;
  let testSellerId: string | null = null;

  try {
    // Step 1: Get admin token
    console.log('  → Step 1: Getting admin authentication token...');
    adminToken = await getAdminToken();

    if (!adminToken) {
      addResult('Admin Authentication', 'FAIL', 'Failed to get admin token');
      return;
    }
    addResult('Admin Authentication', 'PASS', 'Admin token obtained successfully');

    // Step 2: Create a test seller (Pending status)
    console.log('  → Step 2: Creating test seller with Pending status...');
    const testMobile = `8${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
    const testEmail = `testseller${Date.now()}@test.com`;

    const testSeller = await Seller.create({
      sellerName: 'Test Vendor',
      mobile: testMobile,
      email: testEmail,
      password: 'Test123!',
      storeName: 'Test Store',
      category: 'Electronics',
      serviceableArea: 'Test Area',
      status: 'Pending', // Start with Pending status
      requireProductApproval: false,
      viewCustomerDetails: false,
      commission: 0,
      balance: 0,
      categories: [],
    });

    testSellerId = testSeller._id.toString();
    addResult('Create Test Seller', 'PASS', 'Test seller created with Pending status', {
      sellerId: testSellerId,
      status: testSeller.status,
    });

    // Step 3: Get all sellers (should include our test seller)
    console.log('  → Step 3: Fetching all sellers...');
    const getAllResult = await apiRequest('GET', '/sellers', undefined, adminToken);

    if (getAllResult.success && getAllResult.data.success) {
      const sellers = getAllResult.data.data;
      const foundSeller = sellers.find((s: any) => s._id === testSellerId);

      if (foundSeller) {
        addResult('Get All Sellers', 'PASS', 'Successfully fetched sellers list', {
          totalSellers: sellers.length,
          testSellerStatus: foundSeller.status,
        });
      } else {
        addResult('Get All Sellers', 'FAIL', 'Test seller not found in sellers list');
      }
    } else {
      addResult('Get All Sellers', 'FAIL', 'Failed to fetch sellers', getAllResult.data);
    }

    // Step 4: Get sellers with Pending status filter
    console.log('  → Step 4: Fetching pending sellers...');
    const getPendingResult = await apiRequest('GET', '/sellers?status=Pending', undefined, adminToken);

    if (getPendingResult.success && getPendingResult.data.success) {
      const pendingSellers = getPendingResult.data.data;
      const foundPending = pendingSellers.find((s: any) => s._id === testSellerId);

      if (foundPending) {
        addResult('Get Pending Sellers', 'PASS', 'Successfully filtered pending sellers', {
          pendingCount: pendingSellers.length,
        });
      } else {
        addResult('Get Pending Sellers', 'SKIP', 'Test seller not in pending list (may have been approved)');
      }
    } else {
      addResult('Get Pending Sellers', 'FAIL', 'Failed to fetch pending sellers', getPendingResult.data);
    }

    // Step 5: Approve the seller
    console.log('  → Step 5: Approving seller...');
    const approveResult = await apiRequest(
      'PATCH',
      `/sellers/${testSellerId}/status`,
      { status: 'Approved' },
      adminToken
    );

    if (approveResult.success && approveResult.data.success) {
      const updatedSeller = approveResult.data.data;
      if (updatedSeller.status === 'Approved') {
        addResult('Approve Seller', 'PASS', 'Seller approved successfully', {
          sellerId: testSellerId,
          newStatus: updatedSeller.status,
        });
      } else {
        addResult('Approve Seller', 'FAIL', 'Seller status not updated correctly', {
          expected: 'Approved',
          actual: updatedSeller.status,
        });
      }
    } else {
      addResult('Approve Seller', 'FAIL', 'Failed to approve seller', approveResult.data);
    }

    // Step 6: Verify seller status in database
    console.log('  → Step 6: Verifying seller status in database...');
    const dbSeller = await Seller.findById(testSellerId);
    if (dbSeller && dbSeller.status === 'Approved') {
      addResult('Database Verification', 'PASS', 'Seller status updated in database', {
        status: dbSeller.status,
      });
    } else {
      addResult('Database Verification', 'FAIL', 'Seller status not updated in database', {
        expected: 'Approved',
        actual: dbSeller?.status,
      });
    }

    // Step 7: Test rejecting a seller
    console.log('  → Step 7: Testing reject functionality...');
    const testSeller2 = await Seller.create({
      sellerName: 'Test Vendor 2',
      mobile: `8${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
      email: `testseller2${Date.now()}@test.com`,
      password: 'Test123!',
      storeName: 'Test Store 2',
      category: 'Electronics',
      address: '',
      city: '',
      serviceableArea: 'Test Area',
      status: 'Pending',
      requireProductApproval: false,
      viewCustomerDetails: false,
      commission: 0,
      balance: 0,
      categories: [],
    });

    const rejectResult = await apiRequest(
      'PATCH',
      `/sellers/${testSeller2._id}/status`,
      { status: 'Rejected' },
      adminToken
    );

    if (rejectResult.success && rejectResult.data.success) {
      const rejectedSeller = rejectResult.data.data;
      if (rejectedSeller.status === 'Rejected') {
        addResult('Reject Seller', 'PASS', 'Seller rejected successfully', {
          sellerId: testSeller2._id.toString(),
          newStatus: rejectedSeller.status,
        });
      } else {
        addResult('Reject Seller', 'FAIL', 'Seller status not updated correctly', {
          expected: 'Rejected',
          actual: rejectedSeller.status,
        });
      }
    } else {
      addResult('Reject Seller', 'FAIL', 'Failed to reject seller', rejectResult.data);
    }

    // Step 8: Test invalid status
    console.log('  → Step 8: Testing invalid status validation...');
    const invalidStatusResult = await apiRequest(
      'PATCH',
      `/sellers/${testSellerId}/status`,
      { status: 'InvalidStatus' },
      adminToken
    );

    if (!invalidStatusResult.success && invalidStatusResult.status === 400) {
      addResult('Invalid Status Validation', 'PASS', 'Correctly rejected invalid status', {
        status: invalidStatusResult.status,
      });
    } else {
      addResult('Invalid Status Validation', 'FAIL', 'Should reject invalid status', invalidStatusResult.data);
    }

    // Step 9: Test unauthorized access (without token)
    console.log('  → Step 9: Testing unauthorized access...');
    const unauthorizedResult = await apiRequest('PATCH', `/sellers/${testSellerId}/status`, { status: 'Approved' });

    if (!unauthorizedResult.success && unauthorizedResult.status === 401) {
      addResult('Unauthorized Access', 'PASS', 'Correctly rejected unauthorized request', {
        status: unauthorizedResult.status,
      });
    } else {
      addResult('Unauthorized Access', 'FAIL', 'Should reject unauthorized request', unauthorizedResult.data);
    }

    // Cleanup
    console.log('  → Cleaning up test data...');
    await Seller.deleteOne({ _id: testSellerId });
    await Seller.deleteOne({ _id: testSeller2._id });
    addResult('Cleanup', 'PASS', 'Test data cleaned up');

  } catch (error: any) {
    addResult('Vendor Approval Test', 'FAIL', `Unexpected error: ${error.message}`, {
      error: error.message,
      stack: error.stack,
    });
  } finally {
    // Cleanup on error
    if (testSellerId) {
      try {
        await Seller.deleteOne({ _id: testSellerId });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Vendor Approval Functionality Tests\n');
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`API Base: ${API_BASE}\n`);

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB connected successfully\n');

    // Run vendor approval tests
    await testVendorApproval();

    // Print summary
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.status === 'PASS').length;
    const failedTests = testResults.filter(r => r.status === 'FAIL').length;
    const skippedTests = testResults.filter(r => r.status === 'SKIP').length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏭️  Skipped: ${skippedTests}`);
    console.log('='.repeat(60));

    if (failedTests > 0) {
      console.log('\n⚠️  Some tests failed. Please review the details above.');
      process.exit(1);
    } else {
      console.log('\n✅ All vendor approval tests passed!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Test runner error:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    if ((await import('mongoose')).default.connection.readyState === 1) {
      await (await import('mongoose')).default.connection.close();
      console.log('\n📡 MongoDB connection closed');
    }
  }
}

// Run tests
runTests();

