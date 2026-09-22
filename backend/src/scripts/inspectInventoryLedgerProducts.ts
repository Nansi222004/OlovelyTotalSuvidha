import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Seller from '../models/Seller';
import InventoryTransaction from '../models/InventoryTransaction';

dotenv.config();

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected to MongoDB');

  // Find admin sellers
  const adminSellers = await Seller.find({
    $or: [
      { email: /admin/i },
      { sellerName: /admin/i },
      { storeName: /admin/i }
    ]
  }).lean();
  console.log('Admin sellers in DB:', adminSellers.map(s => ({
    id: s._id,
    name: s.sellerName,
    store: s.storeName,
    email: s.email
  })));

  // Products with null seller
  const nullSellerProducts = await Product.find({
    $or: [{ seller: null }, { seller: { $exists: false } }]
  }).select('productName stock').lean();
  console.log('Null seller products count:', nullSellerProducts.length);

  // Check chilli product again
  const chilli = await Product.findOne({ productName: /Red Chilli Powder/i }).populate('seller').lean();
  console.log('Chilli product:', {
    id: chilli?._id,
    name: chilli?.productName,
    stock: chilli?.stock,
    seller: (chilli?.seller as any)?.sellerName,
    store: (chilli?.seller as any)?.storeName,
    variations: chilli?.variations
  });

  await mongoose.disconnect();
}

inspect().catch(console.error);
