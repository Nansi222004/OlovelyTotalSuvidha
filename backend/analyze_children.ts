
import mongoose from 'mongoose';
import Category from './src/models/Category';

import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/dhakadsnazzy";

async function analyze() {
    try {
        console.log("Connecting...");
        await mongoose.connect(MONGODB_URI);

        const parentName = "Vegetables & Fruits";
        const parent = await Category.findOne({ name: new RegExp(parentName, 'i') }).lean();

        if (parent) {
            console.log(`Parent Category Found: ${parent.name} (${parent._id})`);

            // Check for child categories (self-referencing)
            const children = await Category.find({ parentId: parent._id }).lean();
            console.log(`Found ${children.length} child Categories (via parentId):`);
            children.forEach(c => console.log(`- ${c.name} (${c._id})`));

            if (children.length === 0) {
                console.log("No children found in Category collection.");
            }
        } else {
            console.log("Parent category not found.");
        }

        mongoose.disconnect();
    } catch (error) {
        console.error(error);
        mongoose.disconnect();
    }
}

analyze();
