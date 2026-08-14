import mongoose from 'mongoose';
import Seller from '../models/Seller';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to add isShopOpen field to all existing sellers
 * This ensures backward compatibility for sellers created before this field was added
 */
async function migrateShopStatus() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/dhakadsnazzy';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Update all sellers that don't have isShopOpen field
    const result = await Seller.updateMany(
      { isShopOpen: { $exists: false } },
      { $set: { isShopOpen: true } }
    );

    console.log(`✓ Migration completed`);
    console.log(`  - Matched: ${result.matchedCount} sellers`);
    console.log(`  - Modified: ${result.modifiedCount} sellers`);

    // Verify the update
    const sellersWithoutField = await Seller.countDocuments({ isShopOpen: { $exists: false } });
    console.log(`  - Sellers without isShopOpen field: ${sellersWithoutField}`);

    // Show sample of updated sellers
    const sampleSellers = await Seller.find({}).select('storeName isShopOpen').limit(5);
    console.log('\nSample sellers:');
    sampleSellers.forEach(seller => {
      console.log(`  - ${seller.storeName}: isShopOpen = ${seller.isShopOpen}`);
    });

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateShopStatus();

