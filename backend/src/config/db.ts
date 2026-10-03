import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';
import PosCheckoutAttempt from '../models/PosCheckoutAttempt';
import Product from '../models/Product';
import Notification from '../models/Notification';
import ProcessedWebhookEvent from '../models/ProcessedWebhookEvent';

dotenv.config();

// Ensure reliable SRV and IPv4 resolution on Windows networks
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore if platform restrictions apply
}

const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI is not defined in environment variables');
    }

    mongoose.set('autoIndex', false);
    const conn = await mongoose.connect(mongoUri);
    // autoIndex is intentionally disabled globally. This targeted additive index is
    // required for concurrency-safe POS request idempotency.
    await PosCheckoutAttempt.createIndexes();
    // Historical notifications do not have eventId. The partial unique index
    // applies only to new logical events and makes concurrent retries safe.
    await Notification.createIndexes();
    // Carrier callbacks are retried; this unique key makes processing idempotent
    // across restarts and concurrent webhook deliveries. Never attempt the unique
    // index blindly if historical duplicate event IDs are present.
    const webhookIndexes = await ProcessedWebhookEvent.collection.indexes().catch((error: any) => {
      if (error?.codeName === 'NamespaceNotFound' || error?.code === 26) return [];
      throw error;
    });
    const hasWebhookEventUniqueIndex = webhookIndexes.some(
      (index: any) => index.unique === true && index.key?.eventId === 1
    );
    if (!hasWebhookEventUniqueIndex) {
      const duplicateWebhookEvent = await ProcessedWebhookEvent.aggregate([
        { $match: { eventId: { $type: 'string', $ne: '' } } },
        { $group: { _id: '$eventId', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
      ]).then((rows) => rows[0]);
      if (duplicateWebhookEvent) {
        throw new Error(
          'Cannot enable webhook idempotency index: duplicate historical event IDs exist. Resolve them through an audited, non-destructive data process first.'
        );
      }
    }
    await ProcessedWebhookEvent.createIndexes();
    // Barcode indexes are additive. They enforce uniqueness within product and
    // variation scopes; cross-scope uniqueness is enforced by barcodeHelper.
    await Product.collection.createIndex(
      { barcode: 1 },
      { unique: true, sparse: true, name: 'uniq_product_barcode' }
    );
    await Product.collection.createIndex(
      { 'variations.barcode': 1 },
      { unique: true, sparse: true, name: 'uniq_variation_barcode' }
    );

    console.log('\n\x1b[32m✓\x1b[0m \x1b[1mMongoDB Connected Successfully\x1b[0m');
    console.log(`   \x1b[36mHost:\x1b[0m ${conn.connection.host}`);
    console.log(`   \x1b[36mDatabase:\x1b[0m ${conn.connection.name}\n`);
  } catch (error) {
    console.error('\n\x1b[31m✗\x1b[0m \x1b[1mMongoDB Connection Error\x1b[0m');
    if (error instanceof Error) {
      console.error(`   \x1b[31m${error.message}\x1b[0m\n`);
    } else {
      console.error(`   \x1b[31m${String(error)}\x1b[0m\n`);
    }
    process.exit(1);
  }
};

export default connectDB;




