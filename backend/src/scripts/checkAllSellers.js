const mongoose = require('mongoose');
require('dotenv').config();

async function checkAllSellers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/speedup');
    console.log('✓ Connected to MongoDB\n');

    console.log('=== ALL SELLERS LOCATION STATUS ===\n');

    const sellers = await mongoose.connection.db.collection('sellers').find({}).toArray();

    sellers.forEach((seller, index) => {
      console.log(`${index + 1}. ${seller.storeName || 'Unnamed'}`);
      console.log(`   Status: ${seller.status}`);
      console.log(`   Shop Open: ${seller.isShopOpen !== false ? 'Yes' : 'No'}`);
      console.log(`   City: ${seller.city || 'Not set'}`);
      console.log(`   Latitude: ${seller.latitude || 'Not set'}`);
      console.log(`   Longitude: ${seller.longitude || 'Not set'}`);

      const hasValidGeoJSON = seller.location &&
                              seller.location.type === 'Point' &&
                              Array.isArray(seller.location.coordinates) &&
                              seller.location.coordinates.length === 2;

      console.log(`   GeoJSON Valid: ${hasValidGeoJSON ? '✓' : '✗'}`);
      if (hasValidGeoJSON) {
        console.log(`   Coordinates: [${seller.location.coordinates[0]}, ${seller.location.coordinates[1]}]`);
        console.log(`   Service Radius: ${seller.serviceRadiusKm || 10} km`);
      }
      console.log('');
    });

    await mongoose.disconnect();
    console.log('✓ Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAllSellers();
