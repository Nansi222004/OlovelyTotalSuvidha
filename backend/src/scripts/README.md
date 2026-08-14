# Test Scripts

## Authentication & Signup Test Script

The `testAuth.ts` script tests all authentication and signup functionalities for Customer, Seller, Delivery, and Admin user types.

### Prerequisites

1. Backend server must be running
2. MongoDB connection must be established
3. Environment variables must be configured

### Running the Tests

```bash
# Make sure the backend server is running first
npm run dev

# In another terminal, run the tests
npm run test:auth
```

Or using tsx directly:

```bash
npx tsx src/scripts/testAuth.ts
```

### Configuration

The test script uses the following environment variable:
- `API_BASE_URL` - Defaults to `http://localhost:5000/api/v1`

You can override it:

```bash
API_BASE_URL=http://localhost:5000/api/v1 npm run test:auth
```

### What It Tests

1. **Health Check**
   - API health endpoint

2. **Customer Authentication**
   - Customer registration
   - OTP sending
   - OTP verification

3. **Seller Authentication**
   - Seller registration
   - OTP sending
   - OTP verification

4. **Delivery Authentication**
   - Delivery partner registration
   - OTP sending

5. **Admin Authentication**
   - OTP sending
   - OTP verification

6. **Error Cases**
   - Invalid mobile number validation
   - Duplicate registration prevention
   - Invalid OTP rejection

### Test Report

After running the tests, a detailed markdown report is generated in:
```
backend/src/reports/test-report-{timestamp}.md
```

The report includes:
- Test summary (total, passed, failed, success rate)
- Detailed results for each test suite
- Test data used
- Error messages for failed tests

### Notes

- Test mobile numbers are randomly generated to avoid conflicts
- Default OTP for development: `123456`
- Some tests may fail if test data already exists in the database
- The script creates the reports directory automatically if it doesn't exist

