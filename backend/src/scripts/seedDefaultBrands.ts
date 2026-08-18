import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Brand from '../models/Brand';

dotenv.config();

const defaultBrands = [
  { name: 'Generic / No Brand', status: 'Active' },
  { name: 'Olovely Choice', status: 'Active' },
  { name: 'Premium Essentials', status: 'Active' },
  { name: 'Fresh Harvest', status: 'Active' },
  { name: 'Fashion Trend', status: 'Active' }
];

async function seedBrands() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB for Brand Seeding\n');

    for (const b of defaultBrands) {
      await Brand.findOneAndUpdate(
        { name: b.name },
        { name: b.name, status: b.status },
        { upsert: true, new: true }
      );
    }

    const count = await Brand.countDocuments();
    console.log(`✅ Default brands seeded successfully. Total brands in DB: ${count}`);

  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedBrands();
