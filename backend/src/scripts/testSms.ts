
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

// Load env vars FIRST
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('Testing SMS DLT...');
process.env.USE_MOCK_OTP = 'false';
console.log('APP_NAME:', process.env.APP_NAME);
console.log('PE ID:', process.env.SMS_INDIA_HUB_ENTITY_ID);
console.log('Template ID:', process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID);
console.log('API Key Present:', !!process.env.SMS_INDIA_HUB_API_KEY);
console.log('Sender ID Present:', !!process.env.SMS_INDIA_HUB_SENDER_ID);
console.log('Mock Mode Forced: false');

const mobile = '6268423926';

async function test() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not set');
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        // Dynamically import service so it picks up env vars
        const { sendSmsOtp } = await import('../services/otpService');

        // Test Customer OTP
        console.log(`Sending OTP to ${mobile}...`);
        const result = await sendSmsOtp(mobile, 'Customer');
        console.log('Success:', result);

    } catch (error: any) {
        console.error('Failed:', error.message);
        if (error.response?.data) {
            console.error('API Error Details:', error.response.data);
        }
    } finally {
        await mongoose.disconnect();
        console.log('Done');
    }
}

test();
