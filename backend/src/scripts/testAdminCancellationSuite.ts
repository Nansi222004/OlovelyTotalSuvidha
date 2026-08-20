import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Payment from "../models/Payment";
import Commission from "../models/Commission";
import Customer from "../models/Customer";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import Product from "../models/Product";
import DeliveryAssignment from "../models/DeliveryAssignment";
import { capturePayment } from "../services/paymentService";
import { updateOrderStatus } from "../modules/admin/controllers/adminOrderController";

async function runAdminCancellationSuite() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely";
  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB for Admin Cancellation Test Suite\n");

  const timestamp = Date.now();

  // Create test entities
  const testCust = await Customer.create({
    name: "Admin Cancel Test Customer",
    email: `admin_cancel_cust_${timestamp}@test.com`,
    phone: `99${timestamp.toString().slice(-8)}`,
    walletAmount: 100,
  });

  const testSeller = await Seller.create({
    sellerName: "Admin Cancel Test Seller",
    storeName: "Admin Cancel Store",
    email: `admin_cancel_seller_${timestamp}@test.com`,
    mobile: `88${timestamp.toString().slice(-8)}`,
    category: "General",
    commissionRate: 10,
    balance: 0,
    status: "Approved",
  });

  const testDriver = await Delivery.create({
    name: "Admin Cancel Test Driver",
    mobile: `66${timestamp.toString().slice(-8)}`,
    email: `admin_cancel_driver_${timestamp}@test.com`,
    password: "password123",
    commissionRate: 5,
    balance: 0,
    status: "Active",
  });

  const initialStock = 50;
  const testProd = await Product.create({
    productName: "Admin Cancel Test Product",
    price: 551,
    discPrice: 551,
    stock: initialStock,
    seller: testSeller._id,
    category: new mongoose.Types.ObjectId(),
    headerCategoryId: new mongoose.Types.ObjectId(),
  });

  console.log("--- TEST 1: Admin Cancels Online Paid Order (₹551) ---");
  const order1Item = await OrderItem.create({
    order: new mongoose.Types.ObjectId(),
    product: testProd._id,
    seller: testSeller._id,
    productName: testProd.productName,
    unitPrice: 551,
    quantity: 1,
    total: 551,
    subtotal: 551,
    commissionRate: 10,
    commissionAmount: 55.1,
    status: "Pending",
    sellerStatus: "Accepted",
  });

  const order1 = await Order.create({
    orderNumber: `ORD_ADMIN_CANCEL_1_${timestamp}`,
    customer: testCust._id,
    customerName: testCust.name,
    customerEmail: testCust.email,
    customerPhone: testCust.mobile,
    deliveryAddress: { address: "Admin St", city: "Admin City", pincode: "123456" },
    subtotal: 551,
    tax: 0,
    shipping: 0,
    platformFee: 0,
    total: 551,
    onlineAmountPaid: 551,
    paymentMethod: "Online",
    paymentStatus: "Pending",
    status: "Received",
    items: [order1Item._id],
    deliveryBoy: testDriver._id,
    deliveryBoyStatus: "Assigned",
  });

  order1Item.order = order1._id as any;
  await order1Item.save();

  await DeliveryAssignment.create({
    order: order1._id,
    deliveryBoy: testDriver._id,
    assignedBy: new mongoose.Types.ObjectId(),
    status: "Assigned",
    assignedAt: new Date(),
  });

  await Commission.create({
    order: order1._id,
    orderItem: order1Item._id,
    seller: testSeller._id,
    type: "SELLER",
    orderAmount: 551,
    commissionRate: 10,
    commissionAmount: 55.1,
    status: "Pending",
  });

  // Capture payment online
  const mockPaymentId = `pay_mock_${timestamp}_1`;
  await capturePayment(order1._id.toString(), `order_mock_${timestamp}_1`, mockPaymentId, `sig_mock_${timestamp}_1`);

  // Simulate Admin cancelling order via req/res mock
  const reqMock1: any = {
    params: { id: order1._id.toString() },
    body: { status: "Cancelled", adminNotes: "Admin test cancel online order" },
    user: { userId: new mongoose.Types.ObjectId().toString() },
    app: { get: () => null },
  };

  let statusSent1 = 0;
  let jsonSent1: any = null;
  const resMock1: any = {
    status: (code: number) => { statusSent1 = code; return resMock1; },
    json: (data: any) => { jsonSent1 = data; return resMock1; },
  };

  const nextMock1 = (err: any) => { if (err) console.error("❌ Express next error (1):", err); };
  try {
    updateOrderStatus(reqMock1, resMock1, nextMock1);
    await new Promise((r) => setTimeout(r, 2000));
  } catch (e: any) {
    console.error("❌ Exception during updateOrderStatus:", e);
  }

  const updatedOrder1 = await Order.findById(order1._id);
  const updatedPayment1 = await Payment.findOne({ order: order1._id });
  const updatedItem1 = await OrderItem.findById(order1Item._id);
  const updatedProd1 = await Product.findById(testProd._id);
  const updatedCommission1 = await Commission.findOne({ order: order1._id });
  const updatedAssignment1 = await DeliveryAssignment.findOne({ order: order1._id });

  console.log(`HTTP Status: ${statusSent1}`);
  console.log(`Order Status: ${updatedOrder1?.status}`);
  console.log(`Order Payment Status: ${updatedOrder1?.paymentStatus}`);
  console.log(`Payment Doc Status: ${updatedPayment1?.status}`);
  console.log(`Payment Refund Amount: ₹${updatedPayment1?.refundAmount} (Expected: ₹551)`);
  console.log(`Stock Restored: ${updatedProd1?.stock} (Expected: ${initialStock + 1})`);
  console.log(`Commission Status: ${updatedCommission1?.status}`);
  console.log(`Delivery Assignment Status: ${updatedAssignment1?.status}`);

  if (
    statusSent1 === 200 &&
    updatedOrder1?.status === "Cancelled" &&
    updatedOrder1?.paymentStatus === "Refunded" &&
    updatedPayment1?.status === "Refunded" &&
    updatedPayment1?.refundAmount === 551 &&
    updatedProd1?.stock === initialStock + 1 &&
    updatedCommission1?.status === "Cancelled" &&
    updatedAssignment1?.status === "Cancelled"
  ) {
    console.log("✅ TEST 1 PASSED: Admin online order cancellation (₹551) successfully executed exact ₹551 refund, stock restoration, and cleanup!\n");
  } else {
    console.error("❌ TEST 1 FAILED\n");
    process.exit(1);
  }

  console.log("--- TEST 2: Duplicate Admin Cancellation Blocked by Idempotency Guard ---");
  let statusSent2 = 0;
  let jsonSent2: any = null;
  const resMock2: any = {
    status: (code: number) => { statusSent2 = code; return resMock2; },
    json: (data: any) => { jsonSent2 = data; return resMock2; },
  };

  const nextMock2 = (err: any) => { if (err) console.error("Express next error (2):", err); };
  updateOrderStatus(reqMock1, resMock2, nextMock2);
  await new Promise((r) => setTimeout(r, 1000));

  const updatedProd2 = await Product.findById(testProd._id);
  console.log(`Duplicate HTTP Status: ${statusSent2}`);
  console.log(`Stock After Duplicate Attempt: ${updatedProd2?.stock} (Must remain: ${initialStock + 1})`);

  if (statusSent2 === 400 && updatedProd2?.stock === initialStock + 1) {
    console.log("✅ TEST 2 PASSED: Idempotency guard blocked duplicate Admin cancellation and prevented double stock restoration!\n");
  } else {
    console.error("❌ TEST 2 FAILED\n");
    process.exit(1);
  }

  // Cleanup test records
  await Customer.deleteOne({ _id: testCust._id });
  await Seller.deleteOne({ _id: testSeller._id });
  await Delivery.deleteOne({ _id: testDriver._id });
  await Product.deleteOne({ _id: testProd._id });
  await Order.deleteOne({ _id: order1._id });
  await OrderItem.deleteOne({ _id: order1Item._id });
  await Payment.deleteOne({ order: order1._id });
  await Commission.deleteOne({ order: order1._id });
  await DeliveryAssignment.deleteOne({ order: order1._id });

  await mongoose.disconnect();
  console.log("🎉 ALL ADMIN CANCELLATION UNIT TESTS PASSED SUCCESSFULLY!");
}

runAdminCancellationSuite().catch((err) => {
  console.error("Fatal error in testAdminCancellationSuite:", err);
  process.exit(1);
});
