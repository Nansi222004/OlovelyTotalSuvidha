/// <reference path="../types.d.ts" />
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Customer from '../models/Customer';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import Admin from '../models/Admin';
import { initializeFirebaseAdmin, sendNotificationToUser } from '../services/firebaseAdmin';

dotenv.config({ path: path.join(__dirname, '../../.env') });
initializeFirebaseAdmin();

async function runRealFcmPushVerification() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB for Real FCM Token Inspection\n');

  console.log('===============================================================');
  console.log('SEARCHING DATABASE FOR REAL BROWSER-REGISTERED FCM TOKENS');
  console.log('===============================================================\n');

  const sellersWithTokens = await Seller.find({
    $or: [{ fcmTokens: { $exists: true, $not: { $size: 0 } } }, { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }],
  }).select('_id sellerName storeName fcmTokens fcmTokenMobile');

  const driversWithTokens = await Delivery.find({
    $or: [{ fcmTokens: { $exists: true, $not: { $size: 0 } } }, { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }],
  }).select('_id name fcmTokens fcmTokenMobile');

  const customersWithTokens = await Customer.find({
    $or: [{ fcmTokens: { $exists: true, $not: { $size: 0 } } }, { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }],
  }).select('_id name fcmTokens fcmTokenMobile');

  const adminsWithTokens = await Admin.find({
    $or: [{ fcmTokens: { $exists: true, $not: { $size: 0 } } }, { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }],
  }).select('_id name fcmTokens fcmTokenMobile');

  console.log(`📊 Registered FCM Tokens in DB:`);
  console.log(`   - Sellers with tokens: ${sellersWithTokens.length}`);
  console.log(`   - Delivery drivers with tokens: ${driversWithTokens.length}`);
  console.log(`   - Customers with tokens: ${customersWithTokens.length}`);
  console.log(`   - Admins with tokens: ${adminsWithTokens.length}\n`);

  let realTokenTested = false;

  // Test FCM push delivery to any registered seller
  for (const seller of sellersWithTokens) {
    const webTokens = (seller.fcmTokens || []).filter((t: string) => !t.startsWith('token_fake') && !t.startsWith('token_web_') && !t.startsWith('token_seller'));
    if (webTokens.length > 0) {
      realTokenTested = true;
      console.log(`🚀 Triggering REAL FCM Push Notification to Seller: ${seller.sellerName} (${seller.storeName})`);
      console.log(`   Tokens: ${webTokens.join(', ')}`);

      const res = await sendNotificationToUser(seller._id.toString(), 'Seller', {
        title: '🔔 Real FCM Push Test - Seller',
        body: `Test notification sent at ${new Date().toLocaleTimeString()} to real browser FCM token`,
        data: { type: 'NEW_ORDER_REQUEST', link: '/seller/orders' },
      });

      console.log(`   Response: successCount=${res?.successCount}, failureCount=${res?.failureCount}`);
    }
  }

  // Test FCM push delivery to any registered delivery driver
  for (const driver of driversWithTokens) {
    const webTokens = (driver.fcmTokens || []).filter((t: string) => !t.startsWith('token_fake') && !t.startsWith('token_web_') && !t.startsWith('token_driver'));
    if (webTokens.length > 0) {
      realTokenTested = true;
      console.log(`🚀 Triggering REAL FCM Push Notification to Delivery Partner: ${driver.name}`);
      console.log(`   Tokens: ${webTokens.join(', ')}`);

      const res = await sendNotificationToUser(driver._id.toString(), 'Delivery', {
        title: '🚚 Real FCM Push Test - Delivery',
        body: `Test assignment push notification sent at ${new Date().toLocaleTimeString()} to real browser FCM token`,
        data: { type: 'NEW_ORDER_REQUEST', link: '/delivery/orders' },
      });

      console.log(`   Response: successCount=${res?.successCount}, failureCount=${res?.failureCount}`);
    }
  }

  if (!realTokenTested) {
    console.log('⚠️  No real Chrome-browser-generated FCM tokens found in DB yet.');
    console.log('👉 To test real push delivery: Log into Seller or Delivery panel in Chrome and grant Notification permissions.');
    console.log('👉 Then re-run this command: npx ts-node --files src/scripts/testRealFcmPush.ts');
  }

  await mongoose.disconnect();
}

runRealFcmPushVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
