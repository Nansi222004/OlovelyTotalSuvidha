import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Return from '../models/Return';
import Order from '../models/Order';
import Customer from '../models/Customer';
import WalletTransaction from '../models/WalletTransaction';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  console.log('=== LATEST 5 RETURNS ===');
  const returns = await Return.find().sort({ createdAt: -1 }).limit(5).lean();
  for (const r of returns) {
    console.log('RETURN:', {
      _id: r._id,
      order: r.order,
      orderItem: r.orderItem,
      customer: r.customer,
      status: r.status,
      financialSettlementStatus: r.financialSettlementStatus,
      createdAt: r.createdAt,
    });

    const order = await Order.findById(r.order).lean();
    console.log('  ORDER:', {
      _id: order?._id,
      orderNumber: order?.orderNumber,
      customer: order?.customer,
      customerName: order?.customerName,
      total: order?.total,
      paymentMethod: order?.paymentMethod,
      walletAmountUsed: order?.walletAmountUsed,
      onlineAmountPaid: order?.onlineAmountPaid,
      paymentStatus: order?.paymentStatus,
    });

    if (r.customer) {
      const cust = await Customer.findById(r.customer).lean();
      console.log('  RETURN.CUSTOMER:', {
        _id: cust?._id,
        name: cust?.name,
        email: cust?.email,
        mobile: cust?.mobile,
        walletAmount: cust?.walletAmount,
      });
    }

    if (order?.customer) {
      const orderCust = await Customer.findById(order.customer).lean();
      console.log('  ORDER.CUSTOMER:', {
        _id: orderCust?._id,
        name: orderCust?.name,
        email: orderCust?.email,
        mobile: orderCust?.mobile,
        walletAmount: orderCust?.walletAmount,
      });
    }

    const txns = await WalletTransaction.find({
      $or: [
        { relatedOrder: r.order },
        { relatedReturn: r._id },
        { userId: r.customer },
        { userId: order?.customer }
      ]
    }).lean();
    console.log('  WALLET TRANSACTIONS FOR THIS RETURN/ORDER:', txns);
    console.log('----------------------------------------------------');
  }

  await mongoose.disconnect();
}
main().catch(console.error);
