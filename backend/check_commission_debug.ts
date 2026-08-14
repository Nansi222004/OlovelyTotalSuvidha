
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Order from './src/models/Order';
import Product from './src/models/Product';
import OrderItem from './src/models/OrderItem';
import Category from './src/models/Category';
import SubCategory from './src/models/SubCategory';

dotenv.config({ path: path.join(__dirname, '.env') });

const checkOrderCommission = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);

        // Find recent order with total 296 or itemsTotal 248
        // User screenshot shows Grand Total 283 (Wait, previous screenshot was 283)
        // User Message says: "Subtotal was 296".
        // Let's search for recent orders.

        const orders = await Order.find().sort({ createdAt: -1 }).limit(1).populate('items');

        if (orders.length === 0) {
            console.log("No orders found.");
            return;
        }

        const order = orders[0];
        console.log(`Found Order #${order.orderNumber} (ID: ${order._id})`);
        console.log(`Total: ${order.total}`);
        console.log(`Subtotal: ${order.subtotal}`);

        if (order.items && order.items.length > 0) {
            const item = await OrderItem.findById(order.items[0]);
            if (item) {
                console.log(`Item: Product ID ${item.product}, Total ${item.total}`);
                const product = await Product.findById(item.product);
                if (product) {
                    console.log(`Product: ${product.productName}`);
                    console.log(`  Category: ${product.category}`);
                    console.log(`  SubCategory: ${product.subcategory}`);
                    console.log(`  SubSubCategory: ${product.subSubCategory}`);
                    console.log(`  Commission Rate (on Product?): ${(product as any).commissionRate}`);

                    // Check Categories
                    if (product.category) {
                        const cat = await Category.findById(product.category);
                        console.log(`  Category Comm Rate: ${cat?.commissionRate}`);
                    }
                    if (product.subcategory) {
                        const sub = await SubCategory.findById(product.subcategory);
                        console.log(`  SubCategory Comm Rate: ${sub?.commissionRate}`);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

checkOrderCommission();
