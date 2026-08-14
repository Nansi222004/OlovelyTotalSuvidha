import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function verifyIndex() {
    try {
        await mongoose.connect(MONGODB_URI);
        const name = 'deliveries';

        if (!mongoose.connection.db) {
            throw new Error('Database connection not established');
        }

        const collection = mongoose.connection.db.collection(name);

        console.log(`Checking indexes for ${name}...`);
        const indexes = await collection.indexes();
        console.log(JSON.stringify(indexes, null, 2));

        const hasGeo = indexes.some(idx => idx.key && idx.key.location === '2dsphere');
        if (!hasGeo) {
            console.log('2dsphere index MISSING. Creating it now...');
            await collection.createIndex({ location: '2dsphere' });
            console.log('Index created successfully!');
        } else {
            console.log('2dsphere index already exists.');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

verifyIndex();
