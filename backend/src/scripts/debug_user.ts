
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Delivery from '../models/Delivery';

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
        console.log(`Searching for delivery user with mobile: ${mobile}`);

        const user = await Delivery.findOne({ mobile });

        if (user) {
            console.log('User found via findOne({mobile}):');
            console.log('ID:', user._id);
            console.log('ID Type:', typeof user._id);
            console.log('ID Constructor:', user._id.constructor.name);
            console.log('Full Doc:', user.toJSON());

            console.log('--- Testing findById ---');
            const userById = await Delivery.findById(user._id);
            console.log('Result of findById(id):', userById ? 'Found' : 'Not Found');

            console.log('--- Testing findById with String ---');
            const userByIdString = await Delivery.findById(user._id.toString());
            console.log('Result of findById(string):', userByIdString ? 'Found' : 'Not Found');

        } else {
            console.log('User not found via mobile query');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

run();

