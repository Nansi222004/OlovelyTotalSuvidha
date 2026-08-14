
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Cart from './src/models/Cart';
import CartItem from './src/models/CartItem';
import Product from './src/models/Product';
import Seller from './src/models/Seller';

dotenv.config({ path: path.join(__dirname, '.env') });

const checkBadCarts = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);

        const badSellers = await Seller.find({
            $or: [
                { 'location.coordinates': { $size: 0 } },
                { 'location.coordinates': { $exists: false } }, // Logic check: coordinates usually [lng, lat]
                // Checking my previous logic: "Has Geo: NO" means (coords len != 2) AND (!lat || !lng)
            ]
        });

        const badSellerIds = badSellers
            .filter(s => {
                const hasCoord = s.location?.coordinates?.length === 2;
                const hasLatLng = s.latitude && s.longitude;
                return !hasCoord && !hasLatLng;
            })
            .map(s => s._id);

        console.log(`Bad Sellers: ${badSellerIds.join(', ')}`);

        // Find products by these sellers
        const badProducts = await Product.find({ seller: { $in: badSellerIds } }).select('_id productName');
        const badProductIds = badProducts.map(p => p._id);

        console.log(`Bad Products: ${badProducts.length}`);

        // Find CartItems with these products
        const badCartItems = await CartItem.find({ product: { $in: badProductIds } });
        console.log(`CartItems with bad products: ${badCartItems.length}`);

        if (badCartItems.length > 0) {
            console.log('--- Warning: Users exist with un-calculable delivery fees due to missing seller location ---');
            for (const item of badCartItems) {
                console.log(`CartItem: ${item._id}, Product: ${item.product}, Cart: ${item.cart}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

checkBadCarts();
