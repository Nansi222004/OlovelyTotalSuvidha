
import mongoose from 'mongoose';
import Seller from '../src/models/Seller';
import dotenv from 'dotenv';
import path from 'path';

// Adjust path to point to .env in backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const syncLocations = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI is missing in .env');
            return;
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const sellers = await Seller.find({});
        console.log(`Found ${sellers.length} sellers. Checking for location updates...`);

        let updatedCount = 0;

        for (const seller of sellers) {
            let needsUpdate = false;

            // Check if string coordinates exist
            const strLat = seller.latitude ? parseFloat(seller.latitude) : null;
            const strLng = seller.longitude ? parseFloat(seller.longitude) : null;

            if (strLat !== null && strLng !== null && !isNaN(strLat) && !isNaN(strLng)) {
                // If GeoJSON is missing or invalid, or coordinates mismatch, update it
                if (
                    !seller.location ||
                    !seller.location.coordinates ||
                    seller.location.coordinates.length !== 2 ||
                    Math.abs(seller.location.coordinates[1] - strLat) > 0.0001 || // Lat
                    Math.abs(seller.location.coordinates[0] - strLng) > 0.0001    // Lng
                ) {
                    console.log(`Updating location for seller: ${seller.sellerName}`);
                    seller.location = {
                        type: 'Point',
                        coordinates: [strLng, strLat] // GeoJSON is [lng, lat]
                    };
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await seller.save();
                updatedCount++;
                console.log(`Saved update for ${seller.sellerName}`);
            }
        }

        console.log(`Sync complete. Updated ${updatedCount} sellers.`);

    } catch (error) {
        console.error('Error syncing locations:', error);
    } finally {
        await mongoose.disconnect();
    }
};

syncLocations();
