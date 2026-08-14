console.log('--- STARTING SCRIPT ---');
import dotenv from 'dotenv';
dotenv.config();
console.log('ENV LOADED:', process.env.MONGODB_URI ? 'YES' : 'NO');

import { MongoClient } from 'mongodb';

async function listAllSectionsDirect() {
  const uri = process.env.MONGODB_URI || '';
  console.log('Connecting to URI:', uri.substring(0, 30) + '...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected directly to MongoDB!');
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    const sections = await db.collection('homesections').find().toArray();
    console.log(`Found ${sections.length} sections in homesections collection:`);
    for (const s of sections) {
      console.log(`- Title: "${s.title}"`);
      console.log(`  Slug: "${s.slug}"`);
      console.log(`  isActive: ${s.isActive}`);
      console.log(`  displayType: "${s.displayType}"`);
      console.log(`  pageLocation: "${s.pageLocation}"`);
      console.log(`  targetHeaderCategory: ${s.targetHeaderCategory}`);
      console.log(`  categories count: ${s.categories?.length}`);
      console.log(`  subCategories count: ${s.subCategories?.length}`);
      console.log(`  products count: ${s.products?.length}`);
      console.log('------------------------------------');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

listAllSectionsDirect();
