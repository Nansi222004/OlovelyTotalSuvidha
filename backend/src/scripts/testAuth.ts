import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';
const TEST_REPORT_DIR = path.join(__dirname, '../reports');
const TEST_REPORT_FILE = path.join(TEST_REPORT_DIR, `test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);

// Test results interface
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
  error?: string;
}

interface TestSuite {
  name: string;
  results: TestResult[];
  startTime: number;
  endTime?: number;
}

// Test data
const testData = {
  customer: {
    name: 'Test Customer',
    mobile: `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
    email: `testcustomer${Date.now()}@test.com`,
    dateOfBirth: '1990-01-01',
  },
  seller: {
    sellerName: 'Test Seller',
    mobile: `8${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
    email: `testseller${Date.now()}@test.com`,
    password: 'testpass123',
    storeName: 'Test Store',
    category: 'Organic & Premium',
    address: '',
    city: '',
    serviceableArea: 'Area 1',
  },
  delivery: {
    name: 'Test Delivery',
    mobile: `7${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
    email: `testdelivery${Date.now()}@test.com`,
    password: 'testpass123',
    address: '',
    city: '',
    dateOfBirth: '1990-01-01',
  },
  admin: {
    mobile: '1234567890', // Use a fixed number for admin tests
  },
};

const results: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

// Helper functions
function startSuite(name: string) {
  currentSuite = {
    name,
    results: [],
    startTime: Date.now(),
  };
  results.push(currentSuite);
  console.log(`\n🧪 Starting test suite: ${name}`);
}

function endSuite() {
  if (currentSuite) {
    currentSuite.endTime = Date.now();
    const duration = ((currentSuite.endTime - currentSuite.startTime) / 1000).toFixed(2);
    console.log(`✅ Completed test suite: ${currentSuite.name} (${duration}s)`);
  }
}

function recordTest(name: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration?: number, error?: string) {
  if (currentSuite) {
    currentSuite.results.push({
      name,
      status,
      message,
      duration,
      error,
    });

    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    console.log(`  ${icon} ${name}: ${message}`);
    if (error) {
      console.log(`     Error: ${error}`);
    }
  }
}

async function testEndpoint(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  headers?: Record<string, string>
): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
  try {
    const config: any = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 10000,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }

    const response = await axios(config);

    return {
      success: response.status >= 200 && response.status < 300,
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Unknown error',
      status: error.response?.status,
    };
  }
}

// Test functions
async function testHealthCheck() {
  const result = await testEndpoint('GET', '/health');
  recordTest(
    'Health Check',
    result.success ? 'PASS' : 'FAIL',
    result.success ? 'API is healthy' : result.error || 'Health check failed',
    undefined,
    result.success ? undefined : result.error
  );
  return result.success;
}

async function testCustomerSignup() {
  const result = await testEndpoint('POST', '/auth/customer/register', {
    name: testData.customer.name,
    mobile: testData.customer.mobile,
    email: testData.customer.email,
    dateOfBirth: testData.customer.dateOfBirth,
  });

  recordTest(
    'Customer Registration',
    result.success ? 'PASS' : 'FAIL',
    result.success ? 'Customer registered successfully' : result.error || 'Registration failed',
    undefined,
    result.success ? undefined : result.error
  );

  if (result.success && result.data?.data?.token) {
    // Test OTP sending
    const otpResult = await testEndpoint('POST', '/auth/customer/send-sms-otp', {
      mobile: testData.customer.mobile,
    });

    recordTest(
      'Customer Send OTP',
      otpResult.success ? 'PASS' : 'FAIL',
      otpResult.success ? 'OTP sent successfully' : otpResult.error || 'Failed to send OTP',
      undefined,
      otpResult.success ? undefined : otpResult.error
    );

    const sessionId = otpResult.data?.sessionId;
    // Test OTP verification (using default OTP in development)
    const verifyResult = await testEndpoint('POST', '/auth/customer/verify-sms-otp', {
      mobile: testData.customer.mobile,
      otp: '123456', // Default OTP in development
      ...(sessionId && { sessionId }),
    });

    recordTest(
      'Customer Verify OTP',
      verifyResult.success ? 'PASS' : 'FAIL',
      verifyResult.success ? 'OTP verified successfully' : verifyResult.error || 'OTP verification failed',
      undefined,
      verifyResult.success ? undefined : verifyResult.error
    );
  }

  return result.success;
}

