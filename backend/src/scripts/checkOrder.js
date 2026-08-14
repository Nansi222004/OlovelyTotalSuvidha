
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

const checkOrder = async () => {
    await connectDB();
    try {
        const orderId = '695b85eedda527207ba38dfe';
        const Order = mongoose.connection.collection('orders');
        const OrderItem = mongoose.connection.collection('orderitems');

        console.log(`Checking Order: ${orderId}`);
        const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(orderId) });

        if (order) {
            console.log('Order Items IDs:', order.items);

            const items = await OrderItem.find({ order: new mongoose.Types.ObjectId(orderId) }).toArray();
            console.log('Order Items Data:');
            items.forEach(item => {
                console.log(`Item: ${item.productName}`);
                console.log(`  Variation stored: '${item.variation}'`);
                console.log(`  UnitPrice: ${item.unitPrice}`);
                console.log(`  Quantity: ${item.quantity}`);
                console.log(`  ProductID: ${item.product}`);
            });

            // Allow time for logs to flush
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
            console.log('Order not found');
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

checkOrder();
