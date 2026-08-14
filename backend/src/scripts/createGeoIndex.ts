import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createGeoIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }

        const collection = db.collection('deliveries');

        console.log('\n📋 Checking existing indexes...');
        const existingIndexes = await collection.indexes();
        console.log('Current indexes:', existingIndexes.map(idx => idx.name).join(', '));

        const hasGeoIndex = existingIndexes.some(idx =>
            idx.key && idx.key.location === '2dsphere'
        );

        if (hasGeoIndex) {
            console.log('\n✅ 2dsphere index already exists on location field');
        } else {
            console.log('\n🔧 Creating 2dsphere index on location field...');

            try {
                await collection.createIndex({ location: '2dsphere' });
                console.log('✅ Successfully created 2dsphere index!');
            } catch (indexError: any) {
                console.error('❌ Failed to create index:', indexError.message);

                // Check if documents have invalid location data
                console.log('\n🔍 Checking for documents with invalid location data...');
                const invalidDocs = await collection.find({
                    location: { $exists: true, $ne: null },
                    $or: [
                        { 'location.type': { $ne: 'Point' } },
                        { 'location.coordinates': { $not: { $type: 'array' } } }
                    ]
                }).toArray();

                if (invalidDocs.length > 0) {
                    console.log(`⚠️ Found ${invalidDocs.length} documents with invalid location data:`);
                    invalidDocs.forEach(doc => {
                        console.log(`   - ${doc.name} (${doc._id}): ${JSON.stringify(doc.location)}`);
                    });
                    console.log('\n💡 Fix these documents and try again.');
                } else {
                    console.log('✅ All documents have valid location data');
                }
            }
        }

        console.log('\n📊 Final index list:');
        const finalIndexes = await collection.indexes();
        finalIndexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Connection closed');
    }
}

createGeoIndex();
