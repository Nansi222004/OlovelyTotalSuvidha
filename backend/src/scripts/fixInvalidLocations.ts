import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function fixInvalidLocations() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }

        const collection = db.collection('deliveries');

        console.log('\n🔍 Finding documents with invalid location data...');

        // Find documents where location exists but coordinates are missing or invalid
        const invalidDocs = await collection.find({
            location: { $exists: true, $ne: null },
            $or: [
                { 'location.coordinates': { $exists: false } },
                { 'location.coordinates': null },
                { 'location.coordinates': { $not: { $type: 'array' } } },
                { 'location.coordinates': { $size: 0 } }
            ]
        }).toArray();

        console.log(`Found ${invalidDocs.length} documents with invalid location data`);

        if (invalidDocs.length === 0) {
            console.log('✅ All documents have valid location data!');
            return;
        }

        console.log('\n🔧 Fixing invalid documents...');
        let fixed = 0;

        for (const doc of invalidDocs) {
            console.log(`\n   Processing: ${doc.name} (${doc._id})`);
            console.log(`   Current location: ${JSON.stringify(doc.location)}`);

            // Set location to null to remove invalid data
            // The delivery partner will need to update their location when they go online
            await collection.updateOne(
                { _id: doc._id },
                { $set: { location: null } }
            );

            console.log(`   ✅ Set location to null (will be updated when driver goes online)`);
            fixed++;
        }

        console.log(`\n✅ Fixed ${fixed} documents`);
        console.log('\n💡 These delivery partners will need to:');
        console.log('   1. Open the delivery app');
        console.log('   2. Toggle their status to "Online"');
        console.log('   3. Allow location permissions');
        console.log('   This will automatically update their location with valid coordinates.');

        // Now try to create the index again
        console.log('\n🔧 Attempting to create 2dsphere index...');
        try {
            await collection.createIndex({ location: '2dsphere' });
            console.log('✅ Successfully created 2dsphere index!');
        } catch (indexError: any) {
            console.log('ℹ️ Index might already exist:', indexError.message);
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

fixInvalidLocations();
