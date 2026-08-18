import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/olovely_total_suvidha';

async function fixStock() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const Product = mongoose.connection.collection('products');
    
    // Find all products with stock <= 0
    const outOfStockProducts = await Product.find({ stock: { $lte: 0 } }).toArray();
    console.log(`Found ${outOfStockProducts.length} products with stock <= 0`);

    // Update stock to 50 for products and their variations
    const result = await Product.updateMany(
      { $or: [{ stock: { $lte: 0 } }, { stock: { $exists: false } }] },
      { 
        $set: { 
          stock: 50,
          status: 'Active',
          publish: true,
          "variations.$[].stock": 50,
          "variations.$[].status": 'Available'
        } 
      }
    );

    console.log(`Updated ${result.modifiedCount} products with stock = 50`);
    
    await mongoose.disconnect();
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing stock:', err);
    process.exit(1);
  }
}

fixStock();
