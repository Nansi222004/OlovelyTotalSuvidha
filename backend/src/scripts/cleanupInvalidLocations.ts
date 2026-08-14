import mongoose from 'mongoose';
import Seller from '../models/Seller';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Cleanup script to fix invalid GeoJSON location objects
 * Removes location objects that have type: "Point" but missing or invalid coordinates
 */
async function cleanupInvalidLocations() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/dhakadsnazzy';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Find sellers with invalid location objects
    const sellers = await Seller.find({
      'location.type': 'Point',
      $or: [
        { 'location.coordinates': { $exists: false } },
        { 'location.coordinates': { $size: 0 } },
        { 'location.coordinates': null }
      ]
    });

    console.log(`\nFound ${sellers.length} sellers with invalid location objects`);

    if (sellers.length === 0) {
      console.log('✓ No invalid locations found. Database is clean!');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Fix each seller
    let fixed = 0;
    for (const seller of sellers) {
      console.log(`\nFixing seller: ${seller.storeName} (${seller._id})`);
      console.log(`  Current location:`, seller.location);

      // Remove invalid location
      seller.location = undefined;
      await seller.save();

      console.log(`  ✓ Removed invalid location`);
      fixed++;
    }

    console.log(`\n✓ Cleanup completed`);
    console.log(`  - Total sellers processed: ${sellers.length}`);
    console.log(`  - Successfully fixed: ${fixed}`);

    // Verify the cleanup
    const remainingInvalid = await Seller.countDocuments({
      'location.type': 'Point',
      $or: [
        { 'location.coordinates': { $exists: false } },
        { 'location.coordinates': { $size: 0 } },
        { 'location.coordinates': null }
      ]
    });

    console.log(`  - Remaining invalid locations: ${remainingInvalid}`);

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('✗ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupInvalidLocations();

