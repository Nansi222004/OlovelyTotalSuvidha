import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Delivery from '../models/Delivery';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || '');
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const checkVishalStatus = async () => {
    await connectDB();

    try {
        const vishal = await Delivery.findOne({ name: { $regex: /vishal/i } });

        if (!vishal) {
            console.log('❌ Delivery partner "Vishal Patel" NOT FOUND.');
            process.exit(1);
        }

        console.log('\n--- Vishal Patel Status Check ---');
        console.log(`ID: ${vishal._id}`);
        console.log(`Name: ${vishal.name}`);
        console.log(`Mobile: ${vishal.mobile}`);
        console.log(`Status: ${vishal.status} (Should be 'Active')`);
        console.log(`Is Online: ${vishal.isOnline}`);
        console.log(`Available: ${vishal.available}`);

        if (vishal.location && vishal.location.coordinates) {
            console.log(`Location: [${vishal.location.coordinates[0]}, ${vishal.location.coordinates[1]}] (Valid GeoJSON)`);
        } else {
            console.log(`Location: ❌ INVALID or MISSING`);
            // Auto-fix location if missing for testing
            vishal.location = {
                type: 'Point',
                coordinates: [75.8577, 22.7196] // Default to Indore center or similar
            };
            console.log('   -> Auto-fixing location to default [75.8577, 22.7196]...');
        }

        if (vishal.status !== 'Active') {
            console.log(`   -> Fixing Status: Set to 'Active'`);
            vishal.status = 'Active';
        }

        if (!vishal.isOnline) {
            console.log(`   -> Fixing Online Status: Set to 'true'`);
            vishal.isOnline = true;
            vishal.available = 'Available';
        }

        await vishal.save();
        console.log('✅ Vishal Patel updated. He is now Active, Online, and has a valid location.');
        console.log('---------------------------------\n');

    } catch (error) {
        console.error('Error checking status:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

checkVishalStatus();
