import dotenv from 'dotenv';
dotenv.config();

async function listAllSections() {
  const mongoose = await import('mongoose');
  const HomeSection = (await import('../models/HomeSection')).default;

  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected to DB');

  const sections = await HomeSection.find().lean();
  console.log(`Found ${sections.length} total sections:`);
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

  await mongoose.disconnect();
}

listAllSections();
