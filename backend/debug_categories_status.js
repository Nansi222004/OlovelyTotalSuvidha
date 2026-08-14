const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const CategorySchema = new mongoose.Schema({
    name: String,
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    status: { type: String, default: 'Active' }
}, { timestamps: true });

async function debug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Category = mongoose.model('Category', CategorySchema);

        const selectedCategoryName = "Vegetables & Fruits";
        const selectedCat = await Category.findOne({ name: selectedCategoryName });

        if (selectedCat) {
            console.log(`\nCategory: ${selectedCat.name} (${selectedCat._id}) [Status: ${selectedCat.status}]`);

            const categorySubs = await Category.find({ parentId: selectedCat._id });
            console.log(`Found ${categorySubs.length} subcategories:`);
            categorySubs.forEach(s => console.log(`  - ${s.name} (${s._id}) [Status: ${s.status}]`));
        } else {
            console.log(`\nCategory "${selectedCategoryName}" not found!`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

debug();
