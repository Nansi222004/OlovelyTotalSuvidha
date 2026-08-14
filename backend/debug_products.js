const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Schema = mongoose.Schema;

// Mock models based on the schema I found
const ProductSchema = new Schema({
    productName: String,
    status: String,
    publish: Boolean,
    seller: { type: Schema.Types.ObjectId, ref: 'Seller' },
    category: { type: Schema.Types.ObjectId, ref: 'Category' },
    headerCategoryId: { type: Schema.Types.ObjectId, ref: 'HeaderCategory' }
}, { timestamps: true });

const SellerSchema = new Schema({
    storeName: String,
    status: String,
    isShopOpen: Boolean,
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number]
    },
    serviceRadiusKm: Number
});

const CategorySchema = new Schema({
    name: String,
    status: String,
    headerCategoryId: { type: Schema.Types.ObjectId, ref: 'HeaderCategory' }
});

const HeaderCategorySchema = new Schema({
    name: String,
    status: String,
    slug: String
});

async function debugProducts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
        const Seller = mongoose.models.Seller || mongoose.model('Seller', SellerSchema);
        const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
        const HeaderCategory = mongoose.models.HeaderCategory || mongoose.model('HeaderCategory', HeaderCategorySchema);

        const sareeId = "69c440e825b319275e818059";
        const flourId = "69c4e2fd25b319275e81bf43";

        const products = await Product.find({ _id: { $in: [sareeId, flourId] } });
        console.log(`\nChecking ${products.length} products:`);

        for (const p of products) {
            console.log(`\nProduct: ${p.productName} (${p._id})`);
            console.log(`- Status: ${p.status}`);
            console.log(`- Publish: ${p.publish}`);
            
            const seller = await Seller.findById(p.seller);
            if (seller) {
                console.log(`- Seller: ${seller.storeName} (${seller._id})`);
                console.log(`  - Status: ${seller.status}`);
                console.log(`  - isShopOpen: ${seller.isShopOpen}`);
                console.log(`  - Location: ${JSON.stringify(seller.location?.coordinates)}`);
                console.log(`  - Service Radius: ${seller.serviceRadiusKm} km`);
            } else {
                console.log(`- Seller not found! (${p.seller})`);
            }

            const category = await Category.findById(p.category);
            if (category) {
                console.log(`- Category: ${category.name} (${category._id})`);
                console.log(`  - Status: ${category.status}`);
            } else {
                console.log(`- Category not found! (${p.category})`);
            }

            const headerCat = await HeaderCategory.findById(p.headerCategoryId);
            if (headerCat) {
                console.log(`- Header Category: ${headerCat.name} (${headerCat._id})`);
                console.log(`  - Status: ${headerCat.status}`);
            } else {
                console.log(`- Header Category not found! (${p.headerCategoryId})`);
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugProducts();
