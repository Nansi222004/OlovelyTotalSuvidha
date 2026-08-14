
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HomeSection from './src/models/HomeSection';
import SubCategory from './src/models/SubCategory';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/appzeto-snazzy";

async function debugSection() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected");

        const section = await HomeSection.findOne({ slug: 'vegetable' }).lean();
        if (!section) { console.log("Section not found"); return; }

        console.log("Section found:", section.title);
        console.log("DisplayType:", section.displayType);

        console.log("SubCategories in Section:", section.subCategories);

        if (section.subCategories && section.subCategories.length > 0) {
            const count = await SubCategory.countDocuments({ _id: { $in: section.subCategories } });
            console.log("Matching SubCategories in DB:", count);

            const subs = await SubCategory.find({ _id: { $in: section.subCategories } }).lean();
            console.log("SubNames:", subs.map(s => s.name));
        } else {
            console.log("No subCategories IDs in section");
        }

        mongoose.disconnect();
    } catch (error) {
        console.error(error);
        mongoose.disconnect();
    }
}

debugSection();
