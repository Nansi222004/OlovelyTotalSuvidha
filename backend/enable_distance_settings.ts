
import mongoose from 'mongoose';
import AppSettings from './src/models/AppSettings';
import dotenv from 'dotenv';

dotenv.config();

const updateSettings = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dhakad-snazzy');

        const update = {
            deliveryCharges: 0, // Set base hardcoded to 0 to prove distance logic works
            deliveryConfig: {
                isDistanceBased: true,
                baseCharge: 40,
                baseDistance: 2,
                kmRate: 10,
                deliveryBoyKmRate: 5,
                googleMapsKey: '' // User needs to fill this
            }
        };

        const settings = await AppSettings.findOneAndUpdate({}, update, { new: true, upsert: true });
        console.log("UPDATED APP SETTINGS:", JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

updateSettings();
