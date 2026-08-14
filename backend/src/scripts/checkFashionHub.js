const mongoose = require('mongoose');
require('dotenv').config();

async function checkFashionHub() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/speedup');
    console.log('✓ Connected to MongoDB\n');

    // Find Fashion hub seller
    const Seller = mongoose.model('Seller');
    const seller = await Seller.findOne({ storeName: /fashion/i });

    if (!seller) {
      console.log('❌ Fashion hub not found');
      await mongoose.disconnect();
      return;
    }

    console.log('=== FASHION HUB SELLER ===');
    console.log('Store Name:', seller.storeName);
    console.log('Status:', seller.status);
    console.log('Shop Open:', seller.isShopOpen);
    console.log('City:', seller.city);
    console.log('Latitude:', seller.latitude);
    console.log('Longitude:', seller.longitude);
    console.log('Location:', JSON.stringify(seller.location, null, 2));
    console.log('Service Radius:', seller.serviceRadiusKm, 'km');

    // Find products from this seller
    const Product = mongoose.model('Product');
    const products = await Product.find({ seller: seller._id, productName: /kiwi/i });

    console.log('\n=== PRODUCTS ===');
    console.log('Found', products.length, 'Kiwi products');
    products.forEach(p => {
      console.log(`  - ${p.productName}: status=${p.status}, publish=${p.publish}`);
    });

    await mongoose.disconnect();
    console.log('\n✓ Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkFashionHub();
