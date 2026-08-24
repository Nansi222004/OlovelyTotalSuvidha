const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createSectionsExplicit() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const HomeSection = mongoose.model('HomeSection', new mongoose.Schema({}, { strict: false }));

  const sectionDefs = [
    { title: 'Beauty & Personal Care', slug: 'beauty-personal-care' },
    { title: 'Snacks & Drinks', slug: 'snacks-drinks' },
    { title: 'Household Essentials', slug: 'household-essentials' },
    { title: 'Home & Lifestyle', slug: 'home-lifestyle' }
  ];

  let order = 1;
  for (const def of sectionDefs) {
    const rootCat = await db.collection('categories').findOne({ name: def.title });
    const subCats = rootCat ? await db.collection('categories').find({ parentId: rootCat._id }).toArray() : [];
    const subIds = subCats.map(c => c._id);

    const doc = await HomeSection.findOneAndUpdate(
      { slug: def.slug },
      {
        $set: {
          title: def.title,
          slug: def.slug,
          displayType: 'subcategories',
          categories: rootCat ? [rootCat._id] : [],
          subCategories: subIds,
          columns: 4,
          limit: 8,
          isActive: true,
          pageLocation: 'Home Page',
          order: order++
        }
      },
      { upsert: true, new: true }
    );
    console.log('Saved Section:', doc.title, '| ID:', doc._id.toString(), '| Subcats:', subIds.length);
  }

  const all = await db.collection('homesections').find({}).toArray();
  console.log('\nTotal Homesections in DB Now:', all.length);

  await mongoose.disconnect();
}

createSectionsExplicit().catch(console.error);
