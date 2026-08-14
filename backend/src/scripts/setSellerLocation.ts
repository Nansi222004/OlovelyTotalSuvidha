import mongoose from 'mongoose';
import Seller from '../models/Seller';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Helper script to manually set a seller's location
 * Usage: Update the values below and run this script
 */
async function setSellerLocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/speedup');
    console.log('✓ Connected to MongoDB\n');

    // === CONFIGURE THESE VALUES ===
    const sellerStoreName = 'Naval Centre';  // Store name to update
    const city = 'Indore';                    // City name
    const latitude = 22.726115;               // Latitude (Indore coordinates)
    const longitude = 75.882596;              // Longitude (Indore coordinates)
    const serviceRadiusKm = 10;               // Service radius in km
    // ==============================

    const seller = await Seller.findOne({ storeName: new RegExp(sellerStoreName, 'i') });

    if (!seller) {
      console.log(`❌ Seller "${sellerStoreName}" not found`);
      await mongoose.disconnect();
      return;
    }

    console.log(`Found seller: ${seller.storeName}`);
    console.log(`Current location: ${seller.location ? JSON.stringify(seller.location) : 'None'}`);
    console.log(`\nUpdating location to:`);
    console.log(`  City: ${city}`);
    console.log(`  Coordinates: [${longitude}, ${latitude}]`);
    console.log(`  Service Radius: ${serviceRadiusKm} km\n`);

    // Update all location fields
    seller.city = city;
    seller.latitude = latitude.toString();
    seller.longitude = longitude.toString();
    seller.location = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };
    seller.serviceRadiusKm = serviceRadiusKm;

    await seller.save();

    console.log('✓ Location updated successfully!');
    console.log('\nVerification:');
    console.log('  City:', seller.city);
    console.log('  Latitude:', seller.latitude);
    console.log('  Longitude:', seller.longitude);
    console.log('  GeoJSON:', JSON.stringify(seller.location));
    console.log('  Service Radius:', seller.serviceRadiusKm, 'km');

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setSellerLocation();

