# Update Grocery Category Images Script

This script updates the images for the 19 grocery categories by matching category names with image files in the `frontend/assets/category` folder.

## What it does:

1. **Finds the "Grocery" header category** from the database
2. **For each of the 19 categories**:
   - Finds the category by name under the Grocery header category
   - Looks for the corresponding image file in `frontend/assets/category`
   - Updates the category's image if the file exists
   - Skips if the image file is not found
   - Skips if the category is not found in the database
3. **Uploads images to Cloudinary** (if configured) or uses local paths
4. **Logs all operations** for tracking

## Category to Image Mapping:

| Category Name | Image File |
|--------------|------------|
| Vegetables & Fruits | Fruits & Vegetables.png |
| Dairy, Bread & Eggs | Dairy, Bread & Eggs.png |
| Munchies | Snacks & Munchies.png |
| Cold Drinks & Juices | Cold Drinks & Juices.png |
| Breakfast & Instant Food | Breakfast & Instant Food.png |
| Sweet Tooth | Sweet Tooth.png |
| Bakery & Biscuits | Bakery & Biscuits.png |
| Tea, Coffee & More | Tea, Coffe & Health Drink.png |
| Atta, Rice & Dal | Atta, Rice & Dal.png |
| Masala, Oil & More | Masala, Oil & More.png |
| Sauces & Spreads | Sauces & Spreads.png |
| Chicken, Meat & Fish | Chicken, Meat & Fish.png |
| Organic & Healthy Living | Organic & Healthy Living.png |
| Baby Care | Baby Care.png |
| Pharma & Wellness | Pharma & Wellness.png |
| Cleaning Essentials | Cleaning Essentials.png |
| Personal Care | Personal Care.png |
| Home & Office | Home & Office.png |
| Pet Care | Pet Care.png |

## How to run:

### Using npm script:

```bash
cd backend
npm run update:grocery-category-images
```

### Direct execution:

```bash
cd backend
npx tsx src/scripts/updateGroceryCategoryImages.ts
```

## Features:

- ✅ **Safe**: Only updates categories that exist and have matching image files
- ✅ **Cloudinary Support**: Uploads images to Cloudinary if configured
- ✅ **Local Path Fallback**: Uses local paths if Cloudinary is not configured
- ✅ **Logging**: Creates a log file at `backend/update_grocery_category_images.log`
- ✅ **Skip Missing**: Skips categories or images that are not found

## Log File:

The script creates a log file at `backend/update_grocery_category_images.log` with detailed information about:
- Categories found and updated
- Categories skipped (image not found)
- Categories not found in database
- Image upload results

## Example Output:

```
Starting Update Grocery Category Images Script
Connected to MongoDB
Found header category: Grocery (694641169596df826edc3c9a)

--- Processing Category: Vegetables & Fruits ---
Found category: Vegetables & Fruits (507f1f77bcf86cd799439011)
Uploaded to Cloudinary: https://res.cloudinary.com/...
✅ Updated image for "Vegetables & Fruits" -> https://res.cloudinary.com/...

--- Processing Category: Dairy, Bread & Eggs ---
Found category: Dairy, Bread & Eggs (507f1f77bcf86cd799439012)
✅ Updated image for "Dairy, Bread & Eggs" -> /assets/category/Dairy, Bread & Eggs.png

...

✅ Update completed successfully!

Summary:
- Header category: Grocery
- Categories updated: 19
- Categories skipped (image not found): 0
- Categories not found in database: 0

Total categories processed: 19
```

## Notes:

- The script requires the "Grocery" header category to exist in the database
- Categories must be root categories (parentId: null) under the Grocery header category
- Image files must be in `frontend/assets/category/` folder
- If an image file is not found, the category is skipped (not updated)
- If a category is not found in the database, it's skipped
- The script is idempotent - safe to run multiple times

## Image Path Format:

- **Cloudinary**: If Cloudinary is configured, images are uploaded and the Cloudinary URL is stored
- **Local Path**: If Cloudinary is not configured, local paths like `/assets/category/Category Name.png` are stored

