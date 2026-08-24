const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testFetchSectionData() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const sections = await db.collection('homesections').find({}).toArray();
  for (const sec of sections) {
    const specificIds = (sec.subCategories || []).map(id => new mongoose.Types.ObjectId(id.toString()));
    const foundCategories = await db.collection('categories').find({ _id: { $in: specificIds } }).toArray();
    console.log('Section:', sec.title, '| Specified:', specificIds.length, '| Found in categories:', foundCategories.length);
    foundCategories.forEach(c => console.log('   - Subcat Name:', c.name, '| Image:', c.image));
  }

  await mongoose.disconnect();
}

testFetchSectionData().catch(console.error);
