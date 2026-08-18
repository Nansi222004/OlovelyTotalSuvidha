import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config(); // Also check current working directory .env


const SAMPLE_PRODUCTS = [
  {
    productName: "Aashirvaad Shuddh Chakki Atta 5kg",
    price: 265,
    discPrice: 239,
    compareAtPrice: 265,
    stock: 100,
    mainImage: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=600",
    pack: "5 kg",
    categoryName: "Atta, Rice & Dal",
    tags: ["atta", "flour", "grocery", "staples"]
  },
  {
    productName: "Daawat Rozana Gold Basmati Rice 5kg",
    price: 395,
    discPrice: 349,
    compareAtPrice: 420,
    stock: 80,
    mainImage: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=600",
    pack: "5 kg",
    categoryName: "Atta, Rice & Dal",
    tags: ["rice", "basmati", "grocery", "staples"]
  },
  {
    productName: "Tata Sampann Unpolished Toor Dal 1kg",
    price: 185,
    discPrice: 165,
    compareAtPrice: 195,
    stock: 120,
    mainImage: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=600",
    pack: "1 kg",
    categoryName: "Atta, Rice & Dal",
    tags: ["dal", "pulses", "grocery", "staples"]
  },
  {
    productName: "Amul Taaza Toned Milk 500ml",
    price: 28,
    discPrice: 27,
    compareAtPrice: 28,
    stock: 200,
    mainImage: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=600",
    pack: "500 ml",
    categoryName: "Dairy, Bread & Eggs",
    tags: ["milk", "dairy", "amul", "fresh"]
  },
  {
    productName: "Amul Pasteurised Butter 500g",
    price: 275,
    discPrice: 265,
    compareAtPrice: 285,
    stock: 90,
    mainImage: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=600",
    pack: "500 g",
    categoryName: "Dairy, Bread & Eggs",
    tags: ["butter", "dairy", "amul"]
  },
  {
    productName: "Fresh Brown Farm Eggs 6 pcs",
    price: 55,
    discPrice: 48,
    compareAtPrice: 60,
    stock: 150,
    mainImage: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=600",
    pack: "6 pcs",
    categoryName: "Dairy, Bread & Eggs",
    tags: ["eggs", "protein", "breakfast"]
  },
  {
    productName: "Farm Fresh Hybrid Tomatoes 1kg",
    price: 40,
    discPrice: 29,
    compareAtPrice: 45,
    stock: 200,
    mainImage: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=600",
    pack: "1 kg",
    categoryName: "Fresh Vegetables",
    tags: ["vegetables", "tomato", "fresh"]
  },
  {
    productName: "Fresh Green Coriander / Dhaniya 100g",
    price: 15,
    discPrice: 10,
    compareAtPrice: 20,
    stock: 100,
    mainImage: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=600",
    pack: "100 g",
    categoryName: "Fresh Vegetables",
    tags: ["coriander", "greens", "fresh"]
  },
  {
    productName: "Fresh Nagpur Sweet Oranges 1kg",
    price: 110,
    discPrice: 89,
    compareAtPrice: 120,
    stock: 60,
    mainImage: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=600",
    pack: "1 kg",
    categoryName: "Fresh Fruits",
    tags: ["fruits", "orange", "fresh"]
  },
  {
    productName: "Lays India's Magic Masala 50g",
    price: 20,
    discPrice: 18,
    compareAtPrice: 20,
    stock: 300,
    mainImage: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=600",
    pack: "50 g",
    categoryName: "Chips & Snacks",
    tags: ["chips", "snacks", "lays"]
  },
  {
    productName: "Haldiram's Bhujia Sev 400g",
    price: 120,
    discPrice: 105,
    compareAtPrice: 125,
    stock: 140,
    mainImage: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=600",
    pack: "400 g",
    categoryName: "Chips & Snacks",
    tags: ["namkeen", "bhujia", "haldiram", "snacks"]
  },
  {
    productName: "Cadbury Dairy Milk Silk Chocolate 60g",
    price: 80,
    discPrice: 72,
    compareAtPrice: 85,
    stock: 250,
    mainImage: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&q=80&w=600",
    pack: "60 g",
    categoryName: "Chips & Snacks",
    tags: ["chocolate", "cadbury", "silk", "sweets"]
  }
];

