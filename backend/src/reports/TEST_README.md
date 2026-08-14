# Authentication Test Suite

This test suite comprehensively tests all authentication functionality for Admin, Seller, and Customer user types.

## Prerequisites

1. **Backend server must be running** on `http://localhost:5000` (or set `BASE_URL` in `.env`)
2. **MongoDB connection** must be configured via `MONGODB_URI` in `.env`
3. **Node modules installed**: `npm install`

## Running the Tests

```bash
# From the backend directory
npm run test:auth

# Or directly with tsx
tsx test-auth.ts
```

## What Gets Tested

### Admin Authentication
- ✅ Registration (Super Admin and Regular Admin roles)
- ✅ Send OTP
- ✅ Verify OTP (Login)
- ✅ Duplicate registration prevention
- ✅ Invalid input validation
- ✅ Missing field validation

### Seller Authentication
- ✅ Registration
- ✅ Send OTP
- ✅ Verify OTP (Login)
- ✅ Duplicate registration prevention
- ✅ Invalid input validation

### Customer Authentication
- ✅ Registration
- ✅ Send OTP
- ✅ Verify OTP (Login)
- ✅ Duplicate registration prevention
- ✅ Invalid input validation

### User Deletion
- ✅ Delete test users from database
- ✅ Verify deletion

## Test Data

The test suite uses the following mobile number patterns:
- **Admins**: `9000000001`, `9000000002`, etc.
- **Sellers**: `8000000001`, `8000000002`, etc.
- **Customers**: `7000000001`, `7000000002`, etc.

All test users are automatically cleaned up after tests complete.

## Test Report

After running the tests, you'll get:
1. **Console output** with real-time test results
2. **test-report.json** file with detailed results including:
   - Summary statistics (total, passed, failed, skipped)
   - Success rate percentage
   - Detailed results for each test case
   - Timestamp of test run

## Environment Variables

Make sure your `.env` file has:
```env
MONGODB_URI=your_mongodb_connection_string
BASE_URL=http://localhost:5000  # Optional, defaults to localhost:5000
NODE_ENV=development
DEFAULT_OTP=123456  # Used in development mode
```

## Notes

- In development mode, OTP is always `123456`
- Test users are automatically deleted after tests
- The test suite connects directly to MongoDB to verify deletions
- All API endpoints are tested with both valid and invalid inputs

