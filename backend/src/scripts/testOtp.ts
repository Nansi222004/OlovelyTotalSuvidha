
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import { sendSmsOtp } from '../services/otpService';
import mongoose from 'mongoose';

async function test() {
  console.log('--- Testing sendSmsOtp ---');
  console.log('Env Path:', envPath);
  console.log('SMS_INDIA_HUB_API_KEY:', process.env.SMS_INDIA_HUB_API_KEY ? '*****' + process.env.SMS_INDIA_HUB_API_KEY.slice(-4) : 'NOT SET');

  // Connect to DB if needed (otpService saves to DB)
  // We need a dummy mongo connection or mock the DB call if we don't want to rely on real DB
  // But otpService imports Otp model.
  // Let's rely on the real DB connection if possible, or mock it?
  // Simpler to just connect to the DB if we can.

  if (process.env.MONGODB_URI) {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
  } else {
      console.warn('MONGODB_URI not set, DB operations might fail if they require connection');
  }

  try {
    // Use a dummy number or the user's number if known.
    // Using a random 10 digit number to avoid spamming real people unless it's a test number.
    // SMS India HUB might reject invalid numbers.
    // Let's use a standard test number if possible, or just a random one.
    const testMobile = '9876543210';
    console.log(`Sending OTP to ${testMobile}...`);

    const result = await sendSmsOtp(testMobile, 'Customer');
    console.log('Result:', result);

  } catch (error: any) {
    console.error('Test Failed!');
    // The error message should now contain the details we added
    console.error(error.message);
  } finally {
      await mongoose.disconnect();
  }
}

test();

