# Personal Care Category Seed Script

This script creates a "Personal Care" category with 10 subcategories and populates the database.

## What it does:

1. Creates/Updates a "Personal Care" category
2. Creates 10 subcategories under this category:

   - Hair Care
   - Skin Care
   - Oral Care
   - Body Care
   - Men's Grooming
   - Women's Care
   - Baby Care
   - Deodorants & Fragrances
   - Health & Wellness
   - Beauty Accessories

3. Uses images from the `frontend/public/assets` folder
4. Uploads images to Cloudinary (if configured) or uses local paths

## How to run:

```bash
cd backend
npm run seed:personal-care
```

Or directly with tsx:

```bash
cd backend
npx tsx src/scripts/seedPersonalCare.ts
```

## Requirements:

- MongoDB connection string in `.env` file (`MONGODB_URI`)
- (Optional) Cloudinary credentials in `.env` for image uploads:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`

## After running:

The "Personal Care" section on the home page will display the 10 subcategories instead of products. The subcategories will be clickable and navigate to their respective category pages.

## Logs:

The script creates a log file at `backend/seed_personal_care.log` with detailed information about the seeding process.
