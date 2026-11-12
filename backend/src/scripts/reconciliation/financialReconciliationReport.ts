/**
 * R-16: READ-ONLY financial reconciliation report for production.
 *
 *   npx ts-node src/scripts/reconciliation/financialReconciliationReport.ts --uri "<read-only-user-uri>" --out report.json
 *
 * Guarantees:
 *  - the target database must be given explicitly with --uri (MONGODB_URI is NOT read)
 *  - only find / aggregate / countDocuments are used; there is no write path in this file
 *  - the connection is opened with readPreference=secondaryPreferred
 *  - nothing is corrected automatically: every finding is a candidate for Finance review
 *
 * Use a MongoDB user with the built-in `read` role only.
 * Each section id (Q1…Q14) matches docs/OLOVELY_FINANCIAL_RECONCILIATION.md.
 */
import fs from "fs";
import mongoose from "mongoose";

type Db = mongoose.mongo.Db;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const LIMIT = 500;

const q = {
  // Q1 seller available balance vs Completed ledger
  async sellerBalanceVsLedger(db: Db) {
    return db.collection("sellers").aggregate([
      { $lookup: { from: "wallettransactions", let: { id: "$_id" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$userId", "$$id"] }, { $eq: ["$userType", "SELLER"] }, { $eq: ["$status", "Completed"] }] } } },
        { $group: { _id: null, net: { $sum: { $cond: [{ $eq: ["$type", "Credit"] }, "$amount", { $multiply: ["$amount", -1] }] } } } },
      ], as: "l" } },
      { $project: { storeName: 1, balance: 1, ledger: { $ifNull: [{ $first: "$l.net" }, 0] } } },
      { $addFields: { diff: { $subtract: ["$balance", "$ledger"] } } },
      { $match: { $expr: { $gt: [{ $abs: "$diff" }, 0.01] } } },
      { $sort: { diff: -1 } }, { $limit: LIMIT },
    ]).toArray();
  },
  // Q2 seller escrow (onHoldBalance) vs Σ net of OnHold commissions
  async sellerEscrowVsCommissions(db: Db) {
    return db.collection("sellers").aggregate([
      { $lookup: { from: "commissions", let: { id: "$_id" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$seller", "$$id"] }, { $eq: ["$type", "SELLER"] }, { $eq: ["$status", "OnHold"] }] } } },
        { $group: { _id: null, net: { $sum: { $subtract: ["$orderAmount", "$commissionAmount"] } } } },
      ], as: "h" } },
      { $project: { storeName: 1, onHoldBalance: 1, heldCommissions: { $ifNull: [{ $first: "$h.net" }, 0] } } },
      { $addFields: { diff: { $subtract: [{ $ifNull: ["$onHoldBalance", 0] }, "$heldCommissions"] } } },
      { $match: { $expr: { $gt: [{ $abs: "$diff" }, 0.01] } } },
      { $sort: { diff: -1 } }, { $limit: LIMIT },
    ]).toArray();
  },
  // Q3 duplicate commissions (blocks the R-07 unique index)
  async duplicateCommissions(db: Db) {
    const col = db.collection("commissions");
    const seller = await col.aggregate([
      { $match: { type: "SELLER", orderItem: { $ne: null } } },
      { $group: { _id: "$orderItem", n: { $sum: 1 }, order: { $first: "$order" }, ids: { $push: "$_id" }, statuses: { $push: "$status" }, nets: { $push: { $subtract: ["$orderAmount", "$commissionAmount"] } } } },
      { $match: { n: { $gt: 1 } } }, { $limit: LIMIT },
    ]).toArray();
    const rider = await col.aggregate([
      { $match: { type: "DELIVERY_BOY" } },
      { $group: { _id: "$order", n: { $sum: 1 }, ids: { $push: "$_id" }, amounts: { $push: "$commissionAmount" } } },
      { $match: { n: { $gt: 1 } } }, { $limit: LIMIT },
    ]).toArray();
    return { seller, rider };
  },
  // Q4 delivered prepaid orders whose seller was never paid (no SELLER commission)
  async missingSellerCommissions(db: Db) {
    return db.collection("orders").aggregate([
      { $match: { status: "Delivered", paymentMethod: { $ne: "COD" } } },
      { $lookup: { from: "commissions", let: { id: "$_id" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$order", "$$id"] }, { $eq: ["$type", "SELLER"] }] } } }, { $limit: 1 }], as: "c" } },
      { $match: { c: { $size: 0 } } },
      { $project: { orderNumber: 1, paymentMethod: 1, total: 1, deliveredAt: 1 } }, { $limit: LIMIT },
    ]).toArray();
  },
  // Q5 customer refunds exceeding recorded return/cancel refunds (double refunds, FIN-04)
  async customerOverRefunds(db: Db) {
    return db.collection("orders").aggregate([
      { $match: { status: { $in: ["Delivered", "Returned", "Cancelled"] } } },
      { $lookup: { from: "refunds", let: { id: "$_id" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$order", "$$id"] }, { $eq: ["$status", "Completed"] }] } } },
        { $group: { _id: null, t: { $sum: "$amount" } } }], as: "rf" } },
      { $lookup: { from: "payments", localField: "_id", foreignField: "order", as: "p" } },
      { $lookup: { from: "wallettransactions", let: { id: "$_id" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$relatedOrder", "$$id"] }, { $eq: ["$userType", "CUSTOMER"] }, { $eq: ["$type", "Credit"] }] } } },
        { $match: { reference: { $regex: "^(RETURN_REFUND|CANCEL_REFUND)" } } },
        { $group: { _id: null, t: { $sum: "$amount" } } }], as: "w" } },
      { $project: {
        orderNumber: 1, status: 1, total: 1, walletAmountUsed: 1,
        recordedReturnRefunds: { $ifNull: [{ $first: "$rf.t" }, 0] },
        gatewayRefunded: { $sum: "$p.refundAmount" },
        walletRefunded: { $ifNull: [{ $first: "$w.t" }, 0] },
      } },
      { $addFields: { paidBack: { $add: ["$gatewayRefunded", "$walletRefunded"] } } },
      // a customer can never get back more than the order total
      { $match: { $expr: { $gt: ["$paidBack", { $add: ["$total", 0.01] }] } } },
      { $limit: LIMIT },
    ]).toArray();
  },
  // Q6 a commission credited more than once (FIN-01 / FIN-03 escrow & COD double credits)
  async multipleCreditsPerCommission(db: Db) {
    return db.collection("wallettransactions").aggregate([
      { $match: { userType: "SELLER", type: "Credit", relatedCommission: { $ne: null } } },
      { $group: { _id: "$relatedCommission", n: { $sum: 1 }, total: { $sum: "$amount" }, refs: { $push: "$reference" }, seller: { $first: "$userId" } } },
      { $match: { n: { $gt: 1 } } }, { $limit: LIMIT },
    ]).toArray();
  },
  // Q7 PlatformWallet stored counters vs ledger-derived values
  async platformWalletCounters(db: Db) {
    const pw = await db.collection("platformwallets").findOne({});
    const [comm] = await db.collection("commissions").aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $group: { _id: null, seller: { $sum: { $cond: [{ $eq: ["$type", "SELLER"] }, "$commissionAmount", 0] } }, rider: { $sum: { $cond: [{ $eq: ["$type", "DELIVERY_BOY"] }, "$commissionAmount", 0] } } } },
    ]).toArray();
    const [fees] = await db.collection("orders").aggregate([
      { $match: { status: { $nin: ["Pending", "Cancelled", "Rejected"] } } },
      { $group: { _id: null, fee: { $sum: { $ifNull: ["$platformFee", 0] } }, ship: { $sum: { $ifNull: ["$shipping", 0] } }, coupons: { $sum: { $ifNull: ["$discount", 0] } } } },
    ]).toArray();
    const derivedGross = r2((comm?.seller || 0) + (fees?.fee || 0) + (fees?.ship || 0) - (comm?.rider || 0));
    return {
      storedTotalAdminEarning: pw?.totalAdminEarning,
      derivedPlatformEarningsGrossBeforeCourierCharges: derivedGross,
      couponsPlatformFunded: r2(fees?.coupons || 0),
      difference: r2((pw?.totalAdminEarning || 0) - derivedGross),
      note: "Historical commissions use the pre-B-3 gross (GST-inclusive) base; see Q14.",
    };
  },
  // Q8 COD payout discrepancies: cash received but seller still Pending, or vice versa
  async codPayoutDiscrepancies(db: Db) {
    const cashInSellerPending = await db.collection("orders").aggregate([
      { $match: { paymentMethod: "COD", status: "Delivered", codPaidToAdminAt: { $ne: null } } },
      { $lookup: { from: "commissions", let: { id: "$_id" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$order", "$$id"] }, { $eq: ["$type", "SELLER"] }, { $eq: ["$status", "Pending"] }] } } }], as: "c" } },
      { $match: { "c.0": { $exists: true } } },
      { $project: { orderNumber: 1, orderType: 1, codPaidToAdminAt: 1, pendingSellerNet: { $sum: { $map: { input: "$c", as: "x", in: { $subtract: ["$$x.orderAmount", "$$x.commissionAmount"] } } } } } },
      { $limit: LIMIT },
    ]).toArray();
    // courier COD credited before any remittance (old self-delivery path on e-commerce orders)
    const courierCreditedWithoutRemittance = await db.collection("wallettransactions").aggregate([
      { $match: { userType: "SELLER", reference: { $regex: "^COD_SELF_SALE_" } } },
      { $lookup: { from: "orders", localField: "relatedOrder", foreignField: "_id", as: "o" } },
      { $unwind: "$o" },
      { $match: { "o.orderType": { $in: ["ECOMMERCE", "MIXED"] } } },
      { $project: { reference: 1, amount: 1, seller: "$userId", orderNumber: "$o.orderNumber", orderType: "$o.orderType", createdAt: 1 } },
      { $limit: LIMIT },
    ]).toArray();
    // self-delivery fee credits (removed by B-7) for awareness
    const [selfFees] = await db.collection("wallettransactions").aggregate([
      { $match: { userType: "SELLER", reference: { $regex: "^SELF_DELIVERY_FEE_" } } },
      { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]).toArray();
    return { cashInSellerPending, courierCreditedWithoutRemittance, historicalSelfDeliveryFeeCredits: selfFees || { n: 0, total: 0 } };
  },
  // Q9 rider COD debt vs pending cash-collection records
  async riderDebtVsCashCollections(db: Db) {
    return db.collection("deliveries").aggregate([
      { $lookup: { from: "cashcollections", let: { id: "$_id" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$deliveryBoy", "$$id"] }, { $eq: ["$status", "Pending"] }] } } },
        { $group: { _id: null, t: { $sum: "$amount" } } }], as: "cc" } },
      { $project: { name: 1, pendingAdminPayout: 1, cashCollected: 1, pendingCollections: { $ifNull: [{ $first: "$cc.t" }, 0] } } },
      { $addFields: { diff: { $subtract: [{ $ifNull: ["$pendingAdminPayout", 0] }, "$pendingCollections"] } } },
      { $match: { $expr: { $gt: [{ $abs: "$diff" }, 0.01] } } }, { $limit: LIMIT },
    ]).toArray();
  },
  // Q10 negative balances
  async negativeBalances(db: Db) {
    const sellers = await db.collection("sellers").find({ $or: [{ balance: { $lt: 0 } }, { onHoldBalance: { $lt: 0 } }] }, { projection: { storeName: 1, balance: 1, onHoldBalance: 1 } }).limit(LIMIT).toArray();
    const riders = await db.collection("deliveries").find({ $or: [{ balance: { $lt: 0 } }, { pendingAdminPayout: { $lt: 0 } }] }, { projection: { name: 1, balance: 1, pendingAdminPayout: 1 } }).limit(LIMIT).toArray();
    const customers = await db.collection("customers").countDocuments({ walletAmount: { $lt: 0 } });
    return { sellers, riders, customersWithNegativeWallet: customers };
  },
  // Q11 tips collected on delivered orders but never paid to a rider (pre-B-1 history)
  async unpaidHistoricalTips(db: Db) {
    return db.collection("orders").aggregate([
      { $match: { status: "Delivered", tipAmount: { $gt: 0 }, tipCreditedAt: null } },
      { $group: { _id: { hasRider: { $cond: [{ $ifNull: ["$deliveryBoy", false] }, true, false] } }, n: { $sum: 1 }, total: { $sum: "$tipAmount" } } },
    ]).toArray();
  },
  // Q12 historical gift packaging income (feature removed) — informational
  async historicalGiftPackaging(db: Db) {
    const [agg] = await db.collection("orders").aggregate([
      { $match: { giftPackaging: true, status: { $nin: ["Pending", "Cancelled", "Rejected"] } } },
      { $group: { _id: null, n: { $sum: 1 }, snapshotTotal: { $sum: { $ifNull: ["$giftPackagingFee", 0] } } } },
    ]).toArray();
    return agg || { n: 0, snapshotTotal: 0 };
  },
  // Q13 unpaid online orders marked Refunded / cancelled with a refund email (R-09 history)
  async unpaidMarkedRefunded(db: Db) {
    return db.collection("orders").aggregate([
      { $match: { paymentStatus: "Refunded", paymentMethod: { $in: ["Online", "razorpay"] } } },
      { $lookup: { from: "payments", localField: "_id", foreignField: "order", as: "p" } },
      { $match: { $expr: { $eq: [{ $size: { $filter: { input: "$p", as: "x", cond: { $in: ["$$x.status", ["Completed", "Refunded"]] } } } }, 0] } } },
      { $project: { orderNumber: 1, total: 1, walletAmountUsed: 1, onlineAmountPaid: 1, cancelledAt: 1 } },
      { $limit: LIMIT },
    ]).toArray();
  },
  // Q14 commissions on the pre-B-3 base (GST-inclusive) — informational, NOT auto-corrected
  async preB3CommissionBase(db: Db, since?: Date) {
    const [agg] = await db.collection("commissions").aggregate([
      { $match: { type: "SELLER", status: { $ne: "Cancelled" }, ...(since ? { createdAt: { $lt: since } } : {}) } },
      { $lookup: { from: "orderitems", localField: "orderItem", foreignField: "_id", as: "it" } },
      { $unwind: "$it" },
      { $match: { "it.taxAmount": { $gt: 0 } } },
      { $project: { overcharge: { $multiply: [{ $min: [{ $ifNull: ["$it.taxAmount", 0] }, "$orderAmount"] }, { $divide: ["$commissionRate", 100] }] } } },
      { $group: { _id: null, n: { $sum: 1 }, commissionOnGst: { $sum: "$overcharge" } } },
    ]).toArray();
    return agg || { n: 0, commissionOnGst: 0 };
  },
  // Q15 refund intents needing attention (R-06)
  async refundIntents(db: Db) {
    const col = db.collection("gatewayrefundintents");
    return {
      notSucceeded: await col.find({ status: { $ne: "SUCCEEDED" } }).limit(LIMIT).toArray(),
      succeededNotApplied: await col.find({ status: "SUCCEEDED", appliedToPaymentAt: null }).limit(LIMIT).toArray(),
    };
  },
};

const main = async () => {
  const args = process.argv.slice(2);
  const get = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const uri = get("--uri");
  const out = get("--out") || `reconciliation-${new Date().toISOString().slice(0, 10)}.json`;
  const since = get("--b3-deploy-date") ? new Date(get("--b3-deploy-date")!) : undefined;
  if (!uri) {
    console.error("Usage: --uri <read-only mongodb uri> [--out file.json] [--b3-deploy-date YYYY-MM-DD]\nMONGODB_URI is intentionally NOT read.");
    process.exit(2);
  }
  await mongoose.connect(uri, { readPreference: "secondaryPreferred" });
  const db = mongoose.connection.db!;
  const report: any = { generatedAt: new Date().toISOString(), readOnly: true, rowLimitPerSection: LIMIT };
  try {
    report.Q1_sellerBalanceVsLedger = await q.sellerBalanceVsLedger(db);
    report.Q2_sellerEscrowVsCommissions = await q.sellerEscrowVsCommissions(db);
    report.Q3_duplicateCommissions = await q.duplicateCommissions(db);
    report.Q4_missingSellerCommissions = await q.missingSellerCommissions(db);
    report.Q5_customerOverRefunds = await q.customerOverRefunds(db);
    report.Q6_multipleCreditsPerCommission = await q.multipleCreditsPerCommission(db);
    report.Q7_platformWalletCounters = await q.platformWalletCounters(db);
    report.Q8_codPayoutDiscrepancies = await q.codPayoutDiscrepancies(db);
    report.Q9_riderDebtVsCashCollections = await q.riderDebtVsCashCollections(db);
    report.Q10_negativeBalances = await q.negativeBalances(db);
    report.Q11_unpaidHistoricalTips = await q.unpaidHistoricalTips(db);
    report.Q12_historicalGiftPackaging = await q.historicalGiftPackaging(db);
    report.Q13_unpaidMarkedRefunded = await q.unpaidMarkedRefunded(db);
    report.Q14_preB3CommissionBase = await q.preB3CommissionBase(db, since);
    report.Q15_refundIntents = await q.refundIntents(db).catch(() => ({ note: "collection not present before deploy" }));
    report.summary = Object.fromEntries(
      Object.entries(report)
        .filter(([k]) => /^Q\d+/.test(k))
        .map(([k, v]: any) => [k, Array.isArray(v) ? v.length : typeof v === "object" && v ? Object.fromEntries(Object.entries(v).map(([a, b]: any) => [a, Array.isArray(b) ? b.length : b])) : v]),
    );
  } finally {
    await mongoose.disconnect();
  }
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nFull report: ${out}  (read-only; no data was changed)`);
};

export { q as reconciliationQueries };

if (require.main === module) {
  main().catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  });
}
