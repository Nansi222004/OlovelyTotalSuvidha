
// This migration script is currently disabled as it references properties
// that don't exist in the current Product model. Re-enable when needed.

/*
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

const slugify = (text: string) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-')   // Replace multiple - with single -
        .replace(/^-+/, '')       // Trim - from start
        .replace(/-+$/, '');      // Trim - from end
};

const migrateSlugs = async () => {
    await connectDB();

    try {
        const products = await Product.find({});
        console.log(`Found ${products.length} products to check.`);

        let updatedCount = 0;

        for (const product of products) {
            if (!product.slug) {
                let baseSlug = slugify(product.productName);
                let uniqueSlug = baseSlug;
                let counter = 1;

                // Check for uniqueness
                while (await Product.findOne({ slug: uniqueSlug, _id: { $ne: product._id } })) {
                    uniqueSlug = `${baseSlug}-${counter}`;
                    counter++;
                }

                product.slug = uniqueSlug;
                await product.save();
                console.log(`Updated product "${product.productName}" with slug: ${uniqueSlug}`);
                updatedCount++;
            }
        }

        console.log(`Migration complete. Updated ${updatedCount} products.`);
    } catch (error) {
        console.error('Migration Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

migrateSlugs();
*/

console.log('migrate_slugs.ts is currently disabled');