async function fixData() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/olovely';
  console.log('Connecting to', uri);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  // 1. Ensure approved seller with 500km radius so service is always available
  let seller = await db.collection('sellers').findOne({});
  const sellerData = {
    sellerName: 'Olovely Supermart',
    storeName: 'Olovely Supermart',
    email: 'seller@olovely.com',
    mobile: '9999999999',
    category: 'Grocery',
    categories: ['Grocery', 'Dairy, Bread & Eggs', 'Snacks & Munchies', 'Fruits & Vegetables'],
    city: 'Indore',
    address: 'Indore City, Madhya Pradesh, 452001',
    status: 'Approved',
    isShopOpen: true,
    serviceRadiusKm: 500, // 500 km ensures serviceability everywhere in dev/test
    latitude: '22.717650',
    longitude: '75.871860',
    location: {
      type: 'Point',
      coordinates: [75.871860, 22.717650],
    },
    requireProductApproval: false,
    viewCustomerDetails: true,
    commission: 0,
    updatedAt: new Date(),
  };

  if (!seller) {
    console.log('Creating default approved seller...');
    const result = await db.collection('sellers').insertOne({
      ...sellerData,
      createdAt: new Date(),
    });
    seller = { _id: result.insertedId };
  } else {
    console.log('Updating existing seller:', seller._id);
    await db.collection('sellers').updateOne({ _id: seller._id }, { $set: sellerData });
  }

  // 2. Find Grocery HeaderCategory
  const groceryHeader = await db.collection('headercategories').findOne({ slug: 'grocery' });
  const groceryHeaderId = groceryHeader ? groceryHeader._id : null;

  // 3. Normalize all categories to status: 'Active'
  const updateCatRes = await db.collection('categories').updateMany(
    {},
    {
      $set: {
        status: 'Active',
        ...(groceryHeaderId ? { headerCategoryId: groceryHeaderId } : {})
      }
    }
  );
  console.log(`Updated categories to status 'Active': ${updateCatRes.modifiedCount}`);

  // 4. Update or Insert sample products
  for (const item of SAMPLE_PRODUCTS) {
    // Find category if possible
    const cat = await db.collection('categories').findOne({ name: item.categoryName });
    const catId = cat ? cat._id : undefined;

    const existing = await db.collection('products').findOne({ productName: item.productName });
    const prodDoc = {
      productName: item.productName,
      seller: seller._id,
      category: catId,
      headerCategoryId: groceryHeaderId,
      price: item.price,
      discPrice: item.discPrice,
      compareAtPrice: item.compareAtPrice,
      stock: item.stock,
      mainImage: item.mainImage,
      galleryImages: [item.mainImage],
      pack: item.pack,
      status: 'Active',
      publish: true,
      popular: true,
      dealOfDay: true,
      rating: 4.8,
      reviewsCount: 34,
      discount: Math.round(((item.compareAtPrice - item.discPrice) / item.compareAtPrice) * 100),
      tags: item.tags,
      requiresApproval: false,
      isShopByStoreOnly: false,
      variations: [
        {
          name: 'Standard',
          value: item.pack,
          price: item.price,
          discPrice: item.discPrice,
          stock: item.stock,
          status: 'Available',
        }
      ],
      updatedAt: new Date()
    };

    if (existing) {
      await db.collection('products').updateOne({ _id: existing._id }, { $set: prodDoc });
    } else {
      await db.collection('products').insertOne({
        ...prodDoc,
        createdAt: new Date(),
      });
    }
  }

  // 5. Update remaining existing products
  await db.collection('products').updateMany(
    {},
    {
      $set: {
        seller: seller._id,
        status: 'Active',
        publish: true,
        requiresApproval: false,
      }
    }
  );

  const totalProducts = await db.collection('products').find({ status: 'Active', publish: true }).toArray();
  console.log(`Total active published products: ${totalProducts.length}`);

  // 6. Populate LowestPricesEver section
  await db.collection('lowestpricesproducts').deleteMany({});
  const lpDocs = totalProducts.slice(0, 8).map((p, idx) => ({
    product: p._id,
    order: idx + 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  if (lpDocs.length > 0) {
    await db.collection('lowestpricesproducts').insertMany(lpDocs);
    console.log(`Populated LowestPricesProducts: ${lpDocs.length}`);
  }

  // 7. Populate BestsellerCards with categories that have products
  await db.collection('bestsellercards').deleteMany({});
  const allCats = await db.collection('categories').find({ status: 'Active' }).toArray();
  const bsDocs = allCats.slice(0, 6).map((c, idx) => ({
    category: c._id,
    name: c.name,
    order: idx + 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  if (bsDocs.length > 0) {
    await db.collection('bestsellercards').insertMany(bsDocs);
    console.log(`Populated BestsellerCards: ${bsDocs.length}`);
  }

  console.log('✅ Complete database normalization completed successfully!');
  await mongoose.disconnect();
}

fixData().catch(console.error);