async function testSellerSignup() {
  const result = await testEndpoint('POST', '/auth/seller/register', {
    sellerName: testData.seller.sellerName,
    mobile: testData.seller.mobile,
    email: testData.seller.email,
    password: testData.seller.password,
    storeName: testData.seller.storeName,
    category: testData.seller.category,
    address: testData.seller.address,
    city: testData.seller.city,
    serviceableArea: testData.seller.serviceableArea,
  });

  recordTest(
    'Seller Registration',
    result.success ? 'PASS' : 'FAIL',
    result.success ? 'Seller registered successfully' : result.error || 'Registration failed',
    undefined,
    result.success ? undefined : result.error
  );

  if (result.success) {
    // Test OTP sending
    const otpResult = await testEndpoint('POST', '/auth/seller/send-otp', {
      mobile: testData.seller.mobile,
    });

    recordTest(
      'Seller Send OTP',
      otpResult.success ? 'PASS' : 'FAIL',
      otpResult.success ? 'OTP sent successfully' : otpResult.error || 'Failed to send OTP',
      undefined,
      otpResult.success ? undefined : otpResult.error
    );

    // Test OTP verification
    const verifyResult = await testEndpoint('POST', '/auth/seller/verify-otp', {
      mobile: testData.seller.mobile,
      otp: '123456',
    });

    recordTest(
      'Seller Verify OTP',
      verifyResult.success ? 'PASS' : 'FAIL',
      verifyResult.success ? 'OTP verified successfully' : verifyResult.error || 'OTP verification failed',
      undefined,
      verifyResult.success ? undefined : verifyResult.error
    );
  }

  return result.success;
}

async function testDeliverySignup() {
  const result = await testEndpoint('POST', '/auth/delivery/register', {
    name: testData.delivery.name,
    mobile: testData.delivery.mobile,
    email: testData.delivery.email,
    password: testData.delivery.password,
    address: testData.delivery.address,
    city: testData.delivery.city,
    dateOfBirth: testData.delivery.dateOfBirth,
  });

  recordTest(
    'Delivery Registration',
    result.success ? 'PASS' : 'FAIL',
    result.success ? 'Delivery partner registered successfully' : result.error || 'Registration failed',
    undefined,
    result.success ? undefined : result.error
  );

  if (result.success) {
    // Test OTP sending (will fail if delivery partner doesn't exist, which is expected for new registration)
    const otpResult = await testEndpoint('POST', '/auth/delivery/send-otp', {
      mobile: testData.delivery.mobile,
    });

    recordTest(
      'Delivery Send OTP',
      otpResult.success ? 'PASS' : 'FAIL',
      otpResult.success ? 'OTP sent successfully' : 'OTP send failed (expected for new registration)',
      undefined,
      otpResult.success ? undefined : otpResult.error
    );
  }

  return result.success;
}

async function testAdminAuth() {
  // Test OTP sending
  const otpResult = await testEndpoint('POST', '/auth/admin/send-otp', {
    mobile: testData.admin.mobile,
  });

  recordTest(
    'Admin Send OTP',
    otpResult.success ? 'PASS' : 'FAIL',
    otpResult.success ? 'OTP sent successfully' : 'OTP send failed (admin may not exist)',
    undefined,
    otpResult.success ? undefined : otpResult.error
  );

  if (otpResult.success) {
    // Test OTP verification
    const verifyResult = await testEndpoint('POST', '/auth/admin/verify-otp', {
      mobile: testData.admin.mobile,
      otp: '123456',
    });

    recordTest(
      'Admin Verify OTP',
      verifyResult.success ? 'PASS' : 'FAIL',
      verifyResult.success ? 'OTP verified successfully' : verifyResult.error || 'OTP verification failed',
      undefined,
      verifyResult.success ? undefined : verifyResult.error
    );
  }

  return otpResult.success;
}

async function testErrorCases() {
  // Test invalid mobile number
  const invalidMobileResult = await testEndpoint('POST', '/auth/customer/send-sms-otp', {
    mobile: '123', // Invalid mobile
  });

  recordTest(
    'Invalid Mobile Number',
    !invalidMobileResult.success ? 'PASS' : 'FAIL',
    !invalidMobileResult.success ? 'Correctly rejected invalid mobile' : 'Should have rejected invalid mobile',
    undefined,
    invalidMobileResult.success ? 'Should have failed' : undefined
  );

  // Test duplicate registration
  const duplicateResult = await testEndpoint('POST', '/auth/customer/register', {
    name: testData.customer.name,
    mobile: testData.customer.mobile, // Same mobile as before
    email: `duplicate${Date.now()}@test.com`,
  });

  recordTest(
    'Duplicate Registration',
    !duplicateResult.success ? 'PASS' : 'FAIL',
    !duplicateResult.success ? 'Correctly rejected duplicate mobile' : 'Should have rejected duplicate',
    undefined,
    duplicateResult.success ? 'Should have failed' : undefined
  );

  // Test invalid OTP
  const invalidOTPResult = await testEndpoint('POST', '/auth/customer/verify-sms-otp', {
    mobile: testData.customer.mobile,
    otp: '999999', // Invalid OTP
    sessionId: 'OTP_SESSION_' + testData.customer.mobile,
  });

  recordTest(
    'Invalid OTP',
    !invalidOTPResult.success ? 'PASS' : 'FAIL',
    !invalidOTPResult.success ? 'Correctly rejected invalid OTP' : 'Should have rejected invalid OTP',
    undefined,
    invalidOTPResult.success ? 'Should have failed' : undefined
  );
}

