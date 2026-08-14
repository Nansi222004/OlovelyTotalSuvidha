# Frontend-Backend Authentication Integration Test

This test script verifies that the frontend and backend authentication systems are properly connected and working together.

## What It Tests

1. **API Health Check**
   - Verifies the backend API is running and accessible
   - Tests the `/health` endpoint

2. **CORS Configuration**
   - Tests CORS preflight requests (OPTIONS)
   - Verifies CORS headers in actual requests
   - Ensures frontend can communicate with backend

3. **Customer Authentication Flow**
   - Complete registration flow (as frontend would call)
   - OTP sending after registration
   - OTP verification and token generation
   - Token management

4. **Admin Authentication Flow**
   - OTP sending for admin login
   - OTP verification and token generation

5. **Error Handling**
   - Invalid mobile number format validation
   - Missing required fields validation
   - Invalid OTP rejection
   - Proper error responses

## Prerequisites

1. **Backend server must be running**
   ```bash
   cd backend
   npm run dev
   ```

2. **MongoDB must be running and connected**
   - The backend should connect to MongoDB automatically

3. **Environment variables** (optional)
   - `BACKEND_URL` - Defaults to `http://localhost:5000`
   - `FRONTEND_URL` - Defaults to `http://localhost:5173`

## Running the Tests

### Option 1: Using npm script (Recommended)
```bash
cd backend
npm run test:integration
```

### Option 2: Using tsx directly
```bash
cd backend
npx tsx src/scripts/test-frontend-backend-auth.ts
```

### Option 3: With custom URLs
```bash
BACKEND_URL=http://localhost:5000 FRONTEND_URL=http://localhost:5173 npm run test:integration
```

## Test Output

The script provides:
- ✅ Real-time test results in the console
- 📄 Detailed markdown report in `backend/src/reports/frontend-backend-auth-test-{timestamp}.md`
- 📊 Summary statistics (passed/failed/skipped tests)

## What Gets Tested

### Customer Flow
1. Register a new customer → Should return token
2. Send OTP to registered customer → Should succeed
3. Verify OTP → Should return new token
4. Test error cases (invalid mobile, missing fields, etc.)

### Admin Flow
1. Send OTP to admin → Should succeed
2. Verify OTP → Should return token
3. Test error cases

### CORS Testing
- OPTIONS preflight request
- Actual POST request with Origin header
- Verifies CORS headers are present

## Fixes Applied

This test script also verifies that the following fixes are in place:

1. ✅ **Admin sendOTP fix**: Admin OTP sending now uses `isLogin: true` flag (fixed in `adminAuthController.ts`)
2. ✅ **CORS configuration**: Verified backend allows frontend origin
3. ✅ **Error handling**: Validates proper error responses

## Troubleshooting

### Tests Fail with "Connection Refused"
- **Solution**: Make sure the backend server is running on port 5000
- Check: `http://localhost:5000/api/v1/health` should return a response

### CORS Tests Fail
- **Solution**: Verify `FRONTEND_URL` in backend `.env` matches your frontend URL
- Default backend allows: `http://localhost:5173`
- Update `server.ts` CORS configuration if needed

### OTP Tests Fail
- **Solution**: Check MongoDB connection
- Verify OTP model is working correctly
- Check default OTP is set (should be `999999` in development)

### Database Errors
- **Solution**: Ensure MongoDB is running
- Check connection string in backend `.env`
- Verify database permissions

## Expected Results

When all tests pass, you should see:
```
✅ All tests passed!
📄 Test report generated: backend/src/reports/frontend-backend-auth-test-{timestamp}.md
```

## Report Location

Test reports are saved to:
```
backend/src/reports/frontend-backend-auth-test-{timestamp}.md
```

Each report includes:
- Test summary (total, passed, failed, success rate)
- Detailed results for each test suite
- Error messages for failed tests
- Endpoint and method information

## Integration with CI/CD

You can integrate this test script into your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  run: |
    cd backend
    npm run test:integration
```

## Notes

- Test data is automatically cleaned up after tests
- Test mobile numbers are randomly generated to avoid conflicts
- Default OTP for development: `999999` (or `DEFAULT_OTP` env variable)
- Tests create temporary users that are deleted after completion
