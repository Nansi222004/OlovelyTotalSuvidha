import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/olovely_total_suvidha';

async function dropLegacyPaymentIndex() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database handle not available');
    }

    const collection = db.collection('payments');
    
    // Get list of indexes on payments collection
    const indexes = await collection.indexes();
    console.log('📋 Current indexes on payments collection:');
    indexes.forEach((idx) => {
      console.log(` - ${idx.name}:`, JSON.stringify(idx.key));
    });

    const targetIndexName = 'gatewayOrderId_1';
    const hasLegacyIndex = indexes.some((idx) => idx.name === targetIndexName);

    if (hasLegacyIndex) {
      console.log(`⚠️ Legacy index "${targetIndexName}" found. Dropping index...`);
      await collection.dropIndex(targetIndexName);
      console.log(`🎉 Successfully dropped legacy index "${targetIndexName}"!`);
    } else {
      console.log(`ℹ️ Legacy index "${targetIndexName}" does not exist on payments collection. No action needed.`);
    }

    // Verify remaining indexes
    const updatedIndexes = await collection.indexes();
    console.log('📋 Updated indexes on payments collection:');
    updatedIndexes.forEach((idx) => {
      console.log(` - ${idx.name}:`, JSON.stringify(idx.key));
    });

    await mongoose.disconnect();
    console.log('✅ Migration script finished cleanly.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

dropLegacyPaymentIndex();
