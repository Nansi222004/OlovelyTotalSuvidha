import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import HeaderCategory from '../models/HeaderCategory';
import Category from '../models/Category';
import Product from '../models/Product';
import Seller from '../models/Seller';
import Shop from '../models/Shop';
import BestsellerCard from '../models/BestsellerCard';
import LowestPricesProduct from '../models/LowestPricesProduct';
import PromoStrip from '../models/PromoStrip';
import { findSellersWithinRange } from '../utils/locationHelper';

async function testTrace() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri!);

  const nearby = await findSellersWithinRange(22.71765, 75.87186);
  console.log('Nearby sellers:', nearby);

  const prods = await Product.find({}).lean();
  console.log('Total products count in DB:', prods.length);
  for (const p of prods) {
    console.log(`- [${p.productName}] cat: ${p.category} subcat: ${p.subcategory} seller: ${p.seller} active: ${p.status} publish: ${p.publish}`);
  }

  const allCats = await Category.find({}).lean();
  console.log('All categories in DB:', allCats.map(c => `[${c.name} id: ${c._id} parent: ${c.parentId}]`));

  const cards = await BestsellerCard.find({ isActive: true }).populate('category', 'name slug image').lean();
  console.log('Bestseller cards count:', cards.length);

  for (const card of cards) {
    const categoryId = (card.category as any)?._id || card.category;
    const childCats = await Category.find({ parentId: categoryId }).select('_id').lean();
    const allCategoryIds = [categoryId, ...childCats.map((c: any) => c._id)];

    const productQuery: any = {
      $or: [
        { category: { $in: allCategoryIds } },
        { subcategory: { $in: allCategoryIds } }
      ],
      status: 'Active',
      publish: true,
      seller: { $in: nearby }
    };

    const categoryProducts = await Product.find(productQuery).lean();
    console.log('Card:', (card as any).name, 'categoryId:', categoryId, 'products found:', categoryProducts.length);
  }

  const shops = await Shop.find({ isActive: true }).lean();
  console.log('Shops count:', shops.length);

  const promo = await PromoStrip.findOne({ headerCategorySlug: 'all', isActive: true })
    .populate('categoryCards.categoryId')
    .populate('featuredProducts')
    .lean();
  console.log('PromoStrip found:', promo ? { heading: promo.heading, cards: promo.categoryCards?.length, products: promo.featuredProducts?.length } : 'NULL');

  await mongoose.disconnect();
}

testTrace().catch(console.error);
