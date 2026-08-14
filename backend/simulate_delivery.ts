
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { distributeCommissions } from './src/services/commissionService';
import Order from './src/models/Order';

dotenv.config({ path: path.join(__dirname, '.env') });

const simulateDelivery = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);

        // Find the recent order
        const orders = await Order.find().sort({ createdAt: -1 }).limit(1);
        if (orders.length === 0) {
            console.log("No order found");
            return;
        }
        const orderId = orders[0]._id.toString();
        // Since the order is likely already delivered (based on user story), I need to be careful.
        // distributeCommissions checks if status is Delivered.
        // It also checks if *Paid* commissions exist for Sellers. Since Seller Payout worked, Seller comms are paid.
        // But my NEW Code allows it to process Delivery Boy comm even if Seller is done?
        // Wait, `distributeCommissions` throws "Commissions already distributed" if Paid commissions exist.
        // I need to adjust `distributeCommissions` to NOT throw if *some* are distributed but *delivery* is missing?
        // OR, I can forcibly update the status of the order to Delivered (if not) and then run it.

        console.log(`Processing Order: ${orderId}`);
        const result = await distributeCommissions(orderId);
        console.log("Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

simulateDelivery();
