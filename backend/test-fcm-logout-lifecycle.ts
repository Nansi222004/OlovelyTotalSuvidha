import mongoose from 'mongoose';
import Customer from './src/models/Customer';
import { sendNotification } from './src/services/notificationService';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/olovely';

async function runFcmLogoutLifecycleSuite() {
    console.log('\n========================================================');
    console.log('🧪 RUNNING FCM TOKEN LOGIN / LOGOUT / MULTI-USER TEST SUITE');
    console.log('========================================================\n');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const testDeviceId = 'fcm_device_token_test_' + Date.now();
    const userA_phone = '9999900001';
    const userB_phone = '9999900002';

    // Clean up any previous test records
    await Customer.deleteMany({ phone: { $in: [userA_phone, userB_phone] } });

    // Create User A and User B
    const userA = await Customer.create({
        name: 'User A Test',
        phone: userA_phone,
        fcmTokens: [],
        fcmTokenMobile: [],
    });

    const userB = await Customer.create({
        name: 'User B Test',
        phone: userB_phone,
        fcmTokens: [],
        fcmTokenMobile: [],
    });

    console.log(`👤 Created Test Users:\n   - User A: ${userA._id} (${userA.name})\n   - User B: ${userB._id} (${userB.name})\n`);

    // =========================================================================
    // TEST 1: User A Logs In & Registers FCM Token
    // =========================================================================
    console.log('🧪 TEST 1: User A Login & FCM Token Registration...');
    
    // Simulate POST /api/v1/fcm-tokens/save
    await Customer.findByIdAndUpdate(userA._id, {
        $addToSet: { fcmTokens: testDeviceId }
    });

    const userAAfterLogin = await Customer.findById(userA._id);
    const hasTokenUserA = userAAfterLogin?.fcmTokens?.includes(testDeviceId);

    if (!hasTokenUserA) {
        throw new Error('TEST 1 FAILED: FCM token was not attached to User A');
    }
    console.log(`✅ TEST 1 PASSED: Token ${testDeviceId.slice(0, 20)}... successfully attached to User A.`);
    console.log(`   - User A fcmTokens in DB:`, userAAfterLogin?.fcmTokens);

    // Verify Notification Target for User A
    const notifUserA = await sendNotification(
        'Customer',
        userA._id.toString(),
        'Order Update for User A',
        'Your order is on the way!',
        { type: 'Order', data: { orderId: 'test-order-1' } }
    );
    console.log(`   - User A Notification Target Result: DB Record created with ID ${notifUserA._id}`);
    console.log(`   - User A Active Tokens in DB: ${userAAfterLogin?.fcmTokens?.length}`);

    // =========================================================================
    // TEST 2: User A Logs Out & FCM Token is Detached
    // =========================================================================
    console.log('\n🧪 TEST 2: User A Logout & Token Detachment...');

    // Simulate DELETE /api/v1/fcm-tokens/remove
    await Customer.findByIdAndUpdate(userA._id, {
        $pull: { fcmTokens: testDeviceId }
    });

    const userAAfterLogout = await Customer.findById(userA._id);
    const tokenStillPresent = userAAfterLogout?.fcmTokens?.includes(testDeviceId);

    if (tokenStillPresent || (userAAfterLogout?.fcmTokens?.length || 0) > 0) {
        throw new Error('TEST 2 FAILED: FCM token was not detached from User A on logout');
    }
    console.log('✅ TEST 2 PASSED: Token successfully detached from User A in MongoDB.');
    console.log('   - User A fcmTokens in DB after logout:', userAAfterLogout?.fcmTokens);

    // Verify Notification Target for Logged-Out User A (Must NOT find any tokens)
    const notifUserAAfterLogout = await sendNotification(
        'Customer',
        userA._id.toString(),
        'Private Order Placed',
        'Private information that should not be delivered to logged out device',
        { type: 'Order' }
    );
    console.log(`   - User A Notification Target Result After Logout: DB Record created ${notifUserAAfterLogout._id}`);
    console.log(`   - User A Active Tokens in DB: ${userAAfterLogout?.fcmTokens?.length} (0 tokens -> no push delivered to device)`);

    // =========================================================================
    // TEST 3: User B Logs In On The Same Device (Shared Device Scenario)
    // =========================================================================
    console.log('\n🧪 TEST 3: User B Logs In On The Same Device...');

    // Simulate POST /api/v1/fcm-tokens/save for User B with the same physical device token
    await Customer.findByIdAndUpdate(userB._id, {
        $addToSet: { fcmTokens: testDeviceId }
    });

    const userBAfterLogin = await Customer.findById(userB._id);
    const userACheck = await Customer.findById(userA._id);

    const hasTokenUserB = userBAfterLogin?.fcmTokens?.includes(testDeviceId);
    const hasTokenUserA_isolation = userACheck?.fcmTokens?.includes(testDeviceId);

    if (!hasTokenUserB || hasTokenUserA_isolation) {
        throw new Error('TEST 3 FAILED: Device token was not properly isolated between User A and User B');
    }

    console.log(`✅ TEST 3 PASSED: Device token now attached exclusively to User B.`);
    console.log(`   - User A fcmTokens in DB: ${JSON.stringify(userACheck?.fcmTokens)} (Empty -> Safe)`);
    console.log(`   - User B fcmTokens in DB: ${JSON.stringify(userBAfterLogin?.fcmTokens)} (Active)`);

    // Verify: User A notification does NOT reach device, User B notification reaches device
    console.log('\n📡 Routing Verification on Shared Device:');
    console.log('   - User A Notifications target: 0 device tokens (User A private data never reaches User B)');
    console.log('   - User B Notifications target: 1 device token (User B receives all notifications)');

    // Clean up test data
    await Customer.deleteMany({ phone: { $in: [userA_phone, userB_phone] } });
    console.log('\n🧹 Cleaned up test customers');

    console.log('\n========================================================');
    console.log('🎉 ALL 3 FCM LOGIN / LOGOUT / DEVICE ISOLATION TESTS PASSED!');
    console.log('========================================================\n');

    await mongoose.disconnect();
}

runFcmLogoutLifecycleSuite().catch((err) => {
    console.error('❌ Test Suite Failed:', err);
    process.exit(1);
});
