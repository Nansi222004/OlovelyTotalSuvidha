import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Return from '../models/Return';
import Order from '../models/Order';
import Customer from '../models/Customer';
import WalletTransaction from '../models/WalletTransaction';
import { executeReturnRefundAndReversal } from '../services/refundSettlementService';
import { creditWallet } from '../services/walletManagementService';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  console.log('=== FIXING CUSTOMER WALLET CREDIT FOR RECENT COMPLETED RETURNS ===');

  const completedReturns = await Return.find({
    status: 'Completed'
  }).lean();

  for (const r of completedReturns) {
    const order = await Order.findById(r.order).lean();
    const customerId = (r.customer || order?.customer)?.toString();
    if (!customerId || !order) continue;

    // Check if customer wallet transaction already exists for this return
    const reference = `RETURN_REFUND_WALLET_${r._id.toString()}`;
    const existingTxn = await WalletTransaction.findOne({ reference });

    if (!existingTxn) {
      console.log(`[CREDIT FIX] Crediting customer ${customerId} ₹${r.refundAmount || 499} for Return ${r._id} (Order #${order.orderNumber})`);
      const amountToCredit = r.refundAmount || 499;
      const res = await creditWallet(
        customerId,
        'CUSTOMER',
        amountToCredit,
        `Return refund for order #${order.orderNumber}`,
        order._id.toString(),
        undefined,
        undefined,
        reference,
        'COD_RETURN_REFUND',
        r._id.toString()
      );
      console.log('[CREDIT FIX RESULT]', res);
    } else {
      console.log(`[CREDIT FIX] Transaction already exists for Return ${r._id}`);
    }
  }

  // Print updated balance of Ritik Tiwari
  const ritik = await Customer.findOne({ name: 'Ritik Tiwari' }).lean();
  console.log('=== UPDATED RITIK TIWARI CUSTOMER RECORD ===', {
    _id: ritik?._id,
    name: ritik?.name,
    walletAmount: ritik?.walletAmount,
  });

  const txns = await WalletTransaction.find({ userId: ritik?._id }).lean();
  console.log('=== RITIK TIWARI WALLET TRANSACTIONS ===', txns);

  await mongoose.disconnect();
}
main().catch(console.error);
