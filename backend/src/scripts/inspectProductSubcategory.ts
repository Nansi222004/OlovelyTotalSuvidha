import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Category from '../models/Category';
import SubCategory from '../models/SubCategory';

dotenv.config();

async function inspectProductSubcategory() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB for Product Subcategory Inspection\n');

    const productId = '6a82f1a87d98cdc0b3c3eca4';
    const product = await Product.findById(productId)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .lean();

    if (!product) {
      console.log(`❌ Product ${productId} not found`);
      return;
    }

    console.log('====================================================');
    console.log(`📦 PRODUCT DOCUMENT: ${product.productName}`);
    console.log('====================================================');
    console.log('Raw Product Object:', JSON.stringify(product, null, 2));

    if (product.subcategory) {
      console.log('\nPopulated Subcategory:', product.subcategory);
    } else {
      console.log('\n❌ product.subcategory is null/undefined in DB or failed to populate!');
      
      // Let's check raw unpopulated document
      const rawProduct = await Product.findById(productId).lean();
      console.log('Raw unpopulated product.subcategory ObjectId:', rawProduct?.subcategory);

      if (rawProduct?.subcategory) {
        // Try finding in Category
        const catMatch = await Category.findById(rawProduct.subcategory).lean();
        console.log('Category collection lookup for subcategory ObjectId:', catMatch);

        // Try finding in SubCategory
        const subMatch = await SubCategory.findById(rawProduct.subcategory).lean();
        console.log('SubCategory collection lookup for subcategory ObjectId:', subMatch);
      }
    }

  } catch (err) {
    console.error('❌ Inspection error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

inspectProductSubcategory();
