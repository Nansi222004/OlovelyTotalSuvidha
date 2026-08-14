# Seed Grocery Categories Script

This script automatically creates categories and subcategories under the "Grocery" header category in the database.

## What it does:

1. **Finds the "Grocery" header category** from the database
2. **For each main category** (e.g., "Vegetables & Fruits", "Dairy, Bread & Eggs"):
   - Creates the main category if it doesn't exist
   - Skips if it already exists
3. **For each subcategory** under a main category (e.g., "Fresh Vegetables", "Fresh Fruits"):
   - Creates the subcategory if it doesn't exist
   - Skips if it already exists
4. **Uses the same image** (`Breakfast & Instant Food.png`) for all categories and subcategories (you can edit them later)

## Categories Created:

The script creates 19 main categories with their subcategories:

1. Vegetables & Fruits
2. Dairy, Bread & Eggs
3. Munchies
4. Cold Drinks & Juices
5. Breakfast & Instant Food
6. Sweet Tooth
7. Bakery & Biscuits
8. Tea, Coffee & More
9. Atta, Rice & Dal
10. Masala, Oil & More
11. Sauces & Spreads
12. Chicken, Meat & Fish
13. Organic & Healthy Living
14. Baby Care
15. Pharma & Wellness
16. Cleaning Essentials
17. Personal Care
18. Home & Office
19. Pet Care

## Image Configuration:

- **Default Image**: Uses `frontend/assets/category/Breakfast & Instant Food.png` for all categories and subcategories
- **Cloudinary**: If Cloudinary is configured, images will be uploaded to Cloudinary
- **Local Path**: If Cloudinary is not configured, uses the local path `/assets/category/Breakfast & Instant Food.png`

## How to run:

### Using npm script:

```bash
cd backend
npm run seed:grocery-categories
```

### Direct execution:

```bash
cd backend
npx tsx src/scripts/seedGroceryCategories.ts
```

## Features:

- ✅ **Idempotent**: Can be run multiple times safely - skips existing categories/subcategories
- ✅ **Hierarchical Structure**: Creates 2-level hierarchy (Category → Subcategory)
- ✅ **Automatic Slug Generation**: Generates URL-friendly slugs from category names
- ✅ **Order Management**: Automatically assigns order numbers based on position
- ✅ **Logging**: Creates a log file at `backend/seed_grocery_categories.log`

## Log File:

The script creates a log file at `backend/seed_grocery_categories.log` with detailed information about:
- Categories created
- Subcategories created
- Items skipped (already exist)
- Any errors encountered

## Example Output:

```
Starting Grocery Categories Seed Script
Connected to MongoDB
Found header category: Grocery (507f1f77bcf86cd799439011)

--- Processing Category: Vegetables & Fruits ---
Created category: Vegetables & Fruits (slug: vegetables-and-fruits)
  Processing subcategory: Fresh Vegetables
  Created subcategory: Fresh Vegetables (slug: vegetables-and-fruits-fresh-vegetables)
  Processing subcategory: Fresh Fruits
  Created subcategory: Fresh Fruits (slug: vegetables-and-fruits-fresh-fruits)
  ...

✅ Seeding completed successfully!

Summary:
- Header category: Grocery
- Main categories created: 19
- Subcategories created: 57
- Items skipped (already exist): 0

Total items created: 76
```

## Notes:

- The script requires the "Grocery" header category to exist in the database
- All categories and subcategories are created with status "Active"
- The image path can be updated later through the admin panel
- The script handles special characters in names (e.g., "&" becomes "and" in slugs)
- Subcategory slugs include the parent category slug to ensure uniqueness (e.g., `vegetables-and-fruits-fresh-vegetables`)

