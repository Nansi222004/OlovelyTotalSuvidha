# Grocery & Kitchen Category Seed Script

This script creates a "Grocery & Kitchen" category with 10 subcategories and populates the database.

## What it does:

1. Creates/Updates a "Grocery & Kitchen" category
2. Creates 10 subcategories under this category:

   - Atta, Rice & Dal
   - Masala & Spices
   - Cooking Oil & Ghee
   - Pulses & Lentils
   - Sugar & Sweeteners
   - Salt & Condiments
   - Flour & Baking
   - Dry Fruits & Nuts
   - Kitchenware & Utensils
   - Pickles & Preserves

3. Uses images from the `frontend/public/assets` folder
4. Uploads images to Cloudinary (if configured) or uses local paths

## How to run:

```bash
cd backend
npm run seed:grocery-kitchen
```

Or directly with tsx:

```bash
cd backend
npx tsx src/scripts/seedGroceryKitchen.ts
```

## Requirements:

- MongoDB connection string in `.env` file (`MONGODB_URI`)
- (Optional) Cloudinary credentials in `.env` for image uploads:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`

## After running:

The "Grocery & Kitchen" section on the home page will display the 10 subcategories instead of products. The subcategories will be clickable and navigate to their respective category pages.

## Logs:

The script creates a log file at `backend/seed_grocery_kitchen.log` with detailed information about the seeding process.
