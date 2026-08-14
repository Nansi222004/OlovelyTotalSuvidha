import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function fixIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }
        const collection = db.collection('deliveries');

        console.log('Checking indexes for "deliveries" collection...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        const hasGeoIndex = indexes.some(idx => idx.key && idx.key.location === '2dsphere');

        if (!hasGeoIndex) {
            console.log('Creating 2dsphere index on "location" field...');
            await collection.createIndex({ location: '2dsphere' });
            console.log('Index created successfully!');
        } else {
            console.log('2dsphere index already exists.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

fixIndexes();
