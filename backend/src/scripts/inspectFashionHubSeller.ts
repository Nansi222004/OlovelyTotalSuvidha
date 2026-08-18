import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from '../models/Seller';
import HeaderCategory from '../models/HeaderCategory';
import Category from '../models/Category';
import SubCategory from '../models/SubCategory';

dotenv.config();

async function inspectFashionHub() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB for Fashion Hub Inspection\n');

    const seller = await Seller.findOne({ storeName: /Fashion Hub/i }).lean();
    if (!seller) {
      console.log('❌ Seller "Fashion Hub" not found');
      return;
    }

    console.log('====================================================');
    console.log('🏪 SELLER DOCUMENT: FASHION HUB');
    console.log('====================================================');
    console.log(`Seller ID: ${seller._id}`);
    console.log(`Name: ${seller.sellerName} | Store Name: ${seller.storeName}`);
    console.log(`Email: ${seller.email} | Mobile: ${seller.mobile}`);
    console.log(`Stored Primary Category (seller.category): "${seller.category}"`);
    console.log(`Stored Allowed Categories (seller.categories):`, seller.categories);
    console.log(`Status: ${seller.status}`);

    console.log('\n====================================================');
    console.log(`🔍 CATEGORY INSPECTION FOR "${seller.category}"`);
    console.log('====================================================');

    // 1. Check in HeaderCategory
    const hcMatch = await HeaderCategory.findOne({ name: new RegExp(`^${seller.category}$`, 'i') }).lean();
    console.log('HeaderCategory Collection match:', hcMatch ? { id: hcMatch._id, name: hcMatch.name, status: hcMatch.status, slug: hcMatch.slug } : 'NOT FOUND');

    // 2. Check in Category
    const catMatch = await Category.findOne({ name: new RegExp(`^${seller.category}$`, 'i') }).lean();
    console.log('Category Collection match:', catMatch ? { id: catMatch._id, name: catMatch.name, parentId: catMatch.parentId, headerCategoryId: catMatch.headerCategoryId, status: catMatch.status } : 'NOT FOUND');

    // 3. Check Subcategories for catMatch or hcMatch
    if (catMatch) {
      const childCats = await Category.find({ parentId: catMatch._id }).lean();
      const legacySubs = await SubCategory.find({ category: catMatch._id }).lean();
      console.log(`Subcategories under Category "${catMatch.name}":`, {
        childCategoriesCount: childCats.length,
        childCategoryNames: childCats.map(c => c.name),
        legacySubcategoriesCount: legacySubs.length,
        legacySubcategoryNames: legacySubs.map(s => s.name)
      });
    }

    if (hcMatch) {
      const catsUnderHeader = await Category.find({ headerCategoryId: hcMatch._id }).lean();
      console.log(`Categories under HeaderCategory "${hcMatch.name}":`, catsUnderHeader.map(c => ({ id: c._id, name: c.name, parentId: c.parentId })));
    }

  } catch (err) {
    console.error('❌ Inspection error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

inspectFashionHub();
