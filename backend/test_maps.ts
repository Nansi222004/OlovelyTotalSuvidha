
import { getRoadDistances } from './src/services/mapService';
import mongoose from 'mongoose';
import AppSettings from './src/models/AppSettings';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const testMaps = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        const settings = await AppSettings.findOne();
        const apiKey = settings?.deliveryConfig?.googleMapsKey;

        console.log(`Testing with API Key: ${apiKey}`);

        // Indore Coordinates
        const origin = { lat: 22.7196, lng: 75.8577 };
        // 5km away
        const dest = { lat: 22.76, lng: 75.90 };

        console.log('Origin:', origin);
        console.log('Dest:', dest);

        const distances = await getRoadDistances([origin], dest, apiKey);
        console.log('Distances (km):', distances);

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

testMaps();
