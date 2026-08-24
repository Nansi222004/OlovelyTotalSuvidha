const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function seedUniqueSubcats() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const sectionDefs = [
    {
      title: 'Beauty & Personal Care',
      slug: 'beauty-personal-care',
      subcategories: [
        { name: 'Bath & Body', image: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png' },
        { name: 'Hair Care', image: 'https://cdn-icons-png.flaticon.com/512/3058/3058866.png' },
        { name: 'Skin & Face', image: 'https://cdn-icons-png.flaticon.com/512/2821/2821734.png' },
        { name: 'Beauty & Cosmetics', image: 'https://cdn-icons-png.flaticon.com/512/3163/3163206.png' },
        { name: 'Oral Care', image: 'https://cdn-icons-png.flaticon.com/512/2965/2965300.png' },
        { name: 'Men\'s Care', image: 'https://cdn-icons-png.flaticon.com/512/1807/1807409.png' },
        { name: 'Feminine Hygiene', image: 'https://cdn-icons-png.flaticon.com/512/2821/2821785.png' },
        { name: 'Baby Care', image: 'https://cdn-icons-png.flaticon.com/512/3082/3082060.png' }
      ]
    },
    {
      title: 'Snacks & Drinks',
      slug: 'snacks-drinks',
      subcategories: [
        { name: 'Chips & Namkeen', image: 'https://cdn-icons-png.flaticon.com/512/2553/2553691.png' },
        { name: 'Sweets & Chocolates', image: 'https://cdn-icons-png.flaticon.com/512/2523/2523588.png' },
        { name: 'Drinks & Juices', image: 'https://cdn-icons-png.flaticon.com/512/2405/2405479.png' },
        { name: 'Tea, Coffee & Milk Drinks', image: 'https://cdn-icons-png.flaticon.com/512/924/924514.png' },
        { name: 'Instant Food', image: 'https://cdn-icons-png.flaticon.com/512/2722/2722144.png' },
        { name: 'Sauces & Spreads', image: 'https://cdn-icons-png.flaticon.com/512/2405/2405524.png' },
        { name: 'Paan Corner', image: 'https://cdn-icons-png.flaticon.com/512/3082/3082046.png' },
        { name: 'Ice Creams & More', image: 'https://cdn-icons-png.flaticon.com/512/938/938063.png' }
      ]
    },
    {
      title: 'Household Essentials',
      slug: 'household-essentials',
      subcategories: [
        { name: 'Laundry Detergents', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917641.png' },
        { name: 'Dishwashing', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917652.png' },
        { name: 'All Purpose Cleaners', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917666.png' },
        { name: 'Tissues & Paper Towels', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917680.png' },
        { name: 'Air Fresheners', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917695.png' },
        { name: 'Pest Control', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917710.png' },
        { name: 'Pooja Needs', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917725.png' },
        { name: 'Repellents', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917740.png' }
      ]
    },
    {
      title: 'Home & Lifestyle',
      slug: 'home-lifestyle',
      subcategories: [
        { name: 'Bath Essentials', image: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png' },
        { name: 'Storage & Organizers', image: 'https://cdn-icons-png.flaticon.com/512/3081/3081907.png' },
        { name: 'Kitchen Tools', image: 'https://cdn-icons-png.flaticon.com/512/1830/1830839.png' },
        { name: 'Dining & Cutlery', image: 'https://cdn-icons-png.flaticon.com/512/2722/2722144.png' },
        { name: 'Electrical Fitting', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917755.png' },
        { name: 'Stationery & Games', image: 'https://cdn-icons-png.flaticon.com/512/2917/2917770.png' }
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

    console.log(`✅ ${def.title}: Saved & Linked ${subIds.length} subcategory ObjectIds to HomeSection`);
  }

  await mongoose.disconnect();
  console.log('\n🎉 ALL 4 SECTIONS FULLY POPULATED & LINKED!');
}

seedUniqueSubcats().catch(console.error);
