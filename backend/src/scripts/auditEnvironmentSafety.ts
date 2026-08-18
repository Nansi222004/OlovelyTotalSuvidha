import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

interface SafetyReport {
  timestamp: string;
  nodeEnv: string;
  serverUrl: string;
  frontendUrl: string;
  mongoStatus: string;
  mongoDatabaseName: string;
  jwtConfigured: boolean;
  razorpayConfigured: boolean;
  razorpayMode: 'SANDBOX' | 'LIVE' | 'MISSING';
  firebaseAdminConfigured: boolean;
  firebaseServiceAccountExists: boolean;
  smsGatewayConfigured: boolean;
  smsProvider: string;
  cloudinaryConfigured: boolean;
  environmentClassification: 'LOCAL / TEST' | 'STAGING' | 'PRODUCTION';
  safeForIntegrationTests: boolean;
}

async function runSafetyAudit(): Promise<SafetyReport> {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  let mongoStatus = 'MISSING';
  let mongoDatabaseName = 'unknown';

  if (mongoUri) {
    try {
      // Connect to verify DB connectivity safely
      await mongoose.connect(mongoUri);
      mongoStatus = 'CONNECTED';
      mongoDatabaseName = mongoose.connection.name || 'default';
      await mongoose.disconnect();
    } catch (err: any) {
      mongoStatus = `CONNECTION_FAILED: ${err.message}`;
    }
  }

  const jwtConfigured = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length > 5);
  
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || '';
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';
  let razorpayConfigured = Boolean(razorpayKeyId && razorpaySecret);
  let razorpayMode: 'SANDBOX' | 'LIVE' | 'MISSING' = 'MISSING';

  if (razorpayConfigured) {
    razorpayMode = razorpayKeyId.startsWith('rzp_test_') ? 'SANDBOX' : 'LIVE';
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'config/firebase-service-account.json';
  const resolvedPath = path.isAbsolute(serviceAccountPath) 
    ? serviceAccountPath 
    : path.join(__dirname, '../..', serviceAccountPath);
  
  const firebaseServiceAccountExists = fs.existsSync(resolvedPath);
  const firebaseInlineConfig = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
  const firebaseAdminConfigured = firebaseServiceAccountExists || firebaseInlineConfig;

  const smsApiKey = process.env.SMS_INDIA_HUB_API_KEY || process.env.FAST2SMS_API_KEY || '';
  const smsGatewayConfigured = Boolean(smsApiKey && smsApiKey !== 'your_api_key');
  const smsProvider = process.env.SMS_INDIA_HUB_API_KEY ? 'SMS India Hub' : (process.env.FAST2SMS_API_KEY ? 'Fast2SMS' : 'None');

  const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET
  );

  // Environment Classification Logic
  let classification: 'LOCAL / TEST' | 'STAGING' | 'PRODUCTION' = 'LOCAL / TEST';
  if (nodeEnv === 'production') {
    classification = 'PRODUCTION';
  } else if (serverUrl.includes('staging') || mongoUri.includes('staging')) {
    classification = 'STAGING';
  }

  const safeForIntegrationTests = classification !== 'PRODUCTION' || (razorpayMode !== 'LIVE');

  return {
    timestamp: new Date().toISOString(),
    nodeEnv,
    serverUrl,
    frontendUrl,
    mongoStatus,
    mongoDatabaseName,
    jwtConfigured,
    razorpayConfigured,
    razorpayMode,
    firebaseAdminConfigured,
    firebaseServiceAccountExists,
    smsGatewayConfigured,
    smsProvider,
    cloudinaryConfigured,
    environmentClassification: classification,
    safeForIntegrationTests,
  };
}

runSafetyAudit().then((report) => {
  console.log(JSON.stringify(report, null, 2));
}).catch(console.error);
