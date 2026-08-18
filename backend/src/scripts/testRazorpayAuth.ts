import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

console.log('Testing Razorpay Credentials:');
console.log('RAZORPAY_KEY_ID:', keyId);
console.log('RAZORPAY_KEY_SECRET:', keySecret ? `${keySecret.substring(0, 4)}...` : undefined);

const razorpay = new Razorpay({
  key_id: keyId!,
  key_secret: keySecret!,
});

async function testAuth() {
  try {
    const order = await razorpay.orders.create({
      amount: 100, // 1 INR in paise
      currency: 'INR',
      receipt: `test_rcpt_${Date.now()}`,
    });
    console.log('✅ Razorpay Authentication SUCCESS! Order created:', order.id);
  } catch (err: any) {
    console.error('❌ Razorpay Authentication FAILED:', err);
  }
}

testAuth();
