import axios, { AxiosError } from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import connectDB from '../config/db';
import Customer from '../models/Customer';
import Admin from '../models/Admin';

import Otp from '../models/Otp';

// Load environment variables
dotenv.config();

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_BASE = `${BACKEND_URL}/api/v1`;

// Test results storage
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARN';
  message: string;
  details?: any;
  endpoint?: string;
  method?: string;
}

interface TestSuite {
  name: string;
  results: TestResult[];
}

const testResults: TestResult[] = [];
const testSuites: TestSuite[] = [];

// Helper function to add test result
function addResult(
  name: string,
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARN',
  message: string,
  details?: any,
  endpoint?: string,
  method?: string
) {
  const result: TestResult = { name, status, message, details, endpoint, method };
  testResults.push(result);

  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'WARN' ? '⚠' : '⊘';
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : status === 'WARN' ? '\x1b[33m' : '\x1b[90m';
  const reset = '\x1b[0m';

  console.log(`${color}${icon}${reset} ${name}: ${message}`);
  if (details && (status === 'FAIL' || status === 'WARN')) {
    console.log(`   ${JSON.stringify(details, null, 2).split('\n').join('\n   ')}`);
  }
}

// Helper function to make API requests (simulating frontend calls)
async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  token?: string,
  origin?: string
) {
  try {
    const config: any = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Simulate frontend origin for CORS testing
    if (origin) {
      config.headers['Origin'] = origin;
    }

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
      headers: response.headers,
    };
  } catch (error: any) {
    const axiosError = error as AxiosError;
    return {
      success: false,
      data: axiosError.response?.data || { message: error.message },
      status: axiosError.response?.status || 500,
      headers: axiosError.response?.headers || {},
      error: error.message,
    };
  }
}

