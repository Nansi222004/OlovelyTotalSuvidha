import mongoose from 'mongoose';

import Product from '../models/Product';
import dotenv from 'dotenv';

dotenv.config();

async function debugProductAvailability() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/speedup');
    console.log('✓ Connected to MongoDB\n');

    // Find the product "Fresh Kiwi from 9111"
    const product = await Product.findOne({ productName: /kiwi/i }).populate('seller');

    if (!product) {
      console.log('❌ Product not found');
      await mongoose.disconnect();
      return;
    }

    console.log('=== PRODUCT DETAILS ===');
    console.log('Product Name:', product.productName);
    console.log('Product ID:', product._id);
    console.log('Status:', product.status);
    console.log('Published:', product.publish);
    console.log('Seller ID:', product.seller);

    if (product.seller && typeof product.seller === 'object') {
      const seller = product.seller as any;
      console.log('\n=== SELLER DETAILS ===');
      console.log('Store Name:', seller.storeName);
      console.log('Status:', seller.status);
      console.log('Shop Open:', seller.isShopOpen);
      console.log('City:', seller.city);
      console.log('Latitude:', seller.latitude);
      console.log('Longitude:', seller.longitude);
      console.log('Location:', JSON.stringify(seller.location, null, 2));
      console.log('Service Radius:', seller.serviceRadiusKm, 'km');

      // Check if location is valid
      const hasValidLocation = seller.location &&
                               seller.location.type === 'Point' &&
                               Array.isArray(seller.location.coordinates) &&
                               seller.location.coordinates.length === 2;

      console.log('\n=== VALIDATION ===');
      console.log('Has Valid GeoJSON:', hasValidLocation);
      console.log('Seller Approved:', seller.status === 'Approved');
      console.log('Shop Open:', seller.isShopOpen !== false);
      console.log('Product Active:', product.status === 'Active');
      console.log('Product Published:', product.publish === true);

      if (hasValidLocation) {
        console.log('\n=== LOCATION DETAILS ===');
        console.log('Coordinates: [lng, lat] =', seller.location.coordinates);
        console.log('Service Radius:', seller.serviceRadiusKm, 'km');

        // Test with a sample customer location (Indore)
        const customerLat = 22.7196;
        const customerLng = 75.8577;

        const sellerLat = seller.location.coordinates[1];
        const sellerLng = seller.location.coordinates[0];

        // Calculate distance
        const R = 6371; // Earth radius in km
        const dLat = ((sellerLat - customerLat) * Math.PI) / 180;
        const dLon = ((sellerLng - customerLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((customerLat * Math.PI) / 180) *
            Math.cos((sellerLat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        console.log('\nTest Customer Location: [', customerLng, ',', customerLat, '] (Indore)');
        console.log('Distance from seller:', distance.toFixed(2), 'km');
        console.log('Within service radius:', distance <= (seller.serviceRadiusKm || 10) ? 'YES ✓' : 'NO ✗');
      }
    }

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugProductAvailability();

