const { MongoClient } = require('mongodb');
require('dotenv').config();

async function list() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to URI:', uri ? uri.substring(0, 30) + '...' : 'undefined');
  if (!uri) return;

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected!');
    const db = client.db();
    const sections = await db.collection('homesections').find().toArray();
    console.log('Total sections:', sections.length);
    sections.forEach(s => {
      console.log(`- Title: "${s.title}", displayType: "${s.displayType}", isActive: ${s.isActive}, pageLocation: "${s.pageLocation}"`);
      console.log(`  Categories: ${JSON.stringify(s.categories)}`);
      console.log(`  Subcategories: ${JSON.stringify(s.subCategories)}`);
      console.log(`  Products: ${JSON.stringify(s.products)}`);
      console.log('-----------------');
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

list();
