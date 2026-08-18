import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Brand from '../models/Brand';

dotenv.config();

async function inspectBrands() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB for Brand Inspection\n');

    const totalBrands = await Brand.countDocuments();
    const brands = await Brand.find().lean();

    console.log(`📁 Brand Collection Total: ${totalBrands}`);
    console.log('Brands:', brands);

  } catch (err) {
    console.error('❌ Inspection error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

inspectBrands();