// Test CORS configuration
async function testCORS() {
  const suite: TestSuite = { name: 'CORS Configuration', results: [] };
  console.log('\n🌐 Testing CORS Configuration...');

  try {
    // Test OPTIONS preflight request
    const preflightResult = await axios.options(`${API_BASE}/auth/customer/send-sms-otp`, {
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    const corsHeaders = {
      'access-control-allow-origin': preflightResult.headers['access-control-allow-origin'],
      'access-control-allow-methods': preflightResult.headers['access-control-allow-methods'],
      'access-control-allow-headers': preflightResult.headers['access-control-allow-headers'],
      'access-control-allow-credentials': preflightResult.headers['access-control-allow-credentials'],
    };

    if (corsHeaders['access-control-allow-origin']) {
      addResult(
        'CORS - Preflight Request',
        'PASS',
        `CORS headers present: ${corsHeaders['access-control-allow-origin']}`,
        corsHeaders,
        '/auth/customer/send-sms-otp',
        'OPTIONS'
      );
    } else {
      addResult(
        'CORS - Preflight Request',
        'WARN',
        'CORS headers missing or incomplete',
        corsHeaders,
        '/auth/customer/send-sms-otp',
        'OPTIONS'
      );
    }

    // Test actual request with Origin header
    const actualRequest = await apiRequest('POST', '/auth/customer/send-sms-otp', { mobile: '9999999999' }, undefined, FRONTEND_URL);

    if (actualRequest.headers['access-control-allow-origin']) {
      addResult(
        'CORS - Actual Request',
        'PASS',
        `CORS allows origin: ${actualRequest.headers['access-control-allow-origin']}`,
        { origin: FRONTEND_URL },
        '/auth/customer/send-sms-otp',
        'POST'
      );
    } else {
      addResult(
        'CORS - Actual Request',
        'WARN',
        'CORS headers not present in response',
        { origin: FRONTEND_URL },
        '/auth/customer/send-sms-otp',
        'POST'
      );
    }
  } catch (error: any) {
    addResult(
      'CORS - Configuration',
      'FAIL',
      `CORS test failed: ${error.message}`,
      { error: error.message }
    );
  }

  suite.results = testResults.filter(r => r.name.startsWith('CORS'));
  testSuites.push(suite);
}

// Test Customer Authentication Flow (Frontend → Backend)
async function testCustomerAuthFlow() {
  const suite: TestSuite = { name: 'Customer Authentication Flow', results: [] };
  console.log('\n👤 Testing Customer Authentication Flow...');

  const testMobile = `7${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
  const testEmail = `testcustomer${Date.now()}@test.com`;
  let authToken: string | undefined;

  try {
    // Step 1: Register Customer (as frontend would)
    console.log('  → Step 1: Registering customer...');
    const registerResult = await apiRequest('POST', '/auth/customer/register', {
      name: 'Test Customer',
      mobile: testMobile,
      email: testEmail,
      dateOfBirth: '1990-01-01',
    });

    if (registerResult.success && registerResult.data.success && registerResult.data.data?.token) {
      authToken = registerResult.data.data.token;
      addResult(
        'Customer Registration',
        'PASS',
        'Customer registered successfully',
        { mobile: testMobile, hasToken: !!authToken },
        '/auth/customer/register',
        'POST'
      );
    } else {
      addResult(
        'Customer Registration',
        'FAIL',
        'Registration failed',
        registerResult.data,
        '/auth/customer/register',
        'POST'
      );
      return;
    }

    // Step 2: Send OTP (as frontend would after registration)
    console.log('  → Step 2: Sending OTP...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay to ensure customer exists

    const sendOTPResult = await apiRequest('POST', '/auth/customer/send-sms-otp', {
      mobile: testMobile,
    });

    if (sendOTPResult.success && sendOTPResult.data.success) {
      addResult(
        'Customer Send OTP',
        'PASS',
        'OTP sent successfully',
        { message: sendOTPResult.data.message },
        '/auth/customer/send-sms-otp',
        'POST'
      );
    } else {
      addResult(
        'Customer Send OTP',
        'FAIL',
        'Failed to send OTP',
        sendOTPResult.data,
        '/auth/customer/send-sms-otp',
        'POST'
      );
    }

    const sessionId = sendOTPResult.data?.sessionId;

    // Step 3: Verify OTP (as frontend would)
    console.log('  → Step 3: Verifying OTP...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for OTP to be saved

    // Get OTP from database
    const otpRecord = await Otp.findOne({
      mobile: testMobile,
      userType: 'Customer',
      isVerified: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      addResult(
        'Customer Verify OTP - OTP Not Found',
        'FAIL',
        'OTP not found in database',
        { mobile: testMobile }
      );
      return;
    }

    const verifyOTPResult = await apiRequest('POST', '/auth/customer/verify-sms-otp', {
      mobile: testMobile,
      otp: otpRecord.otp,
      sessionId: sessionId || 'OTP_SESSION_' + testMobile,
    });

    if (verifyOTPResult.success && verifyOTPResult.data.success && verifyOTPResult.data.data?.token) {
      const newToken = verifyOTPResult.data.data.token;
      addResult(
        'Customer Verify OTP',
        'PASS',
        'OTP verified and token received',
        { hasToken: !!newToken, userData: verifyOTPResult.data.data.user },
        '/auth/customer/verify-sms-otp',
        'POST'
      );
      authToken = newToken;
    } else {
      addResult(
        'Customer Verify OTP',
        'FAIL',
        'OTP verification failed',
        verifyOTPResult.data,
        '/auth/customer/verify-sms-otp',
        'POST'
      );
    }

    // Step 4: Test protected endpoint with token (simulating frontend API call)
    if (authToken) {
      console.log('  → Step 4: Testing protected endpoint...');
      // Note: This assumes there's a protected customer endpoint
      // If not available, we'll skip this test
      addResult(
        'Customer Token Usage',
        'SKIP',
        'No protected customer endpoint available for testing',
        { token: authToken.substring(0, 20) + '...' }
      );
    }

    // Cleanup
    await Customer.deleteOne({ phone: testMobile });
    await Otp.deleteMany({ mobile: testMobile });

  } catch (error: any) {
    addResult(
      'Customer Auth Flow',
      'FAIL',
      `Unexpected error: ${error.message}`,
      { error: error.message, stack: error.stack }
    );
  }

  suite.results = testResults.filter(r => r.name.startsWith('Customer'));
  testSuites.push(suite);
}

// Test Admin Authentication Flow
async function testAdminAuthFlow() {
  const suite: TestSuite = { name: 'Admin Authentication Flow', results: [] };
  console.log('\n👨‍💼 Testing Admin Authentication Flow...');

  // Use default admin or create test admin
  const testMobile = '9000000001';
  let authToken: string | undefined;

  try {
    // Check if admin exists, if not create one
    let admin = await Admin.findOne({ mobile: testMobile });
    if (!admin) {
      admin = await Admin.create({
        firstName: 'Test',
        lastName: 'Admin',
        mobile: testMobile,
        email: `testadmin${Date.now()}@test.com`,
        password: 'Test123!',
        role: 'Admin',
      });
    }

    // Step 1: Send OTP
    console.log('  → Step 1: Sending OTP...');
    const sendOTPResult = await apiRequest('POST', '/auth/admin/send-otp', {
      mobile: testMobile,
    });

    if (sendOTPResult.success && sendOTPResult.data.success) {
      addResult(
        'Admin Send OTP',
        'PASS',
        'OTP sent successfully',
        { message: sendOTPResult.data.message },
        '/auth/admin/send-otp',
        'POST'
      );
    } else {
      addResult(
        'Admin Send OTP',
        'FAIL',
        'Failed to send OTP',
        sendOTPResult.data,
        '/auth/admin/send-otp',
        'POST'
      );
      return;
    }

    // Step 2: Verify OTP
    console.log('  → Step 2: Verifying OTP...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const otpRecord = await Otp.findOne({
      mobile: testMobile,
      userType: 'Admin',
      isVerified: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      addResult(
        'Admin Verify OTP - OTP Not Found',
        'FAIL',
        'OTP not found in database',
        { mobile: testMobile }
      );
      return;
    }

    const verifyOTPResult = await apiRequest('POST', '/auth/admin/verify-otp', {
      mobile: testMobile,
      otp: otpRecord.otp,
    });

    if (verifyOTPResult.success && verifyOTPResult.data.success && verifyOTPResult.data.data?.token) {
      authToken = verifyOTPResult.data.data.token;
      addResult(
        'Admin Verify OTP',
        'PASS',
        'OTP verified and token received',
        { hasToken: !!authToken, userData: verifyOTPResult.data.data.user },
        '/auth/admin/verify-otp',
        'POST'
      );
    } else {
      addResult(
        'Admin Verify OTP',
        'FAIL',
        'OTP verification failed',
        verifyOTPResult.data,
        '/auth/admin/verify-otp',
        'POST'
      );
    }

    // Cleanup test OTPs
    await Otp.deleteMany({ mobile: testMobile, userType: 'Admin' });

  } catch (error: any) {
    addResult(
      'Admin Auth Flow',
      'FAIL',
      `Unexpected error: ${error.message}`,
      { error: error.message }
    );
  }

  suite.results = testResults.filter(r => r.name.startsWith('Admin'));
  testSuites.push(suite);
}

// Test Error Handling (as frontend would receive)
async function testErrorHandling() {
  const suite: TestSuite = { name: 'Error Handling', results: [] };
  console.log('\n⚠️  Testing Error Handling...');

  // Test 1: Invalid mobile format
  const invalidMobileResult = await apiRequest('POST', '/auth/customer/send-sms-otp', {
    mobile: '12345', // Invalid format
  });

  if (!invalidMobileResult.success && invalidMobileResult.status === 400) {
    addResult(
      'Error - Invalid Mobile Format',
      'PASS',
      'Correctly rejected invalid mobile format',
      { status: invalidMobileResult.status, message: invalidMobileResult.data.message },
      '/auth/customer/send-sms-otp',
      'POST'
    );
  } else {
    addResult(
      'Error - Invalid Mobile Format',
      'FAIL',
      'Should reject invalid mobile format',
      invalidMobileResult.data,
      '/auth/customer/send-sms-otp',
      'POST'
    );
  }

  // Test 2: Missing required fields
  const missingFieldsResult = await apiRequest('POST', '/auth/customer/register', {
    name: 'Test',
    // Missing mobile and email
  });

  if (!missingFieldsResult.success && missingFieldsResult.status === 400) {
    addResult(
      'Error - Missing Required Fields',
      'PASS',
      'Correctly rejected missing required fields',
      { status: missingFieldsResult.status },
      '/auth/customer/register',
      'POST'
    );
  } else {
    addResult(
      'Error - Missing Required Fields',
      'FAIL',
      'Should reject missing required fields',
      missingFieldsResult.data,
      '/auth/customer/register',
      'POST'
    );
  }

  // Test 3: Invalid OTP
  const invalidOTPResult = await apiRequest('POST', '/auth/customer/verify-sms-otp', {
    mobile: '9999999999',
    otp: '000000', // Invalid OTP
    sessionId: 'OTP_SESSION_9999999999',
  });

  if (!invalidOTPResult.success && (invalidOTPResult.status === 401 || invalidOTPResult.status === 400)) {
    addResult(
      'Error - Invalid OTP',
      'PASS',
      'Correctly rejected invalid OTP',
      { status: invalidOTPResult.status },
      '/auth/customer/verify-sms-otp',
      'POST'
    );
  } else {
    addResult(
      'Error - Invalid OTP',
      'FAIL',
      'Should reject invalid OTP',
      invalidOTPResult.data,
      '/auth/customer/verify-sms-otp',
      'POST'
    );
  }

  suite.results = testResults.filter(r => r.name.startsWith('Error'));
  testSuites.push(suite);
}

// Test API Health
async function testAPIHealth() {
  const suite: TestSuite = { name: 'API Health', results: [] };
  console.log('\n🏥 Testing API Health...');

  try {
    const healthResult = await apiRequest('GET', '/health');

    if (healthResult.success && healthResult.status === 200) {
      addResult(
        'API Health Check',
        'PASS',
        'API is healthy',
        healthResult.data,
        '/health',
        'GET'
      );
    } else {
      addResult(
        'API Health Check',
        'FAIL',
        'API health check failed',
        healthResult.data,
        '/health',
        'GET'
      );
    }
  } catch (error: any) {
    addResult(
      'API Health Check',
      'FAIL',
      `Health check error: ${error.message}`,
      { error: error.message }
    );
  }

  suite.results = testResults.filter(r => r.name.startsWith('API'));
  testSuites.push(suite);
}

// Generate test report
function generateReport() {
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportsDir, `frontend-backend-auth-test-${timestamp}.md`);

  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.status === 'PASS').length;
  const failedTests = testResults.filter(r => r.status === 'FAIL').length;
  const skippedTests = testResults.filter(r => r.status === 'SKIP').length;
  const warnings = testResults.filter(r => r.status === 'WARN').length;
  const successRate = totalTests > 0 ? ((passedTests / (totalTests - skippedTests)) * 100).toFixed(2) : '0';

  let report = `# Frontend-Backend Authentication Integration Test Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Backend URL:** ${BACKEND_URL}\n`;
  report += `**Frontend URL:** ${FRONTEND_URL}\n`;
  report += `**API Base:** ${API_BASE}\n\n`;

  report += `## Summary\n\n`;
  report += `- **Total Tests:** ${totalTests}\n`;
  report += `- **Passed:** ${passedTests} ✅\n`;
  report += `- **Failed:** ${failedTests} ❌\n`;
  report += `- **Skipped:** ${skippedTests} ⏭️\n`;
  report += `- **Warnings:** ${warnings} ⚠️\n`;
  report += `- **Success Rate:** ${successRate}%\n\n`;

  report += `## Test Suites\n\n`;

  testSuites.forEach((suite) => {
    report += `### ${suite.name}\n\n`;
    suite.results.forEach((result) => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'WARN' ? '⚠️' : '⏭️';
      report += `- ${icon} **${result.name}**: ${result.message}\n`;
      if (result.endpoint) {
        report += `  - Endpoint: \`${result.method} ${result.endpoint}\`\n`;
      }
      if (result.details) {
        report += `  - Details: \`\`\`json\n${JSON.stringify(result.details, null, 2)}\n\`\`\`\n`;
      }
    });
    report += `\n`;
  });

  report += `## All Test Results\n\n`;
  testResults.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'WARN' ? '⚠️' : '⏭️';
    report += `- ${icon} **${result.name}**: ${result.message}\n`;
  });

  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Test report generated: ${reportPath}`);

  return reportPath;
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Frontend-Backend Authentication Integration Tests\n');
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`API Base: ${API_BASE}\n`);

  try {
    // Connect to MongoDB first
    console.log('📡 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB connected successfully\n');

    // Test API Health
    await testAPIHealth();

    // Test CORS
    await testCORS();

    // Test Customer Auth Flow
    await testCustomerAuthFlow();

    // Test Admin Auth Flow
    await testAdminAuthFlow();

    // Test Error Handling
    await testErrorHandling();

    // Generate report
    const reportPath = generateReport();

    // Print summary
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.status === 'PASS').length;
    const failedTests = testResults.filter(r => r.status === 'FAIL').length;
    const skippedTests = testResults.filter(r => r.status === 'SKIP').length;
    const warnings = testResults.filter(r => r.status === 'WARN').length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏭️  Skipped: ${skippedTests}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📄 Report: ${reportPath}`);
    console.log('='.repeat(60));

    if (failedTests > 0) {
      console.log('\n⚠️  Some tests failed. Please review the report for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Test runner error:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n📡 MongoDB connection closed');
    }
  }
}

// Run tests
runTests();

