
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

const updateProduct = async () => {
    await connectDB();
    try {
        const productId = '695b7dd1a0b51822cd3333bd';
        const Product = mongoose.connection.collection('products');

        console.log(`Updating Product ID: ${productId}`);

        const result = await Product.updateOne(
            {
                _id: new mongoose.Types.ObjectId(productId),
                "variations.value": "250"
            },
            {
                $set: { "variations.$.value": "250g" }
            }
        );

        console.log(`Modified Count: ${result.modifiedCount}`);

        if (result.modifiedCount > 0) {
            console.log("Successfully updated variation from '250' to '250g'");
        } else {
            console.log("No matching variation found or already updated");
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

updateProduct();
