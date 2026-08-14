
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import AppSettings from './src/models/AppSettings';

dotenv.config({ path: path.join(__dirname, '.env') });

const updateSettings = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);

        await AppSettings.updateOne({}, {
            $set: {
                "deliveryConfig.baseDistance": 0.5 // Reduce from 2km to 0.5km
            }
        });

        console.log("Updated baseDistance to 0.5km");

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

updateSettings();
