
import mongoose from 'mongoose';
import HomeSection from './src/models/HomeSection';
import SubCategory from './src/models/SubCategory';

import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/dhakadsnazzy";

async function fixSection() {
    try {
        console.log("Connecting to Atlas...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected.");

        // Find subcategories with name "Fresh Vegetables" (exact or close)
        const subName = "Fresh Vegetables";
        const subs = await SubCategory.find({ name: new RegExp(subName, 'i') }).lean();
        console.log(`Found ${subs.length} subcategories matching '${subName}':`);
        subs.forEach(s => console.log(`- ${s.name} (${s._id})`));

        if (subs.length > 0) {
            // Use the first match
            const correctSubId = subs[0]._id;

            // Find the HomeSection
            const section = await HomeSection.findOne({ slug: 'vegetable' });
            if (section) {
                console.log(`Found section '${section.title}' (${section._id})`);
                console.log(`Current subCategories:`, section.subCategories);

                // Update
                section.subCategories = [correctSubId];
                await section.save();
                console.log(`Updated section with subCategory ID: ${correctSubId}`);
            } else {
                console.log("Section 'vegetable' not found.");
            }
        } else {
            console.log("Desired subcategory not found in DB.");
        }

        mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
        mongoose.disconnect();
    }
}

fixSection();
