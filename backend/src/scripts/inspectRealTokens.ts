import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Customer from '../models/Customer';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function inspectTokens() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  await mongoose.connect(mongoUri);

  console.log('=== REAL CUSTOMERS WITH FCM TOKENS ===');
  const customers = await Customer.find({
    $or: [{ fcmTokens: { $exists: true, $not: { $size: 0 } } }, { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }],
  });
  customers.forEach(c => {
    console.log(`Customer: ${c.name} (ID: ${c._id}) | Phone: ${c.phone} | Email: ${c.email}`);
    console.log(`  Web FCM Tokens (${c.fcmTokens?.length || 0}):`, c.fcmTokens);
    console.log(`  Mobile FCM Tokens (${c.fcmTokenMobile?.length || 0}):`, c.fcmTokenMobile);
  });

  console.log('\n=== REAL DELIVERY DRIVERS WITH FCM TOKENS ===');
  const drivers = await Delivery.find({
    $or: [{ fcmTokens: { $exists: true, $not: { $size: 0 } } }, { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }],
  });
  drivers.forEach(d => {
    console.log(`Delivery: ${d.name} (ID: ${d._id}) | Mobile: ${d.mobile} | Status: ${d.status} | Online: ${d.isOnline}`);
    console.log(`  Web FCM Tokens (${d.fcmTokens?.length || 0}):`, d.fcmTokens);
    console.log(`  Mobile FCM Tokens (${d.fcmTokenMobile?.length || 0}):`, d.fcmTokenMobile);
  });

  console.log('\n=== REAL SELLERS WITH FCM TOKENS ===');
  const sellers = await Seller.find({
    $or: [{ fcmTokens: { $exists: true, $not: { $size: 0 } } }, { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }],
  });
  sellers.forEach(s => {
    console.log(`Seller: ${s.sellerName} (${s.storeName}) (ID: ${s._id}) | Status: ${s.status}`);
    console.log(`  Web FCM Tokens (${s.fcmTokens?.length || 0}):`, s.fcmTokens);
    console.log(`  Mobile FCM Tokens (${s.fcmTokenMobile?.length || 0}):`, s.fcmTokenMobile);
  });

  await mongoose.disconnect();
}

inspectTokens();
