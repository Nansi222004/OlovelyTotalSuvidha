const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function seedTwoSectionsRealImages() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  // 1. Deactivate or remove Household Essentials and Home & Lifestyle from homesections
  await db.collection('homesections').updateMany(
    { slug: { $in: ['household-essentials', 'home-lifestyle'] } },
    { $set: { isActive: false } }
  );

  // 2. Define the TWO requested Home Sections with real photographic images
  const sectionDefs = [
    {
      title: 'Beauty & Personal Care',
      slug: 'beauty-personal-care',
      subcategories: [
        { name: 'Bath & Body', image: '/assets/skinproduct1.jpg' },
        { name: 'Hair Care', image: '/assets/category-personal-care.png' },
        { name: 'Skin & Face', image: '/assets/skinproduct1.jpg' },
        { name: 'Beauty & Cosmetics', image: '/assets/skinproduct1.jpg' },
        { name: 'Oral Care', image: '/assets/category-pharma-&-wellness.png' },
        { name: 'Men\'s Care', image: '/assets/skinproduct1.jpg' },
        { name: 'Feminine Hygiene', image: '/assets/category-personal-care.png' },
        { name: 'Baby Care', image: '/assets/category-baby-care.png' }
      ]
    },
    {
      title: 'Snacks & Drinks',
      slug: 'snacks-drinks',
      subcategories: [
        { name: 'Chips & Namkeen', image: '/assets/product-lays-magic-masala.jpg' },
        { name: 'Sweets & Chocolates', image: '/assets/category-sweet-tooth.png' },
        { name: 'Drinks & Juices', image: '/assets/category-drinks.png' },
        { name: 'Tea, Coffee & Milk Drinks', image: '/assets/category-tea,-coffe-&-health-drink.png' },
        { name: 'Instant Food', image: '/assets/product-act2-popcorn.jpg' },
        { name: 'Sauces & Spreads', image: '/assets/category-sauces-&-spreads.png' },
        { name: 'Paan Corner', image: '/assets/category-paan-corner.png' },
        { name: 'Ice Creams & More', image: '/assets/product-act2-popcorn.jpg' }
      ]
    }
  ];

  let orderIndex = 1;

  for (const def of sectionDefs) {
    let rootCat = await db.collection('categories').findOne({ slug: def.slug });
    if (!rootCat) {
      rootCat = await db.collection('categories').findOne({ name: def.title });
    }
    if (!rootCat) {
      const res = await db.collection('categories').insertOne({
        name: def.title,
        slug: def.slug,
        status: 'Active',
        parentId: null,
        image: def.subcategories[0].image,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      rootCat = await db.collection('categories').findOne({ _id: res.insertedId });
    } else {
      await db.collection('categories').updateOne({ _id: rootCat._id }, { $set: { status: 'Active', name: def.title } });
    }

    const subIds = [];
    let subOrder = 1;

    for (const subDef of def.subcategories) {
      let baseSlug = subDef.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let subDoc = await db.collection('categories').findOne({ parentId: rootCat._id, name: subDef.name });
      
      if (!subDoc) {
        subDoc = await db.collection('categories').findOne({ slug: baseSlug });
      }

      if (!subDoc) {
        let uniqueSlug = baseSlug;
        let counter = 1;
        while (await db.collection('categories').findOne({ slug: uniqueSlug })) {
          uniqueSlug = `${baseSlug}-${counter++}`;
        }

        const res = await db.collection('categories').insertOne({
          name: subDef.name,
          slug: uniqueSlug,
          status: 'Active',
          parentId: rootCat._id,
          image: subDef.image,
          order: subOrder++,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        subDoc = await db.collection('categories').findOne({ _id: res.insertedId });
      } else {
        await db.collection('categories').updateOne(
          { _id: subDoc._id },
          { $set: { status: 'Active', image: subDef.image, parentId: rootCat._id } }
        );
      }

      subIds.push(subDoc._id);
    }

    await db.collection('homesections').updateOne(
      { slug: def.slug },
      {
        $set: {
          title: def.title,
          slug: def.slug,
          displayType: 'subcategories',
          categories: [rootCat._id],
          subCategories: subIds,
          columns: 4,
          limit: 8,
          isActive: true,
          pageLocation: 'Home Page',
          order: orderIndex++,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`✅ ${def.title}: Saved & Linked ${subIds.length} real photo subcategories`);
  }

  // Double check only 2 sections are active
  const activeSections = await db.collection('homesections').find({ isActive: true }).toArray();
  console.log('\nTotal Active Home Sections in DB:', activeSections.length);
  activeSections.forEach(s => console.log(' - Section:', s.title, '| Subcats count:', s.subCategories?.length));

  await mongoose.disconnect();
  console.log('\n🎉 UPDATED TO 2 REAL PHOTO HOME SECTIONS SUCCESSFULLY!');
}

seedTwoSectionsRealImages().catch(console.error);
