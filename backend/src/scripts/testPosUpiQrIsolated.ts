/**
 * POS UPI (Razorpay QR) tests against an in-memory MongoDB replica set.
 * Never reads MONGODB_URI/MONGO_URI; Razorpay is replaced by an in-process fake (no network).
 *
 * Run: npm run test:pos-upi
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

delete process.env.MONGODB_URI;
delete process.env.MONGO_URI;

import { posCheckout } from '../modules/admin/controllers/adminInventoryController';
import AppSettings from '../models/AppSettings';
import Product from '../models/Product';
import Order from '../models/Order';
import PosCheckoutAttempt from '../models/PosCheckoutAttempt';
import { getCanonicalAdminSeller } from '../utils/inventoryHelper';
import { createPosUpiQr, setPosQrClientForTests, PosUpiQrError } from '../services/posUpiQrService';

// ── Fake Razorpay QR API ─────────────────────────────────────────────────────
type FakeQr = { id: string; status: string; payment_amount: number; notes: any; usage: string; fixed_amount: boolean; payments: any[] };
const qrs = new Map<string, FakeQr>();
let qrSeq = 0;
const created: any[] = [];
setPosQrClientForTests({
  async create(params: any) {
    created.push(params);
    const qr: FakeQr = {
      id: `qr_TEST${++qrSeq}`, status: 'active', payment_amount: params.payment_amount, notes: params.notes,
      usage: params.usage, fixed_amount: params.fixed_amount, payments: [],
    };
    qrs.set(qr.id, qr);
    return { ...qr, image_url: `https://rzp.io/i/${qr.id}` };
  },
  async fetch(id: string) {
    const qr = qrs.get(id);
    if (!qr) throw { error: { description: 'The id provided does not exist' } };
    return qr;
  },
  async fetchAllPayments(id: string) {
    return { items: qrs.get(id)?.payments || [] };
  },
  async close(id: string) {
    const qr = qrs.get(id);
    if (qr) qr.status = 'closed';
    return qr;
  },
});
/** Simulates the customer paying `rupees` on the QR. */
const payQr = (id: string, rupees: number) => {
  const qr = qrs.get(id)!;
  qr.payments.push({ id: `pay_TEST${qr.payments.length + 1}${id}`, amount: Math.round(rupees * 100), status: 'captured', method: 'upi' });
  qr.status = 'closed';
};
/** A QR that the POS did not create (no POS marker). */
const foreignQr = (rupees: number) => {
  const id = `qr_FOREIGN${++qrSeq}`;
  qrs.set(id, { id, status: 'closed', payment_amount: rupees * 100, notes: {}, usage: 'single_use', fixed_amount: true, payments: [] });
  payQr(id, rupees);
  return id;
};

type CheckoutResult = { status: number; body: any };
function callCheckout(payload: any): Promise<CheckoutResult> {
  return new Promise((resolve) => {
    const response: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      setHeader() { /* not needed */ },
      json(body: any) { resolve({ status: this.statusCode, body }); return this; },
    };
    const request: any = { body: payload, user: { userId: new mongoose.Types.ObjectId().toString() } };
    (posCheckout as any)(request, response, (error: any) => {
      if (error) resolve({ status: error.statusCode || 500, body: { success: false, message: error.message } });
    });
  });
}

let keySeq = 0;
const key = () => `POS-UPI-TEST-${++keySeq}`;

