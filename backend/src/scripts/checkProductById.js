
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

const checkProductById = async () => {
    await connectDB();
    try {
        const productId = '695b7dd1a0b51822cd3333bd';
        const Product = mongoose.connection.collection('products');

        console.log(`Checking Product ID: ${productId}`);
        const product = await Product.findOne({ _id: new mongoose.Types.ObjectId(productId) });

        if (product) {
            console.log('Product Found:', product.productName);
            console.log('Variations:', JSON.stringify(product.variations, null, 2));
        } else {
            console.log('Product not found');
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

checkProductById();
