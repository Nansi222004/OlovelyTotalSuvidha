const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function diag() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const sections = await db.collection('homesections').find({}).toArray();
  console.log('=== SECTIONS ===');
  for (const s of sections) {
    console.log(`\nSection: ${s.title} (subCategories len: ${s.subCategories ? s.subCategories.length : 0})`);
    if (s.subCategories && s.subCategories.length > 0) {
      console.log('  subCategory ObjectIds:', s.subCategories.map(id => id.toString()));
      const foundInCat = await db.collection('categories').find({ _id: { $in: s.subCategories } }).toArray();
      console.log('  Found in categories collection count:', foundInCat.length);
      foundInCat.forEach(c => console.log(`     - Name: ${c.name} | Status: ${c.status} | parentId: ${c.parentId}`));
    }
  }

  await mongoose.disconnect();
}

diag().catch(console.error);
