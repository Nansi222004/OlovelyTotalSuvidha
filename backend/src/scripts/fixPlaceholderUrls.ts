import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhakadsnazzy";

// Old broken placeholder patterns to find
const OLD_PLACEHOLDER_PATTERNS = [
    /^https?:\/\/via\.placeholder\.com\//i,
    /^300x300\?text=/i, // Broken URL without domain
    /^https?:\/\/placeholder\.com\//i,
];

// New reliable placeholder URL
const NEW_PLACEHOLDER = "https://placehold.co/300x300/f5f5f5/737373?text=Image";

function isOldPlaceholder(url: string): boolean {
    if (!url) return false;
    return OLD_PLACEHOLDER_PATTERNS.some(pattern => pattern.test(url));
}

async function fixPlaceholderUrls() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        if (!db) {
            console.error("Database connection not established");
            process.exit(1);
        }

        // Collections to check for image fields
        const collectionsToFix = [
            { name: "categories", fields: ["image"] },
            { name: "subcategories", fields: ["subcategoryImage", "image"] },
            { name: "products", fields: ["mainImage", "galleryImages"] },
            { name: "shops", fields: ["image"] },
            { name: "headercategories", fields: ["image", "icon"] },
            { name: "brands", fields: ["logo", "image"] },
            { name: "sellers", fields: ["logo", "storeBanner"] },
        ];

        let totalFixed = 0;

        for (const collection of collectionsToFix) {
            console.log(`\nProcessing collection: ${collection.name}`);

            const coll = db.collection(collection.name);
            const documents = await coll.find({}).toArray();

            let fixedInCollection = 0;

            for (const doc of documents) {
                const updates: Record<string, any> = {};

                for (const field of collection.fields) {
                    const value = doc[field];

                    if (typeof value === "string" && isOldPlaceholder(value)) {
                        updates[field] = NEW_PLACEHOLDER;
                        console.log(`  Found broken URL in ${doc._id}.${field}: ${value.substring(0, 50)}...`);
                    } else if (Array.isArray(value)) {
                        // Handle array fields like galleryImages
                        const newArray = value.map((item: any) => {
                            if (typeof item === "string" && isOldPlaceholder(item)) {
                                console.log(`  Found broken URL in ${doc._id}.${field}[]: ${item.substring(0, 50)}...`);
                                return NEW_PLACEHOLDER;
                            }
                            return item;
                        });

                        if (JSON.stringify(newArray) !== JSON.stringify(value)) {
                            updates[field] = newArray;
                        }
                    }
                }

                if (Object.keys(updates).length > 0) {
                    await coll.updateOne({ _id: doc._id }, { $set: updates });
                    fixedInCollection++;
                    totalFixed++;
                }
            }

            console.log(`  Fixed ${fixedInCollection} documents in ${collection.name}`);
        }

        console.log(`\n✅ Migration completed! Fixed ${totalFixed} documents total.`);
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Migration failed:", error.message);
        process.exit(1);
    }
}

fixPlaceholderUrls();

