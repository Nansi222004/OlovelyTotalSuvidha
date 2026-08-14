import mongoose from 'mongoose';
import Seller from '../models/Seller';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Comprehensive migration script to fix ALL seller location issues:
 * 1. Sellers with valid GeoJSON but missing string fields
 * 2. Sellers with valid string fields but missing/incomplete GeoJSON
 * 3. Sellers with incomplete GeoJSON (missing coordinates)
 */
async function fixAllSellerLocations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/speedup');
    console.log('✓ Connected to MongoDB\n');

    // Find ALL sellers
    const sellers = await Seller.find({});
    console.log(`Found ${sellers.length} total sellers\n`);

    let fixedGeoJSON = 0;
    let fixedStringFields = 0;
    let removedInvalidGeoJSON = 0;
    let alreadyCorrect = 0;
    let noLocationData = 0;

    for (const seller of sellers) {
      console.log(`\n--- Processing: ${seller.storeName} (${seller.city || 'Unknown'}) ---`);

      const hasStringLat = seller.latitude && seller.latitude !== 'undefined';
      const hasStringLng = seller.longitude && seller.longitude !== 'undefined';
      const hasValidGeoJSON = seller.location &&
                              seller.location.type === 'Point' &&
                              Array.isArray(seller.location.coordinates) &&
                              seller.location.coordinates.length === 2 &&
                              !isNaN(seller.location.coordinates[0]) &&
                              !isNaN(seller.location.coordinates[1]);

      console.log(`  String fields: lat=${seller.latitude}, lng=${seller.longitude}`);
      console.log(`  GeoJSON: ${JSON.stringify(seller.location)}`);
      console.log(`  Valid GeoJSON: ${hasValidGeoJSON}, Valid String: ${hasStringLat && hasStringLng}`);

      let updated = false;

      // Case 1: Has valid GeoJSON but missing/invalid string fields
      if (hasValidGeoJSON && (!hasStringLat || !hasStringLng) && seller.location) {
        const [longitude, latitude] = seller.location.coordinates;
        seller.latitude = latitude.toString();
        seller.longitude = longitude.toString();
        console.log(`  ✓ Fixed string fields from GeoJSON: [${longitude}, ${latitude}]`);
        fixedStringFields++;
        updated = true;
      }
      // Case 2: Has valid string fields but missing/incomplete GeoJSON
      else if (hasStringLat && hasStringLng && !hasValidGeoJSON) {
        const latitude = parseFloat(seller.latitude || '0');
        const longitude = parseFloat(seller.longitude || '0');

        if (!isNaN(latitude) && !isNaN(longitude)) {
          seller.location = {
            type: 'Point',
            coordinates: [longitude, latitude]
          };
          console.log(`  ✓ Created GeoJSON from string fields: [${longitude}, ${latitude}]`);
          fixedGeoJSON++;
          updated = true;
        }
      }
      // Case 3: Has incomplete/invalid GeoJSON - remove it
      else if (seller.location && !hasValidGeoJSON && !hasStringLat && !hasStringLng) {
        seller.location = undefined;
        console.log(`  ⚠ Removed invalid GeoJSON (no valid data to restore)`);
        removedInvalidGeoJSON++;
        updated = true;
      }
      // Case 4: Everything is synchronized
      else if (hasValidGeoJSON && hasStringLat && hasStringLng) {
        console.log(`  ✓ Already synchronized`);
        alreadyCorrect++;
      }
      // Case 5: No location data at all
      else {
        console.log(`  ⚠ No location data available`);
        noLocationData++;
      }

      if (updated) {
        await seller.save();
        console.log(`  💾 Saved changes`);
      }
    }

    console.log('\n\n=== MIGRATION SUMMARY ===');
    console.log(`Total sellers processed: ${sellers.length}`);
    console.log(`✓ Fixed string fields from GeoJSON: ${fixedStringFields}`);
    console.log(`✓ Fixed GeoJSON from string fields: ${fixedGeoJSON}`);
    console.log(`⚠ Removed invalid GeoJSON: ${removedInvalidGeoJSON}`);
    console.log(`✓ Already synchronized: ${alreadyCorrect}`);
    console.log(`⚠ No location data: ${noLocationData}`);

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
fixAllSellerLocations();

