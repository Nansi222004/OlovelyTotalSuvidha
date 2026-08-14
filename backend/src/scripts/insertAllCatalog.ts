import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function insertAllCatalog() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri!);
  const db = mongoose.connection.db;

  const seller = await db.collection('sellers').findOne({ status: 'Approved' });
  const sellerId = seller ? seller._id : new mongoose.Types.ObjectId('6a7d5b02259ec525f6753de4');

  const categories = await db.collection('categories').find({}).toArray();
  const catMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const c of categories) {
    catMap[c.name] = c._id;
  }

  const prodsToInsert = [
    { name: 'Aashirvaad Superior MP Whole Wheat Atta 5kg', cat: 'Atta, Rice & Dal', price: 245, mrp: 265, pack: '5 kg', img: '/assets/product-aashirvaad-atta.jpg' },
    { name: 'Fortune Chakki Fresh Atta 5kg', cat: 'Atta, Rice & Dal', price: 235, mrp: 255, pack: '5 kg', img: '/assets/product-fortune-atta.jpg' },
    { name: 'Daawat Pulav Basmati Rice 1kg', cat: 'Atta, Rice & Dal', price: 135, mrp: 160, pack: '1 kg', img: '/assets/product-daawat-rice.jpg' },
    { name: 'India Gate Kolam Premium Rice 1kg', cat: 'Atta, Rice & Dal', price: 98, mrp: 115, pack: '1 kg', img: '/assets/product-india-gate-rice.jpg' },
    { name: 'Tata Sampann Unpolished Yellow Moong Dal 1kg', cat: 'Atta, Rice & Dal', price: 155, mrp: 175, pack: '1 kg', img: '/assets/product-tata-moong.jpg' },
    { name: 'Fortune Indori Thick Poha 500g', cat: 'Atta, Rice & Dal', price: 38, mrp: 45, pack: '500 g', img: '/assets/product-fortune-poha.jpg' },
    { name: 'Rajdhani Besan Fine Gram Flour 1kg', cat: 'Atta, Rice & Dal', price: 95, mrp: 110, pack: '1 kg', img: '/assets/product-rajdhani-besan.jpg' },
    { name: 'Amul Pasteurised Salted Butter 500g', cat: 'Dairy, Bread & Eggs', price: 265, mrp: 275, pack: '500 g', img: '/assets/product-amul-butter.jpg' },
    { name: 'Amul Blend Diced Cheese 200g', cat: 'Dairy, Bread & Eggs', price: 125, mrp: 140, pack: '200 g', img: '/assets/product-amul-cheese.jpg' },
    { name: 'Amul Masti Dahi Curd Tub 400g', cat: 'Dairy, Bread & Eggs', price: 40, mrp: 42, pack: '400 g', img: '/assets/product-amul-curd.jpg' },
    { name: 'Mother Dairy Classic Dahi 400g', cat: 'Dairy, Bread & Eggs', price: 38, mrp: 40, pack: '400 g', img: '/assets/product-mother-dairy-curd.jpg' },
    { name: 'Britannia 100% Whole Wheat Brown Bread 400g', cat: 'Dairy, Bread & Eggs', price: 45, mrp: 50, pack: '400 g', img: '/assets/product-britannia-bread.jpg' },
    { name: 'Table White Fresh Farm Eggs 6 pcs', cat: 'Dairy, Bread & Eggs', price: 48, mrp: 55, pack: '6 pcs', img: '/assets/product-eggs.jpg' },
    { name: 'Lay\'s India\'s Magic Masala Potato Chips 50g', cat: 'Snacks & Drinks', price: 18, mrp: 20, pack: '50 g', img: '/assets/product-lays-magic-masala.jpg' },
    { name: 'Lay\'s American Style Cream & Onion Chips 50g', cat: 'Snacks & Drinks', price: 18, mrp: 20, pack: '50 g', img: '/assets/product-lays-cream-onion.jpg' },
    { name: 'Kurkure Solid Masti Masala Twisteez 85g', cat: 'Snacks & Drinks', price: 20, mrp: 20, pack: '85 g', img: '/assets/product-kurkure.jpg' },
    { name: 'Haldiram\'s Nagpur Spicy Sev Bhujia 400g', cat: 'Snacks & Drinks', price: 105, mrp: 120, pack: '400 g', img: '/assets/product-haldiram-sev.jpg' },
    { name: 'Balaji Ratlami Sev Spicy Namkeen 400g', cat: 'Snacks & Drinks', price: 95, mrp: 110, pack: '400 g', img: '/assets/product-balaji-sev.jpg' },
    { name: 'Doritos Nacho Cheese Tortilla Chips 75g', cat: 'Snacks & Drinks', price: 35, mrp: 40, pack: '75 g', img: '/assets/product-doritos.jpg' },
    { name: 'Act II Classic Salted Instant Butter Popcorn 120g', cat: 'Snacks & Drinks', price: 45, mrp: 50, pack: '120 g', img: '/assets/product-act2-popcorn.jpg' },
    { name: 'Parle Real Elaichi Premium Crunchy Rusk 300g', cat: 'Dairy, Bread & Eggs', price: 45, mrp: 50, pack: '300 g', img: '/assets/product-parle-rusk.jpg' },
    { name: 'MTR 3 Minute Khatta Meetha Poha 60g', cat: 'Dairy, Bread & Eggs', price: 25, mrp: 30, pack: '60 g', img: '/assets/product-mtr-poha.jpg' },
    { name: 'MTR Instant Rava Upma Mix 500g', cat: 'Dairy, Bread & Eggs', price: 75, mrp: 85, pack: '500 g', img: '/assets/product-mtr-upma.jpg' },
    { name: 'Fresh Red Local Hybrid Tomatoes 1kg', cat: 'Fruits & Vegetables', price: 28, mrp: 40, pack: '1 kg', img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=600' },
    { name: 'Fresh Golden Jyoti Potatoes 1kg', cat: 'Fruits & Vegetables', price: 24, mrp: 30, pack: '1 kg', img: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=600' },
    { name: 'Fresh Crisp Red Onions 1kg', cat: 'Fruits & Vegetables', price: 32, mrp: 45, pack: '1 kg', img: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&q=80&w=600' },
    { name: 'Fresh Green Coriander / Dhaniya 100g', cat: 'Fruits & Vegetables', price: 12, mrp: 20, pack: '100 g', img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=600' },
    { name: 'Royal Gala Crisp Red Apples 4 pcs', cat: 'Fruits & Vegetables', price: 140, mrp: 170, pack: '4 pcs', img: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=600' },
    { name: 'Fresh Robusta Bananas 1 Dozen', cat: 'Fruits & Vegetables', price: 45, mrp: 60, pack: '12 pcs', img: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=600' },
    { name: 'Coca-Cola Original Taste Soft Drink 750ml', cat: 'Snacks & Drinks', price: 38, mrp: 40, pack: '750 ml', img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=600' },
    { name: 'Real Fruit Power Mixed Fruit Juice 1L', cat: 'Snacks & Drinks', price: 110, mrp: 130, pack: '1 L', img: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&q=80&w=600' },
    { name: 'Dettol Original Germ Protection Bath Soap 125g (Pack of 4)', cat: 'Personal & Beauty', price: 165, mrp: 190, pack: '4x125g', img: 'https://images.unsplash.com/photo-1607006314392-e4210d32e5ce?auto=format&fit=crop&q=80&w=600' },
    { name: 'Surf Excel Easy Wash Detergent Powder 1kg', cat: 'Grocery & Kitchen', price: 135, mrp: 155, pack: '1 kg', img: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&q=80&w=600' },
    { name: 'Vim Lemon Dishwash Gel Bottle 500ml', cat: 'Grocery & Kitchen', price: 115, mrp: 130, pack: '500 ml', img: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&q=80&w=600' },
    { name: 'Cadbury Dairy Milk Silk Hazelnut Chocolate 58g', cat: 'Snacks & Drinks', price: 75, mrp: 85, pack: '58 g', img: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&q=80&w=600' }
  ];

  let count = 0;
  for (let idx = 0; idx < prodsToInsert.length; idx++) {
    const p = prodsToInsert[idx];
    const catId = catMap[p.cat] || catMap['Atta, Rice & Dal'];
    const sku = 'SKU-' + (idx + 1000) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const doc = {
      productName: p.name,
      name: p.name,
      slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      sku: sku,
      category: catId,
      categoryId: catId,
      subcategory: catId,
      subcategoryId: catId,
      seller: sellerId,
      sellerId: sellerId,
      price: p.price,
      discPrice: p.price,
      compareAtPrice: p.mrp,
      mrp: p.mrp,
      discount: Math.round(((p.mrp - p.price) / p.mrp) * 100),
      stock: 150,
      mainImage: p.img,
      mainImageUrl: p.img,
      galleryImages: [p.img],
      galleryImageUrls: [p.img],
      pack: p.pack,
      status: 'Active',
      publish: true,
      popular: true,
      dealOfDay: true,
      rating: 4.8,
      reviewsCount: 95,
      isReturnable: true,
      approvalStatus: 'Approved',
      isShopByStoreOnly: false,
      variations: [{ name: 'Standard Pack', value: p.pack, price: p.price, discPrice: p.price, stock: 150, status: 'Available' }],
      updatedAt: new Date()
    };

    const ex = await db.collection('products').findOne({ productName: p.name });
    if (ex) {
      await db.collection('products').updateOne({ _id: ex._id }, { $set: doc });
    } else {
      await db.collection('products').insertOne({ ...doc, createdAt: new Date() });
    }
    count++;
  }
  console.log('✅ Processed products:', count);

  const allProds = await db.collection('products').find({ status: 'Active', publish: true }).toArray();
  console.log('✅ Total active products in Atlas DB:', allProds.length);

  // Update Bestseller Cards for root categories
  const rootCats = await db.collection('categories').find({ parentId: null }).toArray();
  await db.collection('bestsellercards').deleteMany({});
  const bsDocs = rootCats.map((c, idx) => ({
    name: c.name,
    category: c._id,
    order: idx + 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  await db.collection('bestsellercards').insertMany(bsDocs);
  console.log('✅ Updated bestsellercards:', bsDocs.length);

  // Update Lowest Prices
  await db.collection('lowestpricesproducts').deleteMany({});
  const lpDocs = allProds.slice(0, 8).map((p, idx) => ({
    product: p._id,
    order: idx + 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  await db.collection('lowestpricesproducts').insertMany(lpDocs);
  console.log('✅ Updated lowestpricesproducts:', lpDocs.length);

  // Update Shops
  await db.collection('shops').deleteMany({});
  const SHOPS_DATA = [
    { storeId: 'supermarket-essentials', name: 'Olovely Supermart', image: '/assets/shopbystore/fashion.jpg', order: 1 },
    { storeId: 'dairy-farm-fresh', name: 'Daily Dairy & Bakery', image: '/assets/shopbystore/pet.jpg', order: 2 },
    { storeId: 'snack-refreshment', name: 'Snack & Munchies Hub', image: '/assets/shopbystore/sports.jpg', order: 3 },
    { storeId: 'organic-green', name: 'Farm Fresh Organic', image: '/assets/shopbystore/pharma.jpg', order: 4 },
    { storeId: 'home-cleaning', name: 'Clean Home & Care', image: '/assets/shopbystore/toy.jpg', order: 5 },
    { storeId: 'spiritual-store', name: 'Pooja & Spiritual Needs', image: '/assets/shopbystore/spiritual.jpg', order: 6 },
  ];
  const shopDocs = SHOPS_DATA.map((s, idx) => ({
    ...s,
    products: allProds.slice(idx * 4, (idx + 1) * 4).map(p => p._id),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  await db.collection('shops').insertMany(shopDocs);
  console.log('✅ Updated shops:', shopDocs.length);

  // Update PromoStrip
  await db.collection('promostrips').deleteMany({});
  const promoCards = rootCats.slice(0, 4).map((c, idx) => ({
    categoryId: c._id,
    title: c.name,
    badge: 'Up to 35% OFF',
    order: idx + 1
  }));
  await db.collection('promostrips').insertOne({
    headerCategorySlug: 'all',
    heading: 'HOUSEFULL',
    saleText: 'SUPER SAVER SALE',
    crazyDealsTitle: 'CRAZY DEALS',
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    categoryCards: promoCards,
    featuredProducts: allProds.slice(0, 6).map(p => p._id),
    isActive: true,
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log('✅ Updated PromoStrip for all');

  await mongoose.disconnect();
}

insertAllCatalog().catch(console.error);
