import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Order from '../models/Order';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import WalletTransaction from '../models/WalletTransaction';
import Commission from '../models/Commission';
import PlatformWallet from '../models/PlatformWallet';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function reconcileWallets() {
  const isExecute = process.argv.includes('--execute');
  const mode = isExecute ? 'EXECUTE MODE' : 'DRY RUN MODE';

  console.log('===============================================================');
  console.log(`WALLETS FINANCIAL RECONCILIATION SCRIPT (${mode})`);
  console.log('===============================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB\n');

  // 1. Inspect Target Order ORD1786968389886112
  const targetOrder = await Order.findOne({ orderNumber: 'ORD1786968389886112' });
  if (targetOrder) {
    console.log('--- TARGET ORDER INSPECTION (ORD1786968389886112) ---');
    console.log(`Order ID: ${targetOrder._id}`);
    console.log(`Status: ${targetOrder.status}`);
    console.log(`Subtotal: ₹${targetOrder.subtotal}`);
    console.log(`Payment Method: ${targetOrder.paymentMethod}`);

    const comms = await Commission.find({ order: targetOrder._id });
    console.log(`Commissions Found (${comms.length}):`, comms.map(c => ({ id: c._id, type: c.type, status: c.status, amount: c.commissionAmount })));

    const txns = await WalletTransaction.find({ relatedOrder: targetOrder._id });
    console.log(`Wallet Transactions Found (${txns.length}):`);
    txns.forEach(t => {
      console.log(`  - [${t.type}] User: ${t.userId} (${t.userType}), Amount: ₹${t.amount}, Ref: ${t.reference}, CreatedAt: ${t.createdAt}`);
    });
    console.log('-----------------------------------------------------\n');
  }

  // 2. Scan database for all duplicate seller credits
  const sellerCreditTxns = await WalletTransaction.find({ userType: 'SELLER', type: 'Credit', relatedOrder: { $exists: true } });
  
  // Group by relatedOrder + userId
  const groupedTxns = new Map<string, typeof sellerCreditTxns>();
  for (const t of sellerCreditTxns) {
    const key = `${t.userId.toString()}_${t.relatedOrder?.toString()}`;
    if (!groupedTxns.has(key)) {
      groupedTxns.set(key, []);
    }
    groupedTxns.get(key)!.push(t);
  }

  const duplicatesToDelete: typeof sellerCreditTxns = [];
  const sellerAdjustments = new Map<string, number>(); // sellerId -> amount to deduct

  for (const [key, txns] of groupedTxns.entries()) {
    if (txns.length > 1) {
      console.log(`⚠️ DUPLICATE DETECTED for Group Key [${key}]: ${txns.length} credit transactions found`);
      // Sort by createdAt ascending (keep earliest, delete remaining duplicates)
      txns.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const primaryTxn = txns[0];
      const dupes = txns.slice(1);

      console.log(`   Keeping Primary Transaction: ${primaryTxn._id} (Ref: ${primaryTxn.reference}, Amount: ₹${primaryTxn.amount})`);
      for (const dupe of dupes) {
        console.log(`   Marking Duplicate For Removal: ${dupe._id} (Ref: ${dupe.reference}, Amount: ₹${dupe.amount})`);
        duplicatesToDelete.push(dupe);
        const sid = dupe.userId.toString();
        sellerAdjustments.set(sid, (sellerAdjustments.get(sid) || 0) + dupe.amount);
      }
    }
  }

  // 3. Print Proposed Balance Changes
  console.log('\n--- PROPOSED SELLER BALANCE ADJUSTMENTS ---');
  for (const [sellerId, deductAmount] of sellerAdjustments.entries()) {
    const seller = await Seller.findById(sellerId);
    if (seller) {
      const oldBalance = seller.balance || 0;
      const newBalance = Math.max(0, oldBalance - deductAmount);
      console.log(`Seller: ${seller.sellerName} (${seller.storeName}) [ID: ${sellerId}]`);
      console.log(`  Current Balance: ₹${oldBalance}`);
      console.log(`  Deduction (Duplicates): -₹${deductAmount}`);
      console.log(`  Proposed New Balance: ₹${newBalance}`);
    }
  }

  if (duplicatesToDelete.length === 0) {
    console.log('✓ No duplicate wallet transactions found to reconcile!');
  }

  // 4. Execute Reconciliation if flag is passed
  if (isExecute && duplicatesToDelete.length > 0) {
    console.log('\n🚀 EXECUTING DATABASE RECONCILIATION...');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Delete duplicate transactions
      for (const dupe of duplicatesToDelete) {
        await WalletTransaction.deleteOne({ _id: dupe._id }, { session });
      }

      // Apply seller balance deductions
      for (const [sellerId, deductAmount] of sellerAdjustments.entries()) {
        await Seller.findByIdAndUpdate(
          sellerId,
          { $inc: { balance: -deductAmount } },
          { session }
        );
      }

      // Also reset premature balances for undelivered orders if needed, or recalculate based on Delivered orders
      const sellers = await Seller.find().session(session);
      for (const s of sellers) {
        // Calculate legitimate balance = sum of credits for Delivered orders
        const deliveredOrders = await Order.find({ status: 'Delivered' }).select('_id');
        const deliveredOrderIds = deliveredOrders.map(o => o._id);
        const validTxns = await WalletTransaction.find({
          userId: s._id,
          userType: 'SELLER',
          type: 'Credit',
          relatedOrder: { $in: deliveredOrderIds }
        }).session(session);

        const realDeliveredBalance = validTxns.reduce((acc, curr) => acc + curr.amount, 0);
        console.log(`  Refreshed Seller ${s.storeName} balance to: ₹${realDeliveredBalance}`);
        await Seller.findByIdAndUpdate(s._id, { balance: realDeliveredBalance }, { session });
      }

      // Sync Platform Wallet
      const platformWallet = await PlatformWallet.findOne().session(session);
      if (platformWallet) {
        const sellerBalances = await Seller.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]).session(session);
        platformWallet.sellerPendingPayouts = sellerBalances[0]?.total || 0;
        await platformWallet.save({ session });
      }

      await session.commitTransaction();
      console.log('✅ RECONCILIATION COMPLETED SUCCESSFULLY!');
    } catch (err) {
      await session.abortTransaction();
      console.error('❌ Reconciliation failed:', err);
      process.exit(1);
    } finally {
      session.endSession();
    }
  } else if (!isExecute) {
    console.log('\n💡 DRY RUN COMPLETED. No database changes were made.');
    console.log('   To execute reconciliation, run:');
    console.log('   npm run reconcile-wallets -- --execute  (or npx ts-node --files src/scripts/reconcileWallets.ts --execute)');
  }

  await mongoose.disconnect();
}

reconcileWallets().catch(err => {
  console.error('Unhandled error in reconciliation script:', err);
  process.exit(1);
});
