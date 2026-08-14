
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import Delivery from '../src/models/Delivery';
import { generateToken } from '../src/services/jwtService';

dotenv.config({ path: path.join(__dirname, '../.env') });

const getDeliveryToken = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);

        let delivery = await Delivery.findOne();
        if (!delivery) {
            const random = Math.floor(Math.random() * 10000);
            delivery = await Delivery.create({
                name: 'Test Delivery',
                mobile: `90${random}00000`,
                email: `test_delivery_${random}@example.com`,
                password: 'password123',
                status: 'Active',
                isOnline: true
            });
        }

        const token = generateToken(delivery._id.toString(), 'Delivery');
        fs.writeFileSync('token.txt', token);
        console.log("Token written to token.txt");

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

getDeliveryToken();
