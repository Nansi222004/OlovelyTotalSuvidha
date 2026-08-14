import mongoose from 'mongoose';
import Seller from '../models/Seller';
import dotenv from 'dotenv';

dotenv.config();

async function checkNavalCentre() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/speedup');
    console.log('✓ Connected to MongoDB\n');

    // Find Naval Centre specifically
    const seller = await Seller.findOne({ storeName: /naval/i });

    if (!seller) {
      console.log('❌ Naval Centre not found');
      await mongoose.disconnect();
      return;
    }

    console.log('=== NAVAL CENTRE DETAILS ===\n');
    console.log('Store Name:', seller.storeName);
    console.log('City:', seller.city);
    console.log('Status:', seller.status);
    console.log('\nLocation Fields:');
    console.log('  latitude (string):', seller.latitude, typeof seller.latitude);
    console.log('  longitude (string):', seller.longitude, typeof seller.longitude);
    console.log('  location (GeoJSON):', JSON.stringify(seller.location, null, 2));
    console.log('  serviceRadiusKm:', seller.serviceRadiusKm);

    // Check if location exists and is valid
    const hasGeoJSON = seller.location &&
                       seller.location.type === 'Point' &&
                       Array.isArray(seller.location.coordinates) &&
                       seller.location.coordinates.length === 2;

    console.log('\nValidation:');
    console.log('  Has valid GeoJSON:', hasGeoJSON);
    console.log('  Has string lat/lng:', !!(seller.latitude && seller.longitude));

    if (hasGeoJSON && (!seller.latitude || !seller.longitude)) {
      console.log('\n⚠ ISSUE DETECTED: GeoJSON exists but string fields are missing!');
      console.log('  GeoJSON coordinates:', seller.location!.coordinates);
      console.log('  Should set latitude to:', seller.location!.coordinates[1]);
      console.log('  Should set longitude to:', seller.location!.coordinates[0]);

      // Fix it
      seller.latitude = seller.location!.coordinates[1].toString();
      seller.longitude = seller.location!.coordinates[0].toString();
      await seller.save();
      console.log('\n✓ FIXED! Updated string fields from GeoJSON coordinates');
    }

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkNavalCentre();

