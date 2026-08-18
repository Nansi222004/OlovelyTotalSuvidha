import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { createRazorpayOrder, capturePayment } from '../services/paymentService';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/olovely_total_suvidha';

async function testOnlineCheckout() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const orderObjId = new mongoose.Types.ObjectId();
    const sellerObjId = new mongoose.Types.ObjectId();

    // 1. Create a test OrderItem first
    const testItem = await OrderItem.create({
      order: orderObjId,
      seller: sellerObjId,
      product: new mongoose.Types.ObjectId(),
      productName: 'Test Item',
      quantity: 1,
      unitPrice: 500,
      price: 500,
      total: 500,
    });

    // 2. Create a valid order document
    const testOrder = await Order.create({
      _id: orderObjId,
      orderNumber: `ORD_TEST_${Date.now()}`,
      orderDate: new Date(),
      customer: new mongoose.Types.ObjectId(),
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      customerPhone: '9876543210',
      items: [testItem._id],
      subtotal: 500,
      tax: 0,
      shipping: 0,
      platformFee: 0,
      discount: 0,
      total: 500,
      paymentMethod: 'Online',
      paymentStatus: 'Pending',
      status: 'Received',
      deliveryAddress: {
        address: 'Test Street',
        city: 'Indore',
        state: 'MP',
        pincode: '452001',
      },
    });

    console.log(`📦 Created Test Order: ${testOrder.orderNumber} (ID: ${testOrder._id})`);

    // 3. Test createRazorpayOrder
    console.log('🔄 Calling createRazorpayOrder...');
    const orderRes = await createRazorpayOrder(testOrder._id.toString(), testOrder.total);
    console.log('Order Creation Response:', JSON.stringify(orderRes, null, 2));

    if (!orderRes.success) {
      throw new Error(`Order creation failed: ${orderRes.message}`);
    }

    const { razorpayOrderId } = orderRes.data;

    // 4. Test capturePayment
    console.log('🔄 Testing capturePayment...');
    const mockPaymentId = `pay_mock_${Date.now()}`;
    const mockSignature = `sig_mock_${Date.now()}`;

    const captureRes = await capturePayment(
      testOrder._id.toString(),
      razorpayOrderId,
      mockPaymentId,
      mockSignature
    );

    console.log('Capture Response:', JSON.stringify(captureRes, null, 2));

    if (!captureRes.success) {
      throw new Error(`Payment capture failed: ${captureRes.message}`);
    }

    // 5. Verify order status in DB
    const updatedOrder = await Order.findById(testOrder._id);
    console.log('Updated Order Payment Status:', updatedOrder?.paymentStatus);
    console.log('Updated Order Payment ID:', updatedOrder?.paymentId);

    if (updatedOrder?.paymentStatus === 'Paid' && updatedOrder?.paymentId === mockPaymentId) {
      console.log('🎉 ONLINE PAYMENT ORDER CHECKOUT TEST PASSED 100%!');
    } else {
      console.error('❌ Order payment status not updated properly');
    }

    // Cleanup
    await Order.findByIdAndDelete(testOrder._id);
    await OrderItem.findByIdAndDelete(testItem._id);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testOnlineCheckout();
