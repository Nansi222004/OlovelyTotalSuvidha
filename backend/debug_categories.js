const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const CategorySchema = new mongoose.Schema({
    name: String,
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    status: { type: String, default: 'Active' }
}, { timestamps: true });

const SubCategorySchema = new mongoose.Schema({
    name: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }
}, { timestamps: true });

async function debug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Category = mongoose.model('Category', CategorySchema);
        const SubCategory = mongoose.model('SubCategory', SubCategorySchema);

        const categories = await Category.find({ parentId: null });
        console.log(`Found ${categories.length} top-level categories:`);
        categories.forEach(c => console.log(`- ${c.name} (${c._id})`));

        const selectedCategoryName = "Vegetables & Fruits";
        const selectedCat = await Category.findOne({ name: selectedCategoryName });

        if (selectedCat) {
            console.log(`\nFound target category: ${selectedCat.name} (${selectedCat._id})`);

            const categorySubs = await Category.find({ parentId: selectedCat._id });
            console.log(`Found ${categorySubs.length} subcategories in Category model:`);
            categorySubs.forEach(s => console.log(`  - ${s.name} (${s._id}) [Status: ${s.status}]`));

            const oldSubs = await SubCategory.find({ category: selectedCat._id });
            console.log(`Found ${oldSubs.length} subcategories in SubCategory model:`);
            oldSubs.forEach(s => console.log(`  - ${s.name} (${s._id})`));
        } else {
            console.log(`\nCategory "${selectedCategoryName}" not found!`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

debug();
