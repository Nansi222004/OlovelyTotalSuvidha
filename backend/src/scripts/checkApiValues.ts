import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Commission from '../models/Commission';
import WalletTransaction from '../models/WalletTransaction';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkApi() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  await mongoose.connect(uri);

  console.log('=== 1. ORD1787038914668240 FULL FINANCIAL BREAKDOWN ===');
  const order = await Order.findOne({ orderNumber: 'ORD1787038914668240' });
  if (order) {
    console.log(`Order ID: ${order._id}`);
    console.log(`Status: ${order.status}`);
    console.log(`Payment Status: ${order.paymentStatus}`);
    console.log(`Payment Method: ${order.paymentMethod}`);
    console.log(`Product Subtotal: ₹${order.subtotal}`);
    console.log(`Customer Shipping: ₹${order.shipping}`);
    console.log(`Platform Fee: ₹${order.platformFee}`);
    console.log(`Customer Total: ₹${order.total}`);

    const items = await OrderItem.find({ order: order._id });
    items.forEach(i => {
      console.log(`  Item: ${i.productName}, Total: ₹${i.total}, CommissionRate: ${i.commissionRate}%, CommissionAmount: ₹${i.commissionAmount}`);
    });

    const comms = await Commission.find({ order: order._id });
    comms.forEach(c => {
      console.log(`  Commission (${c.type}): Rate: ${c.commissionRate}%, Amount: ₹${c.commissionAmount}, Status: ${c.status}`);
    });

    const txns = await WalletTransaction.find({ relatedOrder: order._id });
    console.log(`  Wallet Transactions (${txns.length}):`);
    txns.forEach(t => {
      console.log(`    - [${t.type}] UserType: ${t.userType}, Amount: ₹${t.amount}, Ref: ${t.reference}, CreatedAt: ${t.createdAt}`);
    });
  }

  console.log('\n=== 2. CURRENT /admin/wallet API DATA RETURNED FROM CONTROLLER ===');
  // Re-run the controller logic
  const sellerBalanceResult = await Seller.aggregate([
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);
  const sellerPendingPayouts = sellerBalanceResult.length > 0 ? sellerBalanceResult[0].total : 0;

  const deliveryBalanceResult = await Delivery.aggregate([
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$balance' },
        totalPendingDebt: { $sum: '$pendingAdminPayout' },
      },
    },
  ]);
  const deliveryBoyPendingPayouts = deliveryBalanceResult.length > 0 ? deliveryBalanceResult[0].totalBalance : 0;
  const pendingFromDeliveryBoy = deliveryBalanceResult.length > 0 ? deliveryBalanceResult[0].totalPendingDebt : 0;

  const totalOrderAmountResult = await Order.aggregate([
    { $match: { status: { $ne: 'Cancelled' }, paymentStatus: 'Paid' } },
    { $group: { _id: null, total: { $sum: '$total' } } },
  ]);
  const totalPlatformEarning = totalOrderAmountResult.length > 0 ? totalOrderAmountResult[0].total : 0;

  const sellerCommResult = await Commission.aggregate([
    { $match: { type: 'SELLER', status: { $ne: 'Cancelled' } } },
    { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
  ]);
  const sellerCommissions = sellerCommResult.length > 0 ? sellerCommResult[0].total : 0;

  const deliveryCommResult = await Commission.aggregate([
    { $match: { type: 'DELIVERY_BOY', status: { $ne: 'Cancelled' } } },
    { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
  ]);
  const deliveryCommissions = deliveryCommResult.length > 0 ? deliveryCommResult[0].total : 0;

  const orderFeesResult = await Order.aggregate([
    { $match: { status: { $ne: 'Cancelled' }, paymentStatus: 'Paid' } },
    {
      $group: {
        _id: null,
        total: { $sum: { $add: ['$platformFee', '$shipping'] } },
      },
    },
  ]);
  const orderFees = orderFeesResult.length > 0 ? orderFeesResult[0].total : 0;

  const rawAdminEarning = sellerCommissions + orderFees - deliveryCommissions;
  const totalAdminEarning = Math.round(rawAdminEarning * 100) / 100;

  const currentPlatformBalance = Math.max(
    0,
    Math.round((totalPlatformEarning - sellerPendingPayouts - deliveryBoyPendingPayouts) * 100) / 100
  );

  console.log(`totalPlatformEarning (Gross GMV): ₹${totalPlatformEarning}`);
  console.log(`sellerPendingPayouts (Seller Liabilities): ₹${sellerPendingPayouts}`);
  console.log(`deliveryBoyPendingPayouts (Delivery Liabilities): ₹${deliveryBoyPendingPayouts}`);
  console.log(`pendingFromDeliveryBoy (COD Debt): ₹${pendingFromDeliveryBoy}`);
  console.log(`sellerCommissions Collected: ₹${sellerCommissions}`);
  console.log(`deliveryCommissions Payable: ₹${deliveryCommissions}`);
  console.log(`orderFees (Platform Fee + Shipping): ₹${orderFees}`);
  console.log(`totalAdminEarning (Net Profit): ₹${totalAdminEarning}`);
  console.log(`currentPlatformBalance (Available Cash): ₹${currentPlatformBalance}`);

  await mongoose.disconnect();
}

checkApi();
