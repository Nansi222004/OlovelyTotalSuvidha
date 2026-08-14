# Remove Grocery Categories Script

This script removes all categories, subcategories, and items that were created under the "Grocery" header category by the `seedGroceryCategories.ts` script.

## ⚠️ WARNING

**This script will permanently delete all grocery categories, subcategories, and items!** This action cannot be undone. Make sure you have a database backup before running this script.

## What it does:

1. **Finds the "Grocery" header category** from the database
2. **For each main category** from the seed data:
   - Finds the category by name under the Grocery header
   - Recursively deletes the category and all its descendants (subcategories and items)
3. **Cleans up any remaining categories** under Grocery that might have been created but not in the seed data (from partial runs)
4. **Verifies deletion** and reports the results

## Categories Removed:

The script removes all 19 main categories and their subcategories/items:

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

## How to run:

### Using npm script:

```bash
cd backend
npm run remove:grocery-categories
```

### Direct execution:

```bash
cd backend
npx tsx src/scripts/removeGroceryCategories.ts
```

## Features:

- ✅ **Recursive Deletion**: Automatically deletes children before parents
- ✅ **Safe**: Only deletes categories under the "Grocery" header category
- ✅ **Complete Cleanup**: Removes all categories, subcategories, and items
- ✅ **Logging**: Creates a log file at `backend/remove_grocery_categories.log`
- ✅ **Verification**: Reports how many items were deleted and what remains

## Log File:

The script creates a log file at `backend/remove_grocery_categories.log` with detailed information about:
- Categories found and deleted
- Total items deleted
- Categories not found (skipped)
- Remaining categories (if any)

## Example Output:

```
Starting Remove Grocery Categories Script
Connected to MongoDB
Found header category: Grocery (694641169596df826edc3c9a)

--- Processing Category: Vegetables & Fruits ---
Found category: Vegetables & Fruits (507f1f77bcf86cd799439011)
Deleted 10 items (category + subcategories + items) for "Vegetables & Fruits"

--- Processing Category: Dairy, Bread & Eggs ---
Found category: Dairy, Bread & Eggs (507f1f77bcf86cd799439012)
Deleted 9 items (category + subcategories + items) for "Dairy, Bread & Eggs"

...

✅ Deletion completed successfully!

Summary:
- Header category: Grocery
- Total items deleted: 226
- Categories not found (skipped): 0
- Remaining categories under Grocery: 0

✅ All grocery categories have been successfully removed!
```

## Notes:

- The script requires the "Grocery" header category to exist in the database
- It only deletes categories that match the names from the seed script
- Any categories under Grocery that don't match the seed data will also be cleaned up
- The script deletes recursively (children first, then parents) to avoid foreign key issues
- **Make sure to backup your database before running this script!**

## After running:

All grocery categories, subcategories, and items will be removed. You can then:

1. Fix any issues in the seed script
2. Run the seed script again: `npm run seed:grocery-categories`
3. Or manually add categories through the admin panel

