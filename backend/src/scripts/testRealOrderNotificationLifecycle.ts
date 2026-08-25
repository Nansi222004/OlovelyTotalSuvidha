import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Customer from '../models/Customer';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Product from '../models/Product';
import Notification from '../models/Notification';
import DeliveryOrderOffer from '../models/DeliveryOrderOffer';
import { sendOrderStatusNotification, sendNotification } from '../services/notificationService';
import { handleOrderAcceptance, handleOrderRejection } from '../services/orderNotificationService';
import { recomputeOrderFulfillment } from '../services/orderFulfillmentOrchestrator';

dotenv.config({ path: path.join(__dirname, '../../.env') });
import { initializeFirebaseAdmin } from '../services/firebaseAdmin';
initializeFirebaseAdmin();

async function runRealOrderNotificationLifecycle() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/olovely';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB for Real Order Lifecycle Notification Audit\n');

  const capturedEvents: Array<{ room?: string; event: string; payload: any }> = [];
  const mockIo: any = {
    to: (room: string) => ({
      emit: (event: string, payload: any) => {
        capturedEvents.push({ room, event, payload });
        console.log(`📡 [MOCK IO] Room: ${room} | Event: ${event}`);
      },
    }),
    emit: (event: string, payload: any) => {
      capturedEvents.push({ event, payload });
      console.log(`📡 [MOCK IO] Global Event: ${event}`);
    },
  };

  const testReport: Array<{ step: string; status: 'PASS' | 'FAIL'; details: string }> = [];

  try {
    // 1. Setup Test Users with FCM Tokens
    const customer = await Customer.create({
      name: 'Test Customer E2E',
      phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `cust_e2e_${Date.now()}@test.com`,
      password: 'Password123!',
      status: 'Active',
      fcmTokens: ['fcm_token_cust_web_sample_12345'],
    });

    const seller = await Seller.create({
      sellerName: 'Test Seller E2E',
      storeName: 'E2E Mart',
      mobile: `88${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `seller_e2e_${Date.now()}@test.com`,
      password: 'Password123!',
      category: 'Grocery',
      status: 'Approved',
      isOnline: true,
      city: 'Delhi',
      latitude: '28.6139',
      longitude: '77.2090',
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      fcmTokens: ['fcm_token_seller_web_sample_12345'],
    });

    const deliveryBoy = await Delivery.create({
      name: 'Test Driver E2E',
      mobile: `77${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `driver_e2e_${Date.now()}@test.com`,
      password: 'Password123!',
      status: 'Active',
      isOnline: true,
      city: 'Delhi',
      latitude: '28.6139',
      longitude: '77.2090',
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      fcmTokens: ['fcm_token_driver_web_sample_12345'],
    });

    const product = await Product.create({
      productName: 'Fresh Grocery Item',
      price: 250,
      discPrice: 200,
      seller: seller._id,
      category: new mongoose.Types.ObjectId(),
      sku: `SKU_E2E_${Date.now()}`,
      stock: 100,
    });

    console.log(`👤 Customer Created ID: ${customer._id}`);
    console.log(`🏪 Seller Created ID: ${seller._id}`);
    console.log(`🛵 Delivery Driver Created ID: ${deliveryBoy._id}`);

    // ==========================================
    // ORDER 1: COMPLETE ACCEPTANCE & LIFECYCLE
    // ==========================================
    console.log('\n--- STARTING TEST ORDER 1 (Accept Flow) ---');
    const order1 = await Order.create({
      orderNumber: `ORD_E2E_ACCEPT_${Date.now()}`,
      orderDate: new Date(),
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      deliveryAddress: {
        address: 'Connaught Place',
        city: 'Delhi',
        pincode: '110001',
        latitude: 28.6139,
        longitude: 77.2090,
      },
      subtotal: 200,
      total: 220,
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Received',
      deliveryOption: 'Instant',
      items: [],
    });

    const orderItem1 = await OrderItem.create({
      order: order1._id,
      product: product._id,
      productName: product.productName,
      seller: seller._id,
      sellerStatus: 'Pending',
      unitPrice: 200,
      quantity: 1,
      total: 200,
    });
    order1.items = [orderItem1._id];
    await order1.save();

    console.log(`📦 Order 1 Created ID: ${order1._id} (${order1.orderNumber})`);

    // Step 1: Customer Order Placed Notification
    await sendOrderStatusNotification(order1._id.toString(), customer._id.toString(), 'Received', mockIo);
    const notifOrderPlaced = await Notification.findOne({ recipientId: customer._id, title: /Order Placed/ });
    if (notifOrderPlaced) {
      testReport.push({ step: '1. Order Placed Notification', status: 'PASS', details: `Notif ID: ${notifOrderPlaced._id}, Title: ${notifOrderPlaced.title}` });
    } else {
      testReport.push({ step: '1. Order Placed Notification', status: 'FAIL', details: 'Notification record missing' });
    }

    // Step 2: Seller Accepts Order
    orderItem1.sellerStatus = 'Accepted';
    await orderItem1.save();
    const fulfillment1 = await recomputeOrderFulfillment(order1._id.toString(), mockIo);
    const order1AfterSellerAccept = await Order.findById(order1._id);
    const notifOrderAccepted = await Notification.findOne({ recipientId: customer._id, title: /Order Accepted/ });

    if (order1AfterSellerAccept?.status === 'Accepted' && notifOrderAccepted) {
      testReport.push({ step: '2. Seller Acceptance & Customer Push', status: 'PASS', details: `Order Status: Accepted, Customer Notif: ${notifOrderAccepted.title}` });
    } else {
      testReport.push({ step: '2. Seller Acceptance & Customer Push', status: 'FAIL', details: `Status: ${order1AfterSellerAccept?.status}, Notif: ${Boolean(notifOrderAccepted)}` });
    }

    // Step 3: Delivery Partner New Order Notification Link Verification
    const driverNotif = await Notification.findOne({ recipientId: deliveryBoy._id, recipientType: 'Delivery' });
    if (driverNotif && driverNotif.link === '/delivery') {
      testReport.push({ step: '3. Delivery Push Link Target (/delivery)', status: 'PASS', details: `Link is strictly /delivery (NOT /delivery/orders/:id)` });
    } else {
      testReport.push({ step: '3. Delivery Push Link Target (/delivery)', status: 'FAIL', details: `Link found: ${driverNotif?.link || 'None'}` });
    }

    // Step 4: Verify Order is NOT auto-accepted
    const orderBeforeDriverAccept = await Order.findById(order1._id);
    if (!orderBeforeDriverAccept?.deliveryBoy) {
      testReport.push({ step: '4. No Auto-Accept On Notification Dispatch', status: 'PASS', details: 'order.deliveryBoy is null until explicit driver click' });
    } else {
      testReport.push({ step: '4. No Auto-Accept On Notification Dispatch', status: 'FAIL', details: `Assigned prematurely to ${orderBeforeDriverAccept?.deliveryBoy}` });
    }

    // Step 5: Explicit Driver Accept Action
    const acceptRes = await handleOrderAcceptance(mockIo, order1._id.toString(), deliveryBoy._id.toString());
    const order1AfterDriverAccept = await Order.findById(order1._id);
    if (acceptRes.success && order1AfterDriverAccept?.deliveryBoy?.toString() === deliveryBoy._id.toString()) {
      testReport.push({ step: '5. Explicit Driver Accept Action', status: 'PASS', details: `Successfully assigned to driver ${deliveryBoy._id}` });
    } else {
      testReport.push({ step: '5. Explicit Driver Accept Action', status: 'FAIL', details: acceptRes.message });
    }

    // Step 6: Out for Delivery Transition & Customer Push
    order1AfterDriverAccept!.status = 'Out for Delivery';
    await order1AfterDriverAccept!.save();
    await sendOrderStatusNotification(order1._id.toString(), customer._id.toString(), 'Out for Delivery', mockIo);
    const notifOutForDelivery = await Notification.findOne({ recipientId: customer._id, title: /Out for Delivery/ });
    if (notifOutForDelivery) {
      testReport.push({ step: '6. Out for Delivery Customer Push', status: 'PASS', details: `Title: ${notifOutForDelivery.title}, Link: ${notifOutForDelivery.link}` });
    } else {
      testReport.push({ step: '6. Out for Delivery Customer Push', status: 'FAIL', details: 'Notification missing' });
    }

    // Step 7: Order Delivered Transition & Customer Push
    order1AfterDriverAccept!.status = 'Delivered';
    await order1AfterDriverAccept!.save();
    await sendOrderStatusNotification(order1._id.toString(), customer._id.toString(), 'Delivered', mockIo);
    const notifDelivered = await Notification.findOne({ recipientId: customer._id, title: /Order Delivered/ });
    if (notifDelivered) {
      testReport.push({ step: '7. Delivered Customer Push', status: 'PASS', details: `Title: ${notifDelivered.title}, Link: ${notifDelivered.link}` });
    } else {
      testReport.push({ step: '7. Delivered Customer Push', status: 'FAIL', details: 'Notification missing' });
    }

    // ==========================================
    // ORDER 2: REJECTION FLOW TEST
    // ==========================================
    console.log('\n--- STARTING TEST ORDER 2 (Reject Flow) ---');
    const order2 = await Order.create({
      orderNumber: `ORD_E2E_REJECT_${Date.now()}`,
      orderDate: new Date(),
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      deliveryAddress: { address: 'Connaught Place', city: 'Delhi', pincode: '110001', latitude: 28.6139, longitude: 77.2090 },
      subtotal: 200,
      total: 220,
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Received',
      deliveryOption: 'Instant',
      items: [],
    });

    const orderItem2 = await OrderItem.create({
      order: order2._id,
      product: product._id,
      productName: product.productName,
      seller: seller._id,
      sellerStatus: 'Accepted',
      unitPrice: 200,
      quantity: 1,
      total: 200,
    });
    order2.items = [orderItem2._id];
    await order2.save();

    await recomputeOrderFulfillment(order2._id.toString(), mockIo);
    const rejectRes = await handleOrderRejection(mockIo, order2._id.toString(), deliveryBoy._id.toString());
    const order2AfterReject = await Order.findById(order2._id);

    if (rejectRes.success && !order2AfterReject?.deliveryBoy) {
      testReport.push({ step: '8. Explicit Driver Reject Action', status: 'PASS', details: `Offer rejected, order remains unassigned (deliveryBoy: ${order2AfterReject?.deliveryBoy || 'null'})` });
    } else {
      testReport.push({ step: '8. Explicit Driver Reject Action', status: 'FAIL', details: rejectRes.message });
    }

    // ==========================================
    // ORDER 3: SELF ASSIGN FLOW TEST
    // ==========================================
    console.log('\n--- STARTING TEST ORDER 3 (Self Assign Flow) ---');
    const order3 = await Order.create({
      orderNumber: `ORD_E2E_SELF_${Date.now()}`,
      orderDate: new Date(),
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      deliveryAddress: { address: 'Connaught Place', city: 'Delhi', pincode: '110001', latitude: 28.6139, longitude: 77.2090 },
      subtotal: 200,
      total: 220,
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Received',
      deliveryPreference: 'Self',
      deliveryOption: 'Standard',
      items: [],
    });

    const orderItem3 = await OrderItem.create({
      order: order3._id,
      product: product._id,
      productName: product.productName,
      seller: seller._id,
      sellerStatus: 'Accepted',
      unitPrice: 200,
      quantity: 1,
      total: 200,
    });
    order3.items = [orderItem3._id];
    await order3.save();

    // Seller updates status to On the way & Delivered
    await sendOrderStatusNotification(order3._id.toString(), customer._id.toString(), 'On the way', mockIo);
    await sendOrderStatusNotification(order3._id.toString(), customer._id.toString(), 'Delivered', mockIo);

    const selfNotifOnWay = await Notification.findOne({ recipientId: customer._id, link: `/orders/${order3._id}`, title: /Out for Delivery/ });
    const selfNotifDelivered = await Notification.findOne({ recipientId: customer._id, link: `/orders/${order3._id}`, title: /Order Delivered/ });

    if (selfNotifOnWay && selfNotifDelivered) {
      testReport.push({ step: '9. Self Assign Customer Status Push Notifications', status: 'PASS', details: 'Customer received Out for Delivery & Delivered notifications without delivery boy token' });
    } else {
      testReport.push({ step: '9. Self Assign Customer Status Push Notifications', status: 'FAIL', details: `OnWay: ${Boolean(selfNotifOnWay)}, Delivered: ${Boolean(selfNotifDelivered)}` });
    }

    // Cleanup test entities
    await Customer.deleteOne({ _id: customer._id });
    await Seller.deleteOne({ _id: seller._id });
    await Delivery.deleteOne({ _id: deliveryBoy._id });
    await Product.deleteOne({ _id: product._id });
    await Order.deleteMany({ _id: { $in: [order1._id, order2._id, order3._id] } });
    await OrderItem.deleteMany({ order: { $in: [order1._id, order2._id, order3._id] } });
    await DeliveryOrderOffer.deleteMany({ order: { $in: [order1._id, order2._id, order3._id] } });
    await Notification.deleteMany({ recipientId: { $in: [customer._id.toString(), seller._id.toString(), deliveryBoy._id.toString()] } });

    console.log('\n===============================================================');
    console.log('REAL-TIME ORDER NOTIFICATION LIFECYCLE AUDIT REPORT');
    console.log('===============================================================\n');

    let allOk = true;
    for (const r of testReport) {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} [${r.status}] ${r.step}`);
      console.log(`   ${r.details}\n`);
      if (r.status === 'FAIL') allOk = false;
    }

    if (allOk) {
      console.log('🎉 ALL NOTIFICATION LIFECYCLE AUDITS PASSED WITH 100% SUCCESS!\n');
    } else {
      console.error('❌ NOTIFICATION AUDIT FAILED SOME STEPS.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal execution error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runRealOrderNotificationLifecycle();
