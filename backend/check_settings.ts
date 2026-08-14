
import mongoose from 'mongoose';
import AppSettings from './src/models/AppSettings';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dhakad-snazzy');
        const settings = await AppSettings.findOne({});
        console.log("APP SETTINGS:", JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
