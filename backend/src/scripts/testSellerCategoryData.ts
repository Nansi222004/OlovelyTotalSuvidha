import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from '../models/Seller';
import Product from '../models/Product';
import HeaderCategory from '../models/HeaderCategory';
import Category from '../models/Category';
import SubCategory from '../models/SubCategory';

dotenv.config();

async function inspectSellerCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB for Seller Category Inspection\n');

    console.log('====================================================');
    console.log('🏪 SELLER CATEGORIES IN DATABASE');
    console.log('====================================================');

    const sellers = await Seller.find().select('sellerName storeName status category categories categoryCommissions');
    for (const seller of sellers) {
      console.log(`\nSeller ID: ${seller._id}`);
      console.log(`  Name: ${seller.sellerName} | Store: ${seller.storeName}`);
      console.log(`  Status: ${seller.status}`);
      console.log(`  Primary Store Category (category): "${seller.category}"`);
      console.log(`  Allowed Selling Categories (categories):`, seller.categories);
      console.log(`  Category Commissions (categoryCommissions):`, seller.categoryCommissions);

      const products = await Product.find({ seller: seller._id }).select('productName headerCategoryId category subcategory').lean();
      console.log(`  Products Count: ${products.length}`);
      for (const p of products.slice(0, 3)) {
        const hc = p.headerCategoryId ? await HeaderCategory.findById(p.headerCategoryId).select('name') : null;
        const cat = p.category ? await Category.findById(p.category).select('name') : null;
        const sub = p.subcategory ? await Category.findById(p.subcategory).select('name') || await SubCategory.findById(p.subcategory).select('name') : null;
        console.log(`    - Product: "${p.productName}" | HeaderCat: ${hc?.name || p.headerCategoryId} | Cat: ${cat?.name || p.category} | SubCat: ${sub ? ((sub as any).name || (sub as any).subcategoryName) : p.subcategory}`);
      }
    }

    console.log('\n====================================================');
    console.log('📁 AVAILABLE HEADER CATEGORIES IN DATABASE');
    console.log('====================================================');
    const headerCats = await HeaderCategory.find({ status: 'Published' }).select('name status order').sort({ order: 1 });
    console.log(headerCats.map(hc => hc.name));

  } catch (err) {
    console.error('❌ Data inspection failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

inspectSellerCategories();
