import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import PlatformWallet from '../models/PlatformWallet';
import Order from '../models/Order';
import Commission from '../models/Commission';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import WalletTransaction from '../models/WalletTransaction';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function check() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  await mongoose.connect(uri);

  const pw = await PlatformWallet.findOne();
  console.log('=== PLATFORM WALLET DOCUMENT IN DB ===');
  console.log(JSON.stringify(pw, null, 2));

  console.log('\n=== REAL-TIME LEDGER CALCULATIONS ===');

  // 1. Total Platform Earning = Sum of all Paid/Delivered Order totals (Gross GMV collected from customers)
  const deliveredOrders = await Order.find({ status: 'Delivered', paymentStatus: 'Paid' });
  const grossGMV = deliveredOrders.reduce((acc, o) => acc + o.total, 0);
  console.log(`Gross GMV Collected from Customers (Delivered Paid Orders): ₹${grossGMV}`);

  // 2. Real-time Seller Balances (Seller Liabilities)
  const sellerBalances = await Seller.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
  const totalSellerBalances = sellerBalances[0]?.total || 0;
  console.log(`Seller Pending Payouts (Total Seller Balances): ₹${totalSellerBalances}`);

  // 3. Real-time Delivery Balances (Delivery Liabilities)
  const deliveryBalances = await Delivery.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
  const totalDeliveryBalances = deliveryBalances[0]?.total || 0;
  console.log(`Delivery Boy Pending Payouts (Total Delivery Balances): ₹${totalDeliveryBalances}`);

  // 4. Real-time Seller Commissions collected on Delivered Orders
  const deliveredOrderIds = deliveredOrders.map(o => o._id);
  const sellerComms = await Commission.find({ order: { $in: deliveredOrderIds }, type: 'SELLER' });
  const totalSellerCommission = sellerComms.reduce((acc, c) => acc + c.commissionAmount, 0);
  console.log(`Seller Commissions Collected on Delivered Orders: ₹${totalSellerCommission}`);

  // 5. Real-time Delivery Commissions payable on Delivered Orders
  const deliveryComms = await Commission.find({ order: { $in: deliveredOrderIds }, type: 'DELIVERY_BOY' });
  const totalDeliveryCommission = deliveryComms.reduce((acc, c) => acc + c.commissionAmount, 0);
  console.log(`Delivery Commissions Payable on Delivered Orders: ₹${totalDeliveryCommission}`);

  // 6. Order Fees (Platform Fee + Shipping Charge) on Delivered Orders
  const totalPlatformFees = deliveredOrders.reduce((acc, o) => acc + (o.platformFee || 0), 0);
  const totalShippingCharges = deliveredOrders.reduce((acc, o) => acc + (o.shipping || 0), 0);
  console.log(`Platform Fees Collected on Delivered Orders: ₹${totalPlatformFees}`);
  console.log(`Shipping Charges Collected on Delivered Orders: ₹${totalShippingCharges}`);

  // 7. Real-Time Admin Net Profit / Admin Earning Formula:
  // Admin Net Profit = SellerCommissions + PlatformFees + ShippingCharges - DeliveryCommissions
  const realTimeAdminNetEarning = totalSellerCommission + totalPlatformFees + totalShippingCharges - totalDeliveryCommission;
  console.log(`\nREAL-TIME ADMIN NET EARNING: ₹${realTimeAdminNetEarning}`);
  console.log(`  = SellerComms(₹${totalSellerCommission}) + PlatformFees(₹${totalPlatformFees}) + Shipping(₹${totalShippingCharges}) - DeliveryComms(₹${totalDeliveryCommission})`);

  // 8. Real-Time Current Platform Balance:
  // Gross GMV - Seller Balances - Delivery Balances
  const realTimeCurrentPlatformBalance = grossGMV - totalSellerBalances - totalDeliveryBalances;
  console.log(`\nREAL-TIME CURRENT PLATFORM BALANCE: ₹${realTimeCurrentPlatformBalance}`);
  console.log(`  = Gross GMV(₹${grossGMV}) - Seller Liabilities(₹${totalSellerBalances}) - Delivery Liabilities(₹${totalDeliveryBalances})`);

  await mongoose.disconnect();
}

check();
