

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import Category from '../models/Category';
import Product from '../models/Product';
import Seller from '../models/Seller';

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const LOG_FILE = path.join(__dirname, '../../seed_debug.log');
function log(msg: any) {
    const message = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
    console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dhakadsnazzy';
const FRONTEND_ASSETS_PATH = path.join(__dirname, '../../../frontend/public');

log('Starting Seed Script');
log(`MONGO_URI: ${MONGO_URI}`);
log(`FRONTEND_ASSETS_PATH: ${FRONTEND_ASSETS_PATH}`);
log(`CLOUDINARY_CLOUD_NAME: ${process.env.CLOUDINARY_CLOUD_NAME || 'MISSING'}`);

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Data ---
// Extracted from frontend/src/data/categories.ts
const categoriesData = [
    { id: 'fruits-veg', name: 'Fruits & Vegetables', icon: '🥬', image: '/assets/category-fruits-veg.png' },
    { id: 'dairy-breakfast', name: 'Dairy & Breakfast', icon: '🥛', image: '/assets/category-dairy.png' },
    { id: 'snacks', name: 'Snacks & Munchies', icon: '🍿', image: '/assets/category-snacks.png' },
    { id: 'cold-drinks', name: 'Cold Drinks & Juices', icon: '🥤', image: '/assets/category-drinks.png' },
    { id: 'atta-rice', name: 'Atta, Rice & Dal', icon: '🌾', image: '/assets/category-atta-rice.png' },
    { id: 'masala-oil', name: 'Masala & Oil', icon: '🧂', image: '/assets/category-masala.png' },
    { id: 'biscuits-bakery', name: 'Biscuits & Bakery', icon: '🍪', image: '/assets/category-biscuits.png' },
    { id: 'personal-care', name: 'Personal Care', icon: '🧴', image: '/assets/category-personal-care.png' },
    { id: 'cleaning', name: 'Household Essentials', icon: '🧹', image: '/assets/category-cleaning.png' },
    { id: 'breakfast-instant', name: 'Breakfast & Instant Food', icon: '🍜', image: '/assets/category-breakfast.png' },
    { id: 'wedding', name: 'Wedding', icon: '💍', image: '' },
    { id: 'winter', name: 'Winter', icon: '❄️', image: '' },
    { id: 'electronics', name: 'Electronics', icon: '📱', image: '' },
    { id: 'beauty', name: 'Beauty', icon: '💄', image: '' },
    { id: 'fashion', name: 'Fashion', icon: '👕', image: '' },
    { id: 'sports', name: 'Sports', icon: '⚽', image: '' },
    { id: 'dry-fruits', name: 'Dry Fruits & Cereals', icon: '🥜', image: '' },
    { id: 'chicken-meat', name: 'Chicken, Meat & Fish', icon: '🍗', image: '' },
    { id: 'kitchenware', name: 'Kitchenware & Appliances', icon: '🍳', image: '' },
    { id: 'tea-coffee', name: 'Tea, Coffee & Milk Drinks', icon: '☕', image: '' },
    { id: 'sauces-spreads', name: 'Sauces & Spreads', icon: '🍯', image: '' },
    { id: 'paan-corner', name: 'Paan Corner', icon: '🌿', image: '' },
    { id: 'ice-cream', name: 'Ice Creams & More', icon: '🍦', image: '' },
    { id: 'health-pharma', name: 'Health & Pharma', icon: '💊', image: '' },
    { id: 'baby-care', name: 'Baby Care', icon: '👶', image: '' },
    { id: 'oral-care', name: 'Oral Care', icon: '🦷', image: '' },
];

// Extracted from frontend/src/data/products.ts
// Note: We'll map 'id' to 'sku' or generate new ObjectIds.
// We simplify the data structure to match backend Product model.
const productsData = [
    // Snacks & Munchies
    { id: 'lays-magic-masala', name: "Lay's India's Magic Masala", pack: '40 g', price: 20, mrp: 25, imageUrl: '/assets/product-lays-magic-masala.jpg', categoryId: 'snacks', tags: ['bestseller', 'under-99'] },
    { id: 'lays-cream-onion', name: "Lay's American Style Cream & Onion", pack: '52 g', price: 25, mrp: 30, imageUrl: '/assets/product-lays-cream-onion.jpg', categoryId: 'snacks', tags: ['bestseller'] },
    { id: 'kurkure-masti', name: 'Kurkure Solid Masti Masala', pack: '70 g', price: 20, mrp: 25, imageUrl: '/assets/product-kurkure.jpg', categoryId: 'snacks', tags: ['under-99'] },
    { id: 'haldiram-sev', name: "Haldiram's Nagpur Sev", pack: '200 g', price: 65, mrp: 75, imageUrl: '/assets/product-haldiram-sev.jpg', categoryId: 'snacks', tags: ['bestseller'] },
    { id: 'balaji-sev', name: 'Balaji Ratlami Sev', pack: '200 g', price: 55, mrp: 65, imageUrl: '/assets/product-balaji-sev.jpg', categoryId: 'snacks', tags: ['under-99'] },
    { id: 'doritos-cheese', name: 'Doritos Cheese Nachos', pack: 'Pack of 2', price: 99, mrp: 120, imageUrl: '/assets/product-doritos.jpg', categoryId: 'snacks', tags: ['deal-of-the-day'] },
    { id: 'parle-rusk', name: 'Parle Real Elaichi Premium Rusk', pack: '300 g', price: 45, mrp: 50, imageUrl: '/assets/product-parle-rusk.jpg', categoryId: 'snacks', tags: ['under-99'] },
    { id: 'act2-popcorn', name: 'Act II Butter Popcorn', pack: '100 g', price: 35, mrp: 40, imageUrl: '/assets/product-act2-popcorn.jpg', categoryId: 'snacks', tags: ['under-99'] },
    { id: 'maggi-noodles', name: 'Maggi 2-Minute Noodles', pack: '70 g', price: 14, mrp: 16, imageUrl: '/assets/product-mtr-poha.jpg', categoryId: 'snacks', tags: ['bestseller', 'under-99'] },
    { id: 'top-ramen', name: 'Top Ramen Curry Noodles', pack: '70 g', price: 12, mrp: 14, imageUrl: '/assets/product-mtr-poha.jpg', categoryId: 'snacks', tags: ['under-99'] },

    // Dairy & Breakfast
    { id: 'amul-butter', name: 'Amul Salted Butter', pack: '100 g', price: 55, mrp: 60, imageUrl: '/assets/product-amul-butter.jpg', categoryId: 'dairy-breakfast', tags: ['bestseller'] },
    { id: 'britannia-bread', name: 'Britannia Brown Bread', pack: '400 g', price: 42, mrp: 45, imageUrl: '/assets/product-britannia-bread.jpg', categoryId: 'dairy-breakfast', tags: ['bestseller'] },
    { id: 'amul-curd', name: 'Amul Masti Curd', pack: '500 g', price: 45, mrp: 50, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'dairy-breakfast', tags: ['bestseller'] },
    { id: 'mother-dairy-curd', name: 'Mother Dairy Classic Curd', pack: '500 g', price: 48, mrp: 52, imageUrl: '/assets/product-mother-dairy-curd.jpg', categoryId: 'dairy-breakfast', tags: ['bestseller'] },
    { id: 'amul-cheese', name: 'Amul Blend Diced Cheese', pack: '200 g', price: 95, mrp: 110, imageUrl: '/assets/product-amul-cheese.jpg', categoryId: 'dairy-breakfast', tags: ['under-99'] },
    { id: 'eggs-10', name: 'Table White White Eggs', pack: '10 pieces', price: 75, mrp: 80, imageUrl: '/assets/product-eggs.jpg', categoryId: 'dairy-breakfast', tags: ['bestseller'] },
    { id: 'mtr-poha', name: 'MTR 3 Minute Poha', pack: 'Pack of 5', price: 85, mrp: 95, imageUrl: '/assets/product-mtr-poha.jpg', categoryId: 'dairy-breakfast', tags: ['under-99'] },
    { id: 'mtr-upma', name: 'MTR Upma Breakfast Mix', pack: '200 g', price: 65, mrp: 70, imageUrl: '/assets/product-mtr-upma.jpg', categoryId: 'dairy-breakfast', tags: ['under-99'] },
    { id: 'amul-milk', name: 'Amul Taaza Milk', pack: '1 L', price: 66, mrp: 70, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'dairy-breakfast', tags: ['bestseller'] },
    { id: 'amul-paneer', name: 'Amul Paneer', pack: '200 g', price: 85, mrp: 90, imageUrl: '/assets/product-amul-cheese.jpg', categoryId: 'dairy-breakfast', tags: ['bestseller'] },

    // Atta, Rice & Dal
    { id: 'aashirvaad-atta', name: 'Aashirvaad Superior MP Atta', pack: '5 kg', price: 285, mrp: 300, imageUrl: '/assets/product-aashirvaad-atta.jpg', categoryId: 'atta-rice', tags: ['bestseller'] },
    { id: 'fortune-atta', name: 'Fortune Chakki Fresh Atta', pack: '5 kg', price: 275, mrp: 290, imageUrl: '/assets/product-fortune-atta.jpg', categoryId: 'atta-rice', tags: ['bestseller'] },
    { id: 'daawat-rice', name: 'Daawat Pulav Basmati Rice', pack: '1 kg', price: 185, mrp: 200, imageUrl: '/assets/product-daawat-rice.jpg', categoryId: 'atta-rice', tags: ['bestseller'] },
    { id: 'india-gate-rice', name: 'India Gate Kolam Rice', pack: '1 kg', price: 95, mrp: 105, imageUrl: '/assets/product-india-gate-rice.jpg', categoryId: 'atta-rice', tags: ['bestseller'] },
    { id: 'tata-moong', name: 'Tata Sampann Yellow Moong Dal', pack: '500 g', price: 85, mrp: 95, imageUrl: '/assets/product-tata-moong.jpg', categoryId: 'atta-rice', tags: ['under-99'] },
    { id: 'fortune-poha', name: 'Fortune Indori Thick Poha', pack: '500 g', price: 45, mrp: 50, imageUrl: '/assets/product-fortune-poha.jpg', categoryId: 'atta-rice', tags: ['under-99'] },
    { id: 'rajdhani-besan', name: 'Rajdhani Besan', pack: '1 kg', price: 95, mrp: 105, imageUrl: '/assets/product-rajdhani-besan.jpg', categoryId: 'atta-rice', tags: ['under-99'] },
    { id: 'tata-besan', name: 'Tata Sampann Besan', pack: '500 g', price: 65, mrp: 70, imageUrl: '/assets/product-tata-besan.jpg', categoryId: 'atta-rice', tags: ['under-99'] },
    { id: 'toor-dal', name: 'Toor Dal', pack: '1 kg', price: 145, mrp: 160, imageUrl: '/assets/product-tata-moong.jpg', categoryId: 'atta-rice', tags: ['bestseller'] },
    { id: 'chana-dal', name: 'Chana Dal', pack: '1 kg', price: 125, mrp: 140, imageUrl: '/assets/product-tata-moong.jpg', categoryId: 'atta-rice', tags: ['bestseller'] },

    // Cold Drinks & Juices
    { id: 'coke', name: 'Coca-Cola', pack: '750 ml', price: 45, mrp: 50, imageUrl: '/assets/product-lays-cream-onion.jpg', categoryId: 'cold-drinks', tags: ['bestseller'] },
    { id: 'pepsi', name: 'Pepsi', pack: '750 ml', price: 45, mrp: 50, imageUrl: '/assets/product-lays-cream-onion.jpg', categoryId: 'cold-drinks', tags: ['bestseller'] },
    { id: 'tropicana', name: 'Tropicana Orange Juice', pack: '1 L', price: 120, mrp: 135, imageUrl: '/assets/product-lays-cream-onion.jpg', categoryId: 'cold-drinks', tags: ['bestseller'] },
    { id: 'sprite', name: 'Sprite', pack: '750 ml', price: 45, mrp: 50, imageUrl: '/assets/product-lays-cream-onion.jpg', categoryId: 'cold-drinks', tags: ['bestseller'] },
    { id: 'fanta', name: 'Fanta', pack: '750 ml', price: 45, mrp: 50, imageUrl: '/assets/product-lays-cream-onion.jpg', categoryId: 'cold-drinks', tags: ['bestseller'] },
    { id: 'real-juice', name: 'Real Fruit Juice', pack: '1 L', price: 110, mrp: 125, imageUrl: '/assets/product-lays-cream-onion.jpg', categoryId: 'cold-drinks', tags: ['bestseller'] },

    // Masala & Oil
    { id: 'fortune-oil', name: 'Fortune Soya Oil', pack: '1 L', price: 145, mrp: 160, imageUrl: '/assets/product-rajdhani-besan.jpg', categoryId: 'masala-oil', tags: ['bestseller'] },
    { id: 'sunflower-oil', name: 'Sunflower Oil', pack: '1 L', price: 135, mrp: 150, imageUrl: '/assets/product-rajdhani-besan.jpg', categoryId: 'masala-oil', tags: ['bestseller'] },
    { id: 'mustard-oil', name: 'Mustard Oil', pack: '1 L', price: 155, mrp: 170, imageUrl: '/assets/product-rajdhani-besan.jpg', categoryId: 'masala-oil', tags: ['bestseller'] },
    { id: 'mdh-garam-masala', name: 'MDH Garam Masala', pack: '100 g', price: 45, mrp: 50, imageUrl: '/assets/product-rajdhani-besan.jpg', categoryId: 'masala-oil', tags: ['under-99'] },
    { id: 'everest-chicken-masala', name: 'Everest Chicken Masala', pack: '100 g', price: 55, mrp: 60, imageUrl: '/assets/product-rajdhani-besan.jpg', categoryId: 'masala-oil', tags: ['under-99'] },
    { id: 'tata-salt', name: 'Tata Salt', pack: '1 kg', price: 25, mrp: 28, imageUrl: '/assets/product-rajdhani-besan.jpg', categoryId: 'masala-oil', tags: ['under-99'] },

    // Household Essentials (Cleaning)
    { id: 'surf-excel', name: 'Surf Excel Detergent', pack: '1 kg', price: 185, mrp: 200, imageUrl: '/assets/product-haldiram-sev.jpg', categoryId: 'cleaning', tags: ['bestseller'] },
    { id: 'ariel-detergent', name: 'Ariel Detergent Powder', pack: '1 kg', price: 195, mrp: 210, imageUrl: '/assets/product-haldiram-sev.jpg', categoryId: 'cleaning', tags: ['bestseller'] },
    { id: 'vim-dishwash', name: 'Vim Dishwash Gel', pack: '750 ml', price: 95, mrp: 110, imageUrl: '/assets/product-haldiram-sev.jpg', categoryId: 'cleaning', tags: ['under-99'] },
    { id: 'harpic-toilet-cleaner', name: 'Harpic Toilet Cleaner', pack: '1 L', price: 85, mrp: 95, imageUrl: '/assets/product-haldiram-sev.jpg', categoryId: 'cleaning', tags: ['under-99'] },
    { id: 'lizol-floor-cleaner', name: 'Lizol Floor Cleaner', pack: '1 L', price: 125, mrp: 140, imageUrl: '/assets/product-haldiram-sev.jpg', categoryId: 'cleaning', tags: ['bestseller'] },
    { id: 'colin-glass-cleaner', name: 'Colin Glass Cleaner', pack: '500 ml', price: 75, mrp: 85, imageUrl: '/assets/product-haldiram-sev.jpg', categoryId: 'cleaning', tags: ['under-99'] },

    // Biscuits & Bakery
    { id: 'britannia-biscuits', name: 'Britannia Good Day Cookies', pack: '200 g', price: 35, mrp: 40, imageUrl: '/assets/product-parle-rusk.jpg', categoryId: 'biscuits-bakery', tags: ['under-99'] },
    { id: 'parle-g-biscuits', name: 'Parle-G Glucose Biscuits', pack: '200 g', price: 25, mrp: 28, imageUrl: '/assets/product-parle-rusk.jpg', categoryId: 'biscuits-bakery', tags: ['bestseller', 'under-99'] },
    { id: 'oreo-biscuits', name: 'Oreo Chocolate Biscuits', pack: '150 g', price: 45, mrp: 50, imageUrl: '/assets/product-parle-rusk.jpg', categoryId: 'biscuits-bakery', tags: ['bestseller'] },
    { id: 'sunfeast-biscuits', name: 'Sunfeast Dark Fantasy', pack: '150 g', price: 40, mrp: 45, imageUrl: '/assets/product-parle-rusk.jpg', categoryId: 'biscuits-bakery', tags: ['under-99'] },
    { id: 'hide-seek-biscuits', name: 'Hide & Seek Biscuits', pack: '150 g', price: 35, mrp: 40, imageUrl: '/assets/product-parle-rusk.jpg', categoryId: 'biscuits-bakery', tags: ['under-99'] },
    { id: 'monaco-biscuits', name: 'Monaco Salted Biscuits', pack: '200 g', price: 30, mrp: 35, imageUrl: '/assets/product-parle-rusk.jpg', categoryId: 'biscuits-bakery', tags: ['under-99'] },

    // Fruits & Vegetables
    { id: 'tomatoes', name: 'Fresh Tomatoes', pack: '1 kg', price: 40, mrp: 45, imageUrl: '/assets/product-amul-butter.jpg', categoryId: 'fruits-veg', tags: ['bestseller'] },
    { id: 'onions', name: 'Fresh Onions', pack: '1 kg', price: 35, mrp: 40, imageUrl: '/assets/product-amul-butter.jpg', categoryId: 'fruits-veg', tags: ['bestseller'] },
    { id: 'potatoes', name: 'Fresh Potatoes', pack: '1 kg', price: 30, mrp: 35, imageUrl: '/assets/product-amul-butter.jpg', categoryId: 'fruits-veg', tags: ['bestseller'] },
    { id: 'bananas', name: 'Fresh Bananas', pack: '1 dozen', price: 45, mrp: 50, imageUrl: '/assets/product-amul-butter.jpg', categoryId: 'fruits-veg', tags: ['bestseller'] },
    { id: 'apples', name: 'Fresh Apples', pack: '1 kg', price: 120, mrp: 140, imageUrl: '/assets/product-amul-butter.jpg', categoryId: 'fruits-veg', tags: ['bestseller'] },
    { id: 'carrots', name: 'Fresh Carrots', pack: '500 g', price: 25, mrp: 30, imageUrl: '/assets/product-amul-butter.jpg', categoryId: 'fruits-veg', tags: ['under-99'] },
    { id: 'cucumber', name: 'Fresh Cucumber', pack: '500 g', price: 20, mrp: 25, imageUrl: '/assets/product-amul-butter.jpg', categoryId: 'fruits-veg', tags: ['under-99'] },
    { id: 'lemons', name: 'Fresh Lemons', pack: '250 g', price: 15, mrp: 18, imageUrl: '/assets/product-amul-butter.jpg', categoryId: 'fruits-veg', tags: ['under-99'] },

    // Personal Care
    { id: 'colgate-toothpaste', name: 'Colgate Toothpaste', pack: '200 g', price: 95, mrp: 110, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'personal-care', tags: ['bestseller'] },
    { id: 'pepsodent-toothpaste', name: 'Pepsodent Toothpaste', pack: '200 g', price: 85, mrp: 100, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'personal-care', tags: ['under-99'] },
    { id: 'dove-soap', name: 'Dove Soap', pack: '125 g', price: 45, mrp: 50, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'personal-care', tags: ['under-99'] },
    { id: 'lux-soap', name: 'Lux Soap', pack: '125 g', price: 35, mrp: 40, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'personal-care', tags: ['under-99'] },
    { id: 'head-shoulders-shampoo', name: 'Head & Shoulders Shampoo', pack: '180 ml', price: 145, mrp: 165, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'personal-care', tags: ['bestseller'] },
    { id: 'pantene-shampoo', name: 'Pantene Shampoo', pack: '180 ml', price: 135, mrp: 150, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'personal-care', tags: ['bestseller'] },
    { id: 'gillette-razor', name: 'Gillette Razor', pack: '1 piece', price: 75, mrp: 85, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'personal-care', tags: ['under-99'] },
    { id: 'old-spice-deo', name: 'Old Spice Deodorant', pack: '150 ml', price: 125, mrp: 145, imageUrl: '/assets/product-amul-curd.jpg', categoryId: 'personal-care', tags: ['bestseller'] },

    // Breakfast & Instant Food
    { id: 'kelloggs-cornflakes', name: 'Kelloggs Cornflakes', pack: '500 g', price: 185, mrp: 210, imageUrl: '/assets/product-mtr-poha.jpg', categoryId: 'breakfast-instant', tags: ['bestseller'] },
    { id: 'quaker-oats', name: 'Quaker Oats', pack: '500 g', price: 95, mrp: 110, imageUrl: '/assets/product-mtr-poha.jpg', categoryId: 'breakfast-instant', tags: ['under-99'] },
    { id: 'kelloggs-chocos', name: 'Kelloggs Chocos', pack: '500 g', price: 195, mrp: 220, imageUrl: '/assets/product-mtr-poha.jpg', categoryId: 'breakfast-instant', tags: ['bestseller'] },
    { id: 'yippee-noodles', name: 'Yippee Noodles', pack: 'Pack of 5', price: 65, mrp: 75, imageUrl: '/assets/product-mtr-poha.jpg', categoryId: 'breakfast-instant', tags: ['under-99'] },
    { id: 'knorr-soup', name: 'Knorr Soup Mix', pack: '65 g', price: 45, mrp: 50, imageUrl: '/assets/product-mtr-poha.jpg', categoryId: 'breakfast-instant', tags: ['under-99'] },
    { id: 'sunfeast-pasta', name: 'Sunfeast Pasta', pack: '200 g', price: 35, mrp: 40, imageUrl: '/assets/product-mtr-poha.jpg', categoryId: 'breakfast-instant', tags: ['under-99'] },

    // Wedding Category
    { id: 'wedding-sweets-box', name: 'Premium Wedding Sweets Box', pack: '500 g', price: 299, mrp: 350, imageUrl: '/assets/product-haldiram-sev.jpg', categoryId: 'wedding', tags: ['deal-of-the-day'] },
    { id: 'wedding-dry-fruits', name: 'Assorted Dry Fruits Gift Pack', pack: '1 kg', price: 899, mrp: 1200, imageUrl: '/assets/product-haldiram-sev.jpg', categoryId: 'wedding', tags: ['bestseller'] }
];

// --- Helpers ---

// Helper to upload to Cloudinary
async function uploadToCloudinary(localPath: string, folder: string = 'products'): Promise<string | null> {
    try {
        if (!localPath) return null;

        // Remove leading slash if present
        const cleanPath = localPath.startsWith('/') ? localPath.slice(1) : localPath;
        const fullPath = path.join(FRONTEND_ASSETS_PATH, cleanPath);

        if (!fs.existsSync(fullPath)) {
            console.warn(`File not found: ${fullPath}`);
            return null;
        }

        const result = await cloudinary.uploader.upload(fullPath, {
            folder: `dhakadsnazzy/${folder}`,
            use_filename: true,
            unique_filename: false,
        });

        console.log(`Uploaded ${cleanPath} -> ${result.secure_url}`);
        return result.secure_url;
    } catch (error) {
        log(`Upload failed for ${localPath}: ${error}`);
        return null;
    }
}

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Create or Find Admin Seller
        let seller = await Seller.findOne({ email: 'retail@Dhakad Snazzy.com' });
        if (!seller) {
            console.log('Creating default seller...');
            seller = await Seller.create({
                sellerName: 'Dhakad Snazzy Retail',
                email: 'retail@Dhakad Snazzy.com',
                password: 'password123',
                mobile: '9876543210',
                storeName: 'Dhakad Snazzy Retail Pvt Ltd',
                category: 'Grocery',
                commission: 0,
                isActive: true, // properties not in schema will be ignored or strict mode will complain if 'strict'
                status: 'Approved',
                isVerified: true
            });
        }
        console.log(`Using seller: ${seller.sellerName}`);

        // 2. Seed Categories
        console.log('Seeding Categories...');
        const categoryMap = new Map();

        for (const catData of categoriesData) {
            let imageUrl = catData.image;
            if (imageUrl) {
                const uploadedUrl = await uploadToCloudinary(imageUrl, 'categories');
                if (uploadedUrl) imageUrl = uploadedUrl;
            }

            const category = await Category.findOneAndUpdate(
                { slug: catData.id }, // Use id as slug
                {
                    name: catData.name,
                    slug: catData.id,
                    image: imageUrl,
                    hasWarning: false,
                    isBestseller: false,
                    order: 0
                },
                { upsert: true, new: true }
            );
            categoryMap.set(catData.id, category._id);
            console.log(`Processed category: ${catData.name}`);
        }

        // 3. Seed Products
        console.log('Seeding Products...');
        for (const prodData of productsData) {
            const categoryId = categoryMap.get(prodData.categoryId);
            if (!categoryId) {
                console.warn(`Category not found for product: ${prodData.name} (${prodData.categoryId})`);
                continue;
            }

            let imageUrl = prodData.imageUrl;
            if (imageUrl) {
                const uploadedUrl = await uploadToCloudinary(imageUrl, 'products');
                if (uploadedUrl) imageUrl = uploadedUrl;
            }

            await Product.findOneAndUpdate(
                { productName: prodData.name }, // Use name as unique identifier for seeding
                {
                    productName: prodData.name,
                    smallDescription: prodData.pack,
                    description: `${prodData.name} - ${prodData.pack}`,
                    category: categoryId,
                    seller: seller._id,
                    mainImage: imageUrl,
                    galleryImages: imageUrl ? [imageUrl] : [],
                    price: prodData.price,
                    compareAtPrice: prodData.mrp,
                    stock: 100, // Default stock
                    sku: prodData.id,
                    publish: true,
                    status: 'Active',
                    popular: prodData.tags.includes('bestseller'),
                    dealOfDay: prodData.tags.includes('deal-of-the-day'),
                    tags: prodData.tags,
                    requiresApproval: false,
                    isReturnable: false
                },
                { upsert: true }
            );
            console.log(`Processed product: ${prodData.name}`);
        }

        console.log('Seeding completed successfully!');
        process.exit(0);

    } catch (error) {
        log(`Seeding failed: ${error}`);
        process.exit(1);
    }
}

seed();

