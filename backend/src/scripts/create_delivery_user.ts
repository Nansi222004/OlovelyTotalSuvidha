
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Delivery from '../models/Delivery';
import bcrypt from 'bcrypt';

dotenv.config();

const run = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI missing');
            return;
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const mobile = '9755620716';

        let user = await Delivery.findOne({ mobile });
        if (user) {
            console.log('User already exists:', user._id);
            return;
        }

        console.log('User not found. Creating new Delivery user...');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('123456', salt);

        const newUser = await Delivery.create({
            name: "Test Delivery",
            mobile: mobile,
            email: "test_delivery@example.com",
            password: passwordHash,
            status: "Active",
            isOnline: true,
            balance: 0,
            cashCollected: 0,
            settings: {
                notifications: true,
                location: true,
                sound: true
            }
        });

        console.log('Created User:', newUser._id);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

run();

