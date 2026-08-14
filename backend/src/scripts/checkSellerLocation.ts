import mongoose from 'mongoose';
import Seller from '../models/Seller';
import dotenv from 'dotenv';

dotenv.config();

async function checkSellerLocations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/speedup');
    console.log('Connected to MongoDB');

    const sellers = await Seller.find({}).select('storeName city location latitude longitude serviceRadiusKm status');

    console.log('\n=== SELLER LOCATION DATA ===\n');

    sellers.forEach((seller, index) => {
      console.log(`${index + 1}. ${seller.storeName} (${seller.city})`);
      console.log(`   Status: ${seller.status}`);
      console.log(`   Latitude: ${seller.latitude}`);
      console.log(`   Longitude: ${seller.longitude}`);
      console.log(`   Service Radius: ${seller.serviceRadiusKm} km`);
      console.log(`   GeoJSON Location:`, seller.location);

      // Check if location is properly formatted
      if (seller.location) {
        const isValid = seller.location.type === 'Point' &&
                       Array.isArray(seller.location.coordinates) &&
                       seller.location.coordinates.length === 2 &&
                       !isNaN(seller.location.coordinates[0]) &&
                       !isNaN(seller.location.coordinates[1]);
        console.log(`   Location Valid: ${isValid ? '✓' : '✗'}`);
      } else {
        console.log(`   Location Valid: ✗ (missing)`);
      }
      console.log('');
    });

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSellerLocations();

