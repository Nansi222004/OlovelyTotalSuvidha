# Update Categories with Actual Names Script

This script updates all sample/placeholder category and subcategory names with actual meaningful names.

## What it does:

1. **Fetches all Published header categories** from the database
2. **For each header category:**

   - Finds existing categories with pattern `{HeaderCategoryName} Category {1-4}`
   - Updates them with actual category names (e.g., "Bridal Wear", "Groom Wear", etc.)
   - Updates the slug to match the new name

3. **For each category:**
   - Finds existing subcategories with pattern `{CategoryName} Subcategory {1-4}`
   - Updates them with actual subcategory names
   - Updates the slug to match the new name

## Category Mappings:

The script includes mappings for:

- **Wedding**: Bridal Wear, Groom Wear, Wedding Decor, Wedding Gifts
- **Winter**: Winter Clothing, Home Heating, Winter Care, Hot Beverages
- **Electronics**: Mobile & Accessories, Audio Devices, Computer & Laptop, Smart Devices
- **Beauty**: Makeup, Skincare, Hair Care, Personal Grooming
- **Grocery**: Staples & Grains, Cooking Essentials, Snacks & Beverages, Dairy & Breakfast
- **Fashion**: Women's Clothing, Men's Clothing, Footwear, Accessories
- **Sports**: Sports Equipment, Activewear, Fitness & Gym, Outdoor Sports

Each category has 4 relevant subcategories.

## How to run:

### Using npm script:

```bash
cd backend
npm run update:category-names
```

### Direct execution:

```bash
cd backend
npx tsx src/scripts/updateCategoriesWithActualNames.ts
```

## Requirements:

- MongoDB connection string in `.env` file (`MONGODB_URI`)
- Categories and subcategories must already exist (created by the seed script)
- Header categories must be Published

## Logs:

The script creates a log file at `backend/update_categories_actual_names.log` with detailed information about:

- Which categories were updated
- Which subcategories were updated
- Any errors or warnings
- Summary statistics

## Notes:

- The script only updates categories that match the pattern `{HeaderCategoryName} Category {1-4}`
- It skips categories if a category with the new name already exists (prevents duplicates)
- Slugs are automatically generated from the new names
- The script is safe to run multiple times (idempotent)
- Only updates Published header categories

## Example:

Before:

- Winter Category 1
  - Winter Category 1 Subcategory 1
  - Winter Category 1 Subcategory 2
  - etc.

After:

- Winter Clothing
  - Sweaters & Cardigans
  - Jackets & Coats
  - etc.

## After running:

All categories and subcategories will have meaningful names that are:

- Visible on the admin category page
- Usable by sellers when adding products
- Displayed correctly on the user app

