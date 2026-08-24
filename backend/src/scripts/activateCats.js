const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function activateAllCategories() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const res = await db.collection('categories').updateMany(
    {},
    { $set: { status: 'Active' } }
  );
  console.log('Updated all categories to Active count:', res.modifiedCount);

  await mongoose.disconnect();
}

activateAllCategories().catch(console.error);
