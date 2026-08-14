# Remove All Categories Script

This script removes **ALL** categories and subcategories from the database.

## ⚠️ WARNING

**This script will permanently delete all categories and subcategories!** This action cannot be undone. Make sure you have a database backup before running this script.

## What it does:

1. **Counts existing categories and subcategories** before deletion
2. **Deletes all SubCategory documents** (old model, if any exist)
3. **Deletes all Category documents** (includes both root categories and subcategories)
4. **Verifies deletion** and reports the results

## How to run:

### Using npm script:

```bash
cd backend
npm run remove:all-categories
```

### Direct execution:

```bash
cd backend
npx tsx src/scripts/removeAllCategories.ts
```

## Requirements:

- MongoDB connection string in `.env` file (`MONGODB_URI`)

## Logs:

The script creates a log file at `backend/remove_all_categories.log` with detailed information about:

- How many categories and subcategories were found
- How many were deleted
- Verification results

## Notes:

- This script deletes **ALL** categories and subcategories without any confirmation prompt
- It handles both the old `SubCategory` model and the new `Category` model (where subcategories are stored as Category with `parentId`)
- After running this script, you can use the seed script to add categories again
- **Make sure to backup your database before running this script!**

## After running:

All categories and subcategories will be removed. You can then:

1. Run the seed script to add new categories: `npm run seed:categories-under-headers`
2. Or manually add categories through the admin panel

