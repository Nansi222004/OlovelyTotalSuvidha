# Frontend-Backend Authentication Integration Test Report

**Generated:** 2025-12-17T19:26:55.433Z
**Backend URL:** http://localhost:5000
**Frontend URL:** http://localhost:5173
**API Base:** http://localhost:5000/api/v1

## Summary

- **Total Tests:** 10
- **Passed:** 8 ✅
- **Failed:** 2 ❌
- **Skipped:** 0 ⏭️
- **Warnings:** 0 ⚠️
- **Success Rate:** 80.00%

## Test Suites

### API Health

- ✅ **API Health Check**: API is healthy
  - Endpoint: `GET /health`
  - Details: ```json
{
  "status": "OK",
  "message": "API is healthy",
  "timestamp": "2025-12-17T19:26:33.026Z"
}
```

### CORS Configuration

- ✅ **CORS - Preflight Request**: CORS headers present: http://localhost:5173
  - Endpoint: `OPTIONS /auth/customer/send-otp`
  - Details: ```json
{
  "access-control-allow-origin": "http://localhost:5173",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
  "access-control-allow-headers": "Content-Type,Authorization",
  "access-control-allow-credentials": "true"
}
```
- ✅ **CORS - Actual Request**: CORS allows origin: http://localhost:5173
  - Endpoint: `POST /auth/customer/send-otp`
  - Details: ```json
{
  "origin": "http://localhost:5173"
}
```

### Customer Authentication Flow

- ✅ **Customer Registration**: Customer registered successfully
  - Endpoint: `POST /auth/customer/register`
  - Details: ```json
{
  "mobile": "7618173555",
  "hasToken": true
}
```
- ✅ **Customer Send OTP**: OTP sent successfully
  - Endpoint: `POST /auth/customer/send-otp`
  - Details: ```json
{
  "message": "OTP sent (Login OTP: 999999)"
}
```
- ❌ **Customer Auth Flow**: Unexpected error: Operation `otps.findOne()` buffering timed out after 10000ms
  - Details: ```json
{
  "error": "Operation `otps.findOne()` buffering timed out after 10000ms",
  "stack": "MongooseError: Operation `otps.findOne()` buffering timed out after 10000ms\n    at Timeout.<anonymous> (C:\\Users\\AnkitAhirwar\\OneDrive\\Desktop\\dhakadsnazzy\\backend\\node_modules\\mongoose\\lib\\drivers\\node-mongodb-native\\collection.js:187:23)\n    at listOnTimeout (node:internal/timers:594:17)\n    at process.processTimers (node:internal/timers:529:7)"
}
```

### Admin Authentication Flow

- ❌ **Admin Auth Flow**: Unexpected error: Operation `admins.findOne()` buffering timed out after 10000ms
  - Details: ```json
{
  "error": "Operation `admins.findOne()` buffering timed out after 10000ms"
}
```

### Error Handling

- ✅ **Error - Invalid Mobile Format**: Correctly rejected invalid mobile format
  - Endpoint: `POST /auth/customer/send-otp`
  - Details: ```json
{
  "status": 400,
  "message": "Valid 10-digit mobile number is required"
}
```
- ✅ **Error - Missing Required Fields**: Correctly rejected missing required fields
  - Endpoint: `POST /auth/customer/register`
  - Details: ```json
{
  "status": 400
}
```
- ✅ **Error - Invalid OTP**: Correctly rejected invalid OTP
  - Endpoint: `POST /auth/customer/verify-otp`
  - Details: ```json
{
  "status": 401
}
```

## All Test Results

- ✅ **API Health Check**: API is healthy
- ✅ **CORS - Preflight Request**: CORS headers present: http://localhost:5173
- ✅ **CORS - Actual Request**: CORS allows origin: http://localhost:5173
- ✅ **Customer Registration**: Customer registered successfully
- ✅ **Customer Send OTP**: OTP sent successfully
- ❌ **Customer Auth Flow**: Unexpected error: Operation `otps.findOne()` buffering timed out after 10000ms
- ❌ **Admin Auth Flow**: Unexpected error: Operation `admins.findOne()` buffering timed out after 10000ms
- ✅ **Error - Invalid Mobile Format**: Correctly rejected invalid mobile format
- ✅ **Error - Missing Required Fields**: Correctly rejected missing required fields
- ✅ **Error - Invalid OTP**: Correctly rejected invalid OTP

