import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

async function inspectIndexes() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  if (!db) return;

  const collections = await db.listCollections().toArray();
  const report: any = {};

  for (const col of collections) {
    const indexes = await db.collection(col.name).indexes();
    report[col.name] = indexes.map((i: any) => ({ name: i.name, key: i.key, unique: !!i.unique, sparse: !!i.sparse }));
  }

  console.log(JSON.stringify(report, null, 2));

  // Drop stale unique indexes if present
  for (const colName of ['sellers', 'deliveries', 'admins', 'users', 'orders']) {
    try {
      const idxs = await db.collection(colName).indexes();
      for (const idx of idxs) {
        if (idx.name === 'phone_1' || (colName === 'orders' && idx.name === 'orderId_1')) {
          console.log(`⚠️ Found stale index on ${colName}: ${idx.name}. Dropping stale index...`);
          await db.collection(colName).dropIndex(idx.name);
          console.log(`✓ Stale ${idx.name} index dropped successfully from ${colName} collection.`);
        }
      }
    } catch (e: any) {}
  }

  await mongoose.disconnect();
}

inspectIndexes().catch(console.error);
