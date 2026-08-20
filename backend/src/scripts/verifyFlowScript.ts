import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkOrder() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('No MONGO_URI');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
  const Payment = mongoose.model('Payment', new mongoose.Schema({}, { strict: false }));

  const targetId = '6a85e3710a77e92d05435b49';
  const order = await Order.findById(targetId).lean() as any;

  if (!order) {
    console.log(`Order ${targetId} NOT FOUND in MongoDB!`);
    // Search by paymentId or recent orders
    const recent = await Order.find().sort({ createdAt: -1 }).limit(5).lean();
    console.log('Recent 5 orders in DB:');
    for (const o of recent as any[]) {
      console.log(`- ID: ${o._id} | Num: ${o.orderNumber} | Created: ${o.createdAt} | Status: ${o.status} | PayStatus: ${o.paymentStatus} | Method: ${o.paymentMethod} | PayId: ${o.paymentId}`);
    }
  } else {
    console.log('\n=== EXACT ORDER FROM TEST ===');
    console.log('ID:', order._id);
    console.log('Order Number:', order.orderNumber);
    console.log('Created At:', order.createdAt);
    console.log('Updated At:', order.updatedAt);
    console.log('Status:', order.status);
    console.log('Payment Status:', order.paymentStatus);
    console.log('Payment Method:', order.paymentMethod);
    console.log('Payment ID:', order.paymentId);
    console.log('Online Amount Paid:', order.onlineAmountPaid);
    console.log('COD Amount Pending:', order.codAmountPending);

    const payment = await Payment.findOne({
      $or: [{ order: order._id }, { razorpayPaymentId: 'pay_TRhouMBS4qZLSN' }]
    }).lean() as any;

    if (payment) {
      console.log('\n=== PAYMENT RECORD ===');
      console.log('Payment ID:', payment._id);
      console.log('Razorpay Payment ID:', payment.razorpayPaymentId);
      console.log('Razorpay Order ID:', payment.razorpayOrderId);
      console.log('Status:', payment.status);
      console.log('Refund ID:', payment.refundId);
      console.log('Refund Amount:', payment.refundAmount);
    } else {
      console.log('\n=== PAYMENT RECORD: NOT FOUND ===');
    }
  }

  await mongoose.disconnect();
}

checkOrder().catch(console.error);
