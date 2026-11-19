/**
 * FAQ audience separation tests against an in-memory MongoDB (never reads MONGODB_URI).
 * Run: npm run test:faq-audience
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

delete process.env.MONGODB_URI;
delete process.env.MONGO_URI;

import FAQ, { activeFaqQuery } from '../models/FAQ';
import * as faqController from '../modules/admin/controllers/adminFAQController';

const call = (handler: any, req: any): Promise<{ status: number; body: any }> =>
  new Promise((resolve, reject) => {
    const res: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { resolve({ status: this.statusCode, body }); return this; },
    };
    handler({ query: {}, params: {}, body: {}, ...req }, res, (err: any) => err && reject(err));
  });

async function run() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const results: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); results.push(`PASS ${name}`); } catch (e: any) { results.push(`FAIL ${name}\n     ${e?.message || e}`); }
  };
  try {
    await mongoose.connect(replSet.getUri('olovely_faq_audience_test'));
    await FAQ.create([
      { question: 'C1', answer: 'a', audience: 'customer', order: 1 },
      { question: 'S1', answer: 'a', audience: 'seller', order: 1 },
      { question: 'S2-off', answer: 'a', audience: 'seller', status: 'Inactive' },
      { question: 'D1', answer: 'a', audience: 'delivery' },
    ]);
    // An FAQ saved before the audience field existed
    await FAQ.collection.insertOne({ question: 'LEGACY', answer: 'a', status: 'Active', order: 0 });

    const titles = async (aud: 'customer' | 'seller' | 'delivery') =>
      (await FAQ.find(activeFaqQuery(aud)).lean()).map((f: any) => f.question).sort();

    await check('each app sees only its own active FAQs; old FAQs stay with customers', async () => {
      assert.deepEqual(await titles('customer'), ['C1', 'LEGACY']);
      assert.deepEqual(await titles('seller'), ['S1']);
      assert.deepEqual(await titles('delivery'), ['D1']);
    });

    await check('admin list filters by audience', async () => {
      const r = await call(faqController.getFAQs, { query: { audience: 'seller' } });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.data.map((f: any) => f.question).sort(), ['S1', 'S2-off']);
      const bad = await call(faqController.getFAQs, { query: { audience: 'admin' } });
      assert.equal(bad.status, 400);
    });

    await check('create saves audience + translations; invalid audience rejected', async () => {
      const r = await call(faqController.createFAQ, {
        body: { question: 'How do payouts work?', answer: 'Weekly.', audience: 'seller', translations: { hi: { question: 'भुगतान?', answer: 'साप्ताहिक', evil: 'x' }, 'bad key': { question: 'x' } } },
      });
      assert.equal(r.status, 201);
      const saved: any = await FAQ.findById(r.body.data._id).lean();
      assert.equal(saved.audience, 'seller');
      assert.deepEqual(saved.translations, { hi: { question: 'भुगतान?', answer: 'साप्ताहिक' } });
      const bad = await call(faqController.createFAQ, { body: { question: 'q', answer: 'a', audience: 'everyone' } });
      assert.equal(bad.status, 400);
    });

    await check('create without audience defaults to customer (old admin clients keep working)', async () => {
      const r = await call(faqController.createFAQ, { body: { question: 'Old client', answer: 'a' } });
      assert.equal(r.status, 201);
      assert.equal(r.body.data.audience, 'customer');
    });

    await check('update can move an FAQ to another app and update translations', async () => {
      const faq: any = await FAQ.findOne({ question: 'D1' });
      const r = await call(faqController.updateFAQ, {
        params: { id: String(faq._id) },
        body: { audience: 'seller', translations: { mr: { question: 'प्रश्न', answer: 'उत्तर' } } },
      });
      assert.equal(r.status, 200);
      const saved: any = await FAQ.findById(faq._id).lean();
      assert.equal(saved.audience, 'seller');
      assert.equal(saved.translations.mr.question, 'प्रश्न');
      assert.ok((await titles('seller')).includes('D1'));
      assert.ok(!(await titles('delivery')).includes('D1'));
    });

    await check('PUT /faqs/order reaches the reorder handler (not /faqs/:id)', async () => {
      const app = express();
      app.use(express.json());
      const adminRoutes = express.Router();
      // Same registration order as src/routes/adminRoutes.ts
      adminRoutes.put('/faqs/order', faqController.updateFAQOrder);
      adminRoutes.put('/faqs/:id', faqController.updateFAQ);
      app.use(adminRoutes);
      const src = require('fs').readFileSync(require('path').join(__dirname, '../routes/adminRoutes.ts'), 'utf8');
      assert.ok(src.indexOf('router.put("/faqs/order"') < src.indexOf('router.put("/faqs/:id"'), 'reorder route must be registered first');
      const s1: any = await FAQ.findOne({ question: 'S1' });
      const server = app.listen(0);
      const port = (server.address() as any).port;
      const res = await fetch(`http://127.0.0.1:${port}/faqs/order`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqs: [{ id: String(s1._id), order: 7 }] }),
      });
      server.close();
      assert.equal(res.status, 200);
      assert.equal(((await FAQ.findById(s1._id).lean()) as any).order, 7);
    });
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
  }
  for (const line of results) console.log(line);
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\nFAQ audience tests: ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(2); });
