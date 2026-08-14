
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import AppSettings from './src/models/AppSettings';

dotenv.config({ path: path.join(__dirname, '.env') });

const checkSettings = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        const settings = await AppSettings.findOne();
        console.log('AppSettings:', JSON.stringify(settings, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

checkSettings();