// Generate report
function generateReport() {
  const totalTests = results.reduce((sum, suite) => sum + suite.results.length, 0);
  const passedTests = results.reduce(
    (sum, suite) => sum + suite.results.filter((r) => r.status === 'PASS').length,
    0
  );
  const failedTests = results.reduce(
    (sum, suite) => sum + suite.results.filter((r) => r.status === 'FAIL').length,
    0
  );
  const skippedTests = results.reduce(
    (sum, suite) => sum + suite.results.filter((r) => r.status === 'SKIP').length,
    0
  );

  const totalDuration = results.reduce(
    (sum, suite) => sum + ((suite.endTime || Date.now()) - suite.startTime),
    0
  );

  let report = `# Authentication & Signup Test Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `**API Base URL:** ${API_BASE_URL}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total Tests:** ${totalTests}\n`;
  report += `- **Passed:** ${passedTests} ✅\n`;
  report += `- **Failed:** ${failedTests} ❌\n`;
  report += `- **Skipped:** ${skippedTests} ⏭️\n`;
  report += `- **Success Rate:** ${((passedTests / totalTests) * 100).toFixed(2)}%\n`;
  report += `- **Total Duration:** ${(totalDuration / 1000).toFixed(2)}s\n\n`;

  report += `## Test Suites\n\n`;

  results.forEach((suite) => {
    const suiteDuration = suite.endTime
      ? ((suite.endTime - suite.startTime) / 1000).toFixed(2)
      : 'N/A';
    const suitePassed = suite.results.filter((r) => r.status === 'PASS').length;
    const suiteFailed = suite.results.filter((r) => r.status === 'FAIL').length;

    report += `### ${suite.name}\n\n`;
    report += `- **Duration:** ${suiteDuration}s\n`;
    report += `- **Passed:** ${suitePassed}\n`;
    report += `- **Failed:** ${suiteFailed}\n\n`;

    report += `| Test Name | Status | Message |\n`;
    report += `|-----------|--------|----------|\n`;

    suite.results.forEach((test) => {
      const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⏭️';
      report += `| ${test.name} | ${statusIcon} ${test.status} | ${test.message} |\n`;

      if (test.error) {
        report += `|   └─ Error | | \`${test.error}\` |\n`;
      }
    });

    report += `\n`;
  });

  report += `## Test Data Used\n\n`;
  report += `\`\`\`json\n`;
  report += JSON.stringify(testData, null, 2);
  report += `\n\`\`\`\n\n`;

  report += `## Notes\n\n`;
  report += `- Default OTP for development: \`123456\`\n`;
  report += `- Test mobile numbers are randomly generated to avoid conflicts\n`;
  report += `- Some tests may fail if test data already exists in the database\n`;

  return report;
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Authentication & Signup Tests\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  try {
    // Test Health Check
    startSuite('Health Check');
    const healthOk = await testHealthCheck();
    endSuite();

    if (!healthOk) {
      console.log('\n❌ Health check failed. Stopping tests.');
      return;
    }

    // Test Customer Authentication
    startSuite('Customer Authentication');
    await testCustomerSignup();
    endSuite();

    // Test Seller Authentication
    startSuite('Seller Authentication');
    await testSellerSignup();
    endSuite();

    // Test Delivery Authentication
    startSuite('Delivery Authentication');
    await testDeliverySignup();
    endSuite();

    // Test Admin Authentication
    startSuite('Admin Authentication');
    await testAdminAuth();
    endSuite();

    // Test Error Cases
    startSuite('Error Cases');
    await testErrorCases();
    endSuite();

    // Generate and save report
    const report = generateReport();

    // Ensure reports directory exists
    if (!fs.existsSync(TEST_REPORT_DIR)) {
      fs.mkdirSync(TEST_REPORT_DIR, { recursive: true });
    }

    fs.writeFileSync(TEST_REPORT_FILE, report, 'utf-8');

    console.log('\n📊 Test Report Generated');
    console.log(`Location: ${TEST_REPORT_FILE}\n`);

    // Print summary
    const totalTests = results.reduce((sum, suite) => sum + suite.results.length, 0);
    const passedTests = results.reduce(
      (sum, suite) => sum + suite.results.filter((r) => r.status === 'PASS').length,
      0
    );
    const failedTests = results.reduce(
      (sum, suite) => sum + suite.results.filter((r) => r.status === 'FAIL').length,
      0
    );

    console.log('📈 Test Summary:');
    console.log(`   Total: ${totalTests}`);
    console.log(`   Passed: ${passedTests} ✅`);
    console.log(`   Failed: ${failedTests} ❌`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%\n`);
  } catch (error: any) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();


