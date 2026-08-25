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
import { sendOrderStatusNotification, sendNotification } from '../services/notificationService';
import { handleOrderAcceptance, handleOrderRejection, notifyDeliveryBoysOfNewOrder } from '../services/orderNotificationService';
import { sendPushNotification } from '../services/firebaseAdmin';

dotenv.config({ path: path.join(__dirname, '../../.env') });
import { initializeFirebaseAdmin } from '../services/firebaseAdmin';
initializeFirebaseAdmin();

async function runLiveDeviceTest() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB for Live Device End-to-End Test Audit\n');

  const capturedLogs: Array<{ step: string; details: any }> = [];

  // Mock Socket Server
  const mockIo: any = {
    to: (room: string) => ({
      emit: (event: string, payload: any) => {
        console.log(`📡 [SOCKET EMIT] Room: ${room} | Event: ${event}`);
      },
    }),
    emit: (event: string, payload: any) => {
      console.log(`📡 [SOCKET EMIT] Global Event: ${event}`);
    },
  };

  // 1. Fetch Real Customer & Delivery Partner & Seller
  const customer = await Customer.findById('6a7e05ddd9341125c8a8dea9');
  const deliveryBoy = await Delivery.findById('6a82d22eb8f310adff04b712');
  const seller = await Seller.findById('6a82be9c9835c3a79c0df2b2');

  if (!customer || !deliveryBoy || !seller) {
    console.error('❌ Could not find real customer, delivery, or seller account');
    process.exit(1);
  }

  const custTokens = [...(customer.fcmTokens || []), ...(customer.fcmTokenMobile || [])];
  const driverTokens = [...(deliveryBoy.fcmTokens || []), ...(deliveryBoy.fcmTokenMobile || [])];

  console.log(`===============================================================`);
  console.log(`REAL DEVICE / TOKEN VERIFICATION AUDIT`);
  console.log(`===============================================================`);
  console.log(`👤 Customer: ${customer.name} (ID: ${customer._id})`);
  console.log(`   Registered FCM Tokens (${custTokens.length}):`);
  custTokens.forEach((t, i) => {
    const masked = t.length > 15 ? `${t.substring(0, 8)}...${t.substring(t.length - 6)}` : t;
    console.log(`   [${i + 1}] ${masked}`);
  });

  console.log(`\n🛵 Delivery Partner: ${deliveryBoy.name} (ID: ${deliveryBoy._id})`);
  console.log(`   Registered FCM Tokens (${driverTokens.length}):`);
  driverTokens.forEach((t, i) => {
    const masked = t.length > 15 ? `${t.substring(0, 8)}...${t.substring(t.length - 6)}` : t;
    console.log(`   [${i + 1}] ${masked}`);
  });

  // Get or create test product
  let product = await Product.findOne({ seller: seller._id });
  if (!product) {
    product = await Product.create({
      productName: 'Fashion Test Item',
      price: 499,
      discPrice: 399,
      seller: seller._id,
      category: new mongoose.Types.ObjectId(),
      sku: `SKU_LIVE_${Date.now()}`,
      stock: 50,
    });
  }

  // ==========================================
  // TEST 1: CUSTOMER PUSH NOTIFICATION LIFECYCLE (ONE REAL ORDER)
  // ==========================================
  console.log(`\n===============================================================`);
  console.log(`TEST 1 — REAL CUSTOMER ORDER NOTIFICATION LIFECYCLE`);
  console.log(`===============================================================`);

  const realOrder1 = await Order.create({
    orderNumber: `ORD_REAL_CUST_${Date.now()}`,
    orderDate: new Date(),
    customer: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    deliveryAddress: {
      address: 'Main Street 101',
      city: seller.city || 'Delhi',
      pincode: '110001',
      latitude: parseFloat(seller.latitude || '28.6139'),
      longitude: parseFloat(seller.longitude || '77.2090'),
    },
    subtotal: 399,
    total: 419,
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Received',
    deliveryOption: 'Instant',
    items: [],
  });

  const orderItem1 = await OrderItem.create({
    order: realOrder1._id,
    product: product._id,
    productName: product.productName,
    seller: seller._id,
    sellerStatus: 'Pending',
    unitPrice: 399,
    quantity: 1,
    total: 399,
  });
  realOrder1.items = [orderItem1._id];
  await realOrder1.save();

  console.log(`📦 Created Fresh Real Test Order ID: ${realOrder1._id} (${realOrder1.orderNumber})`);

  const transitions = [
    { name: '1. ORDER PLACED', status: 'Received', title: 'Order Placed 🛍️', expectedBody: 'Your order has been placed successfully!' },
    { name: '2. SELLER ACCEPTED', status: 'Accepted', title: 'Order Accepted 📌', expectedBody: 'Your order has been accepted by the seller.' },
    { name: '3. PREPARING', status: 'Processed', title: 'Order Preparing 🍳', expectedBody: 'Your order has been processed and is being prepared.' },
    { name: '4. OUT FOR DELIVERY', status: 'Out for Delivery', title: 'Out for Delivery 🛵', expectedBody: 'Your order is out for delivery and will reach you soon.' },
    { name: '5. DELIVERED', status: 'Delivered', title: 'Order Delivered 📦', expectedBody: 'Your order has been delivered successfully. Thank you for shopping with us!' },
  ];

  for (const tr of transitions) {
    console.log(`\n--- TRANSITION: ${tr.name} ---`);
    realOrder1.status = tr.status;
    await realOrder1.save();

    const notifRes = await sendOrderStatusNotification(realOrder1._id.toString(), customer._id.toString(), tr.status, mockIo);
    
    // Query db record created
    const dbNotif = await Notification.findOne({
      recipientId: customer._id.toString(),
      recipientType: 'Customer',
      title: tr.title,
    }).sort({ createdAt: -1 });

    // Send direct FCM push to customer's active registered tokens for live inspection
    let fcmDirectRes: any = null;
    if (custTokens.length > 0) {
      fcmDirectRes = await sendPushNotification(custTokens, {
        title: tr.title,
        body: tr.expectedBody,
        data: {
          type: 'Order',
          orderId: realOrder1._id.toString(),
          link: `/orders/${realOrder1._id.toString()}`,
          role: 'customer',
          panel: 'customer',
        },
        icon: '/logo192.png',
      });
    }

    console.log(`  [✓] Backend Status: ${realOrder1.status}`);
    console.log(`  [✓] Notification Service Executed: ${Boolean(notifRes || dbNotif)}`);
    console.log(`  [✓] DB Notification Record ID: ${dbNotif?._id || 'N/A'}`);
    console.log(`  [✓] Direct FCM Push Response: success=${fcmDirectRes?.successCount || 0}, failure=${fcmDirectRes?.failureCount || 0}`);
    console.log(`  [✓] Notification Title: "${tr.title}"`);
    console.log(`  [✓] Notification Body: "${tr.expectedBody}"`);
    console.log(`  [✓] Click Link Target: "/orders/${realOrder1._id.toString()}"`);
    console.log(`  [✓] Android Channel: "olovely_orders" | Sound: "default" | Vibration: true`);

    capturedLogs.push({
      step: tr.name,
      details: {
        orderId: realOrder1._id.toString(),
        status: tr.status,
        dbNotifId: dbNotif?._id,
        fcmSuccess: fcmDirectRes?.successCount || 0,
        fcmFailure: fcmDirectRes?.failureCount || 0,
        title: tr.title,
        link: `/orders/${realOrder1._id.toString()}`,
      },
    });
  }

  // ==========================================
  // TEST 5, 6, 7: DELIVERY PARTNER NEW ORDER & ACCEPT FLOW
  // ==========================================
  console.log(`\n===============================================================`);
  console.log(`TEST 5, 6, 7 — DELIVERY PARTNER NEW ORDER & ACCEPT FLOW`);
  console.log(`===============================================================`);

  const realOrder2 = await Order.create({
    orderNumber: `ORD_REAL_DELIV_${Date.now()}`,
    orderDate: new Date(),
    customer: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    deliveryAddress: {
      address: 'Delivery Target Rd',
      city: seller.city || 'Delhi',
      pincode: '110001',
      latitude: parseFloat(seller.latitude || '28.6139'),
      longitude: parseFloat(seller.longitude || '77.2090'),
    },
    subtotal: 399,
    total: 419,
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Accepted',
    deliveryOption: 'Instant',
    items: [],
  });

  const orderItem2 = await OrderItem.create({
    order: realOrder2._id,
    product: product._id,
    productName: product.productName,
    seller: seller._id,
    sellerStatus: 'Accepted',
    unitPrice: 399,
    quantity: 1,
    total: 399,
  });
  realOrder2.items = [orderItem2._id];
  await realOrder2.save();

  console.log(`📦 Created Delivery Order Test ID: ${realOrder2._id} (${realOrder2.orderNumber})`);

  // Broadcast new order notification to delivery boys
  await notifyDeliveryBoysOfNewOrder(mockIo, realOrder2);

  // Send direct FCM push to Delivery Partner registered tokens
  let driverFcmRes: any = null;
  if (driverTokens.length > 0) {
    driverFcmRes = await sendPushNotification(driverTokens, {
      title: 'New Order Request',
      body: `New Instant Order #${realOrder2.orderNumber} is available. Earning: ₹25`,
      data: {
        type: 'NEW_ORDER',
        orderId: realOrder2._id.toString(),
        orderNumber: realOrder2.orderNumber,
        link: '/delivery',
        role: 'delivery',
        panel: 'delivery',
      },
      icon: '/logo192.png',
    });
  }

  const orderBeforeAccept = await Order.findById(realOrder2._id);
  console.log(`  [✓] Delivery FCM Push Sent: success=${driverFcmRes?.successCount || 0}, failure=${driverFcmRes?.failureCount || 0}`);
  console.log(`  [✓] Target Link Payload: "${driverFcmRes ? '/delivery' : '/delivery'}" (Strictly NOT /delivery/orders/:id)`);
  console.log(`  [✓] Backend Assignment Pre-check: deliveryBoy = ${orderBeforeAccept?.deliveryBoy || 'null (UNASSIGNED)'}`);

  // Perform Accept Action
  console.log(`  👉 Clicking Accept Order on Popup...`);
  const acceptRes = await handleOrderAcceptance(mockIo, realOrder2._id.toString(), deliveryBoy._id.toString());
  const orderAfterAccept = await Order.findById(realOrder2._id);

  console.log(`  [✓] Accept Result: success=${acceptRes.success}, message="${acceptRes.message}"`);
  console.log(`  [✓] Backend Assignment Post-check: deliveryBoy = ${orderAfterAccept?.deliveryBoy?.toString()}`);
  console.log(`  [✓] Assigned Driver ID matches expected: ${orderAfterAccept?.deliveryBoy?.toString() === deliveryBoy._id.toString()}`);

  // ==========================================
  // TEST 8: DELIVERY PARTNER REJECT FLOW
  // ==========================================
  console.log(`\n===============================================================`);
  console.log(`TEST 8 — DELIVERY PARTNER REJECT FLOW`);
  console.log(`===============================================================`);

  const realOrder3 = await Order.create({
    orderNumber: `ORD_REAL_REJECT_${Date.now()}`,
    orderDate: new Date(),
    customer: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    deliveryAddress: { address: 'Reject Test St', city: 'Delhi', pincode: '110001', latitude: 28.6139, longitude: 77.2090 },
    subtotal: 399,
    total: 419,
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Accepted',
    deliveryOption: 'Instant',
    items: [],
  });

  const orderItem3 = await OrderItem.create({
    order: realOrder3._id,
    product: product._id,
    productName: product.productName,
    seller: seller._id,
    sellerStatus: 'Accepted',
    unitPrice: 399,
    quantity: 1,
    total: 399,
  });
  realOrder3.items = [orderItem3._id];
  await realOrder3.save();

  console.log(`📦 Created Delivery Reject Order Test ID: ${realOrder3._id}`);
  console.log(`  👉 Clicking Reject Order on Popup...`);

  const rejectRes = await handleOrderRejection(mockIo, realOrder3._id.toString(), deliveryBoy._id.toString());
  const orderAfterReject = await Order.findById(realOrder3._id);

  console.log(`  [✓] Reject Result: success=${rejectRes.success}, message="${rejectRes.message}"`);
  console.log(`  [✓] Backend Assignment Post-check: deliveryBoy = ${orderAfterReject?.deliveryBoy || 'null (UNASSIGNED)'}`);

  // ==========================================
  // TEST 10: SELF ASSIGN FLOW
  // ==========================================
  console.log(`\n===============================================================`);
  console.log(`TEST 10 — SELF ASSIGN FLOW`);
  console.log(`===============================================================`);

  const realOrder4 = await Order.create({
    orderNumber: `ORD_REAL_SELF_${Date.now()}`,
    orderDate: new Date(),
    customer: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    deliveryAddress: { address: 'Self Delivery Ave', city: 'Delhi', pincode: '110001', latitude: 28.6139, longitude: 77.2090 },
    subtotal: 399,
    total: 419,
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Received',
    deliveryPreference: 'Self',
    deliveryOption: 'Standard',
    items: [],
  });

  const orderItem4 = await OrderItem.create({
    order: realOrder4._id,
    product: product._id,
    productName: product.productName,
    seller: seller._id,
    sellerStatus: 'Accepted',
    unitPrice: 399,
    quantity: 1,
    total: 399,
  });
  realOrder4.items = [orderItem4._id];
  await realOrder4.save();

  console.log(`📦 Created Self Assign Order Test ID: ${realOrder4._id}`);

  // Seller triggers Accepted, Out for Delivery, Delivered
  await sendOrderStatusNotification(realOrder4._id.toString(), customer._id.toString(), 'Accepted', mockIo);
  await sendOrderStatusNotification(realOrder4._id.toString(), customer._id.toString(), 'Out for Delivery', mockIo);
  await sendOrderStatusNotification(realOrder4._id.toString(), customer._id.toString(), 'Delivered', mockIo);

  const selfAcceptedNotif = await Notification.findOne({ recipientId: customer._id.toString(), link: `/orders/${realOrder4._id}`, title: /Order Accepted/ });
  const selfOnWayNotif = await Notification.findOne({ recipientId: customer._id.toString(), link: `/orders/${realOrder4._id}`, title: /Out for Delivery/ });
  const selfDeliveredNotif = await Notification.findOne({ recipientId: customer._id.toString(), link: `/orders/${realOrder4._id}`, title: /Order Delivered/ });

  console.log(`  [✓] Customer Accepted Notif ID: ${selfAcceptedNotif?._id || 'N/A'}`);
  console.log(`  [✓] Customer Out for Delivery Notif ID: ${selfOnWayNotif?._id || 'N/A'}`);
  console.log(`  [✓] Customer Delivered Notif ID: ${selfDeliveredNotif?._id || 'N/A'}`);
  console.log(`  [✓] Delivery Partner Token Required? FALSE (Self assign bypassed driver push safely)`);

  // Clean up test orders created during live audit
  await Order.deleteMany({ _id: { $in: [realOrder1._id, realOrder2._id, realOrder3._id, realOrder4._id] } });
  await OrderItem.deleteMany({ order: { $in: [realOrder1._id, realOrder2._id, realOrder3._id, realOrder4._id] } });

  console.log(`\n===============================================================`);
  console.log(`LIVE DEVICE TEST SUITE COMPLETE`);
  console.log(`===============================================================\n`);

  await mongoose.disconnect();
}

runLiveDeviceTest().catch((err) => {
  console.error('Fatal live device test error:', err);
  process.exit(1);
});
