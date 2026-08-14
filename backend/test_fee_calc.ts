
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import AppSettings from './src/models/AppSettings';
import { getRoadDistances } from './src/services/mapService';

dotenv.config({ path: path.join(__dirname, '.env') });

const testFeeCalc = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        const settings = await AppSettings.findOne();
        const config = settings?.deliveryConfig;

        if (!config || !config.isDistanceBased) {
            console.log("Delivery is NOT distance based.");
            return;
        }

        console.log("Config:", config);

        // Seller Location (Default Indore)
        const sellerLoc = { lat: 22.7196, lng: 75.8577 };

        // Test Cases
        const testPoints = [
            { name: "Center (0km)", lat: 22.7196, lng: 75.8577 },
            { name: "Close (1km approx)", lat: 22.7286, lng: 75.8577 }, // approx 1km North
            { name: "Far (New York? No, just far Indore)", lat: 22.8096, lng: 75.9577 } // quite far
        ];

        for (const pt of testPoints) {
            console.log(`\nTesting: ${pt.name}`);
            const dists = await getRoadDistances([sellerLoc], { lat: pt.lat, lng: pt.lng }, config.googleMapsKey);
            const dist = dists[0];
            console.log(`  Distance: ${dist} km`);

            let fee = config.baseCharge;
            if (dist > config.baseDistance) {
                const extra = dist - config.baseDistance;
                fee += Math.ceil(extra * config.kmRate);
            }
            console.log(`  Calculated Fee: ₹${fee}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

testFeeCalc();