async function run() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const results: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push(`PASS ${name}`);
    } catch (e: any) {
      results.push(`FAIL ${name}\n     ${e?.message || e}`);
    }
  };
  try {
    await mongoose.connect(replSet.getUri('olovely_pos_upi_isolated_test'));
    await PosCheckoutAttempt.syncIndexes();
    await AppSettings.create({
      appName: 'Olovely Total Suvidha', businessName: 'Olovely Total Suvidha', companyAddress: 'Isolated Test Address',
      companyCity: 'Indore', companyState: 'Madhya Pradesh', companyPincode: '452001', stateCode: '23',
      gstEnabled: true, gstRate: 18, gstin: '23AAAAA0000A1Z5', contactEmail: 'isolated@example.test', contactPhone: '9999999999',
    });
    const seller = await getCanonicalAdminSeller();
    const product = await Product.create({
      productName: 'UPI Test Chocolate', seller: seller._id, ownerType: 'PLATFORM', isShopByStoreOnly: true, galleryImages: [],
      price: 175, stock: 10, tax: '18%', hsnCode: '1806', publish: true, status: 'Active',
      productType: 'QUICK_COMMERCE', productSource: 'LOCAL_VENDOR',
    });
    const stock = async () => Number(((await Product.findById(product._id).lean()) as any).stock);
    const orders = () => Order.countDocuments({ isPosOrder: true });
    // 2 × ₹175 = ₹350 bill (GST inclusive, no discount)
    const base = {
      items: [{ productId: product._id.toString(), quantity: 2 }],
      customer: { name: 'Walk-in Customer', isWalkIn: true },
      discount: 0,
    };

    await check('QR is single-use, fixed amount, in paise, marked as POS', async () => {
      const qr = await createPosUpiQr(350, { businessName: 'Olovely Total Suvidha' });
      const params = created[created.length - 1];
      assert.equal(params.type, 'upi_qr');
      assert.equal(params.usage, 'single_use');
      assert.equal(params.fixed_amount, true);
      assert.equal(params.payment_amount, 35000);
      assert.equal(params.notes.source, 'POS');
      assert.ok(params.close_by > Date.now() / 1000 + 600, 'QR must stay open long enough to pay');
      assert.match(qr.imageUrl, /^https:\/\//);
    });

    await check('QR amount must be at least ₹1', async () => {
      await assert.rejects(() => createPosUpiQr(0), (e: any) => e instanceof PosUpiQrError && e.statusCode === 400);
    });

    await check('"Wallet" is rejected (it charged nothing but marked the sale Paid)', async () => {
      const before = await orders();
      const r = await callCheckout({ ...base, payment: { method: 'Wallet' }, idempotencyKey: key() });
      assert.equal(r.status, 400, r.body.message);
      assert.equal(await orders(), before);
    });

    await check('UPI without a QR is rejected', async () => {
      const r = await callCheckout({ ...base, payment: { method: 'UPI' }, idempotencyKey: key() });
      assert.equal(r.status, 400, r.body.message);
    });

    await check('UPI before the customer pays is rejected; no order, no stock change', async () => {
      const qr = await createPosUpiQr(350);
      const [o, s] = [await orders(), await stock()];
      const r = await callCheckout({ ...base, payment: { method: 'UPI', razorpayQrCodeId: qr.qrCodeId }, idempotencyKey: key() });
      assert.equal(r.status, 409, r.body.message);
      assert.equal(await orders(), o);
      assert.equal(await stock(), s);
    });

    let paidQrId = '';
    await check('UPI paid ₹350 on a ₹350 bill: sale recorded Paid with the Razorpay payment id', async () => {
      const qr = await createPosUpiQr(350);
      payQr(qr.qrCodeId, 350);
      paidQrId = qr.qrCodeId;
      const s = await stock();
      const r = await callCheckout({ ...base, payment: { method: 'UPI', razorpayQrCodeId: qr.qrCodeId }, idempotencyKey: key() });
      assert.equal(r.status, 201, r.body.message);
      const order: any = r.body.data.order;
      assert.equal(order.paymentMethod, 'UPI');
      assert.equal(order.paymentStatus, 'Paid');
      assert.equal(order.total, 350);
      assert.match(String(order.paymentId), /^pay_TEST/);
      assert.equal(await stock(), s - 2);
    });

    await check('The same UPI payment cannot be used for a second sale', async () => {
      const [o, s] = [await orders(), await stock()];
      const r = await callCheckout({ ...base, payment: { method: 'UPI', razorpayQrCodeId: paidQrId }, idempotencyKey: key() });
      assert.equal(r.status, 409, r.body.message);
      assert.equal(await orders(), o);
      assert.equal(await stock(), s);
    });

    await check('Paid amount different from the bill is rejected; no order, no stock change', async () => {
      const qr = await createPosUpiQr(300);
      payQr(qr.qrCodeId, 300);
      const [o, s] = [await orders(), await stock()];
      const r = await callCheckout({ ...base, payment: { method: 'UPI', razorpayQrCodeId: qr.qrCodeId }, idempotencyKey: key() });
      assert.equal(r.status, 409, r.body.message);
      assert.match(r.body.message, /does not match/);
      assert.equal(await orders(), o);
      assert.equal(await stock(), s);
    });

    await check('A QR not created by the POS is rejected', async () => {
      const r = await callCheckout({ ...base, payment: { method: 'UPI', razorpayQrCodeId: foreignQr(350) }, idempotencyKey: key() });
      assert.equal(r.status, 400, r.body.message);
    });

    await check('Cash and Card sales still work unchanged', async () => {
      const cash = await callCheckout({ ...base, payment: { method: 'Cash', amountPaid: 350 }, idempotencyKey: key() });
      assert.equal(cash.status, 201, cash.body.message);
      assert.equal(cash.body.data.order.paymentMethod, 'Cash');
      const card = await callCheckout({ ...base, payment: { method: 'Card' }, idempotencyKey: key() });
      assert.equal(card.status, 201, card.body.message);
      assert.equal(card.body.data.order.paymentMethod, 'Card');
    });
  } finally {
    setPosQrClientForTests(null);
    await mongoose.disconnect();
    await replSet.stop();
  }
  for (const line of results) console.log(line);
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\nPOS UPI tests: ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(2); });
