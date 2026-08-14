
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Seller from './src/models/Seller';

dotenv.config({ path: path.join(__dirname, '.env') });

const fixSellerLocations = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);

        const result = await Seller.updateMany(
            {
                $or: [
                    { 'location.coordinates': { $size: 0 } },
                    { 'location.coordinates': { $exists: false } },
                    { 'location': { $exists: false } }
                ]
            },
            {
                $set: {
                    latitude: '22.7196',
                    longitude: '75.8577',
                    location: {
                        type: 'Point',
                        coordinates: [75.8577, 22.7196]
                    }
                }
            }
        );

        console.log(`Updated ${result.modifiedCount} sellers with default location (Indore).`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

fixSellerLocations();
