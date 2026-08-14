# Seed Categories Under Header Categories Script

This script automatically creates categories and subcategories under every Published header category in the database.

## What it does:

1. **Fetches all Published header categories** from the database
2. **For each header category:**

   - Creates 4 root categories with names like:
     - `{HeaderCategoryName} Category 1`
     - `{HeaderCategoryName} Category 2`
     - `{HeaderCategoryName} Category 3`
     - `{HeaderCategoryName} Category 4`
   - Each category is assigned to the header category via `headerCategoryId`
   - Each category has `parentId: null` (root category)
   - Status: `Active`
   - Order: 0, 1, 2, 3 (auto-incremented)

3. **For each created category:**

   - Creates 4 subcategories with names like:
     - `{CategoryName} Subcategory 1`
     - `{CategoryName} Subcategory 2`
     - `{CategoryName} Subcategory 3`
     - `{CategoryName} Subcategory 4`
   - Each subcategory has `parentId` set to the category's `_id`
   - Each subcategory inherits `headerCategoryId` from the parent category
   - Status: `Active`
   - Order: 0, 1, 2, 3 (auto-incremented)

4. **Uses placeholder images** for all categories and subcategories
5. **Skips if categories already exist** for a header category (prevents duplicates)

## Example Output:

For a header category named "Wedding":

- Wedding Category 1
  - Wedding Category 1 Subcategory 1
  - Wedding Category 1 Subcategory 2
  - Wedding Category 1 Subcategory 3
  - Wedding Category 1 Subcategory 4
- Wedding Category 2
  - Wedding Category 2 Subcategory 1
  - Wedding Category 2 Subcategory 2
  - Wedding Category 2 Subcategory 3
  - Wedding Category 2 Subcategory 4
- Wedding Category 3
  - (4 subcategories)
- Wedding Category 4
  - (4 subcategories)

## How to run:

### Using npm script:

```bash
cd backend
npm run seed:categories-under-headers
```

### Direct execution:

```bash
cd backend
npx tsx src/scripts/seedCategoriesUnderHeaderCategories.ts
```

## Requirements:

- MongoDB connection string in `.env` file (`MONGODB_URI`)
- At least one Published header category must exist in the database
- (Optional) Cloudinary credentials in `.env` for image uploads:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`

## Logs:

The script creates a log file at `backend/seed_categories_under_header_categories.log` with detailed information about:

- Which header categories were processed
- Which categories and subcategories were created
- Any errors or warnings
- Summary statistics

## Notes:

- The script will **skip** header categories that already have categories assigned
- If a category or subcategory with the same name already exists, it will be skipped
- Placeholder images are used if no default category image is found
- All created categories and subcategories have status set to "Active"
- The script is idempotent - safe to run multiple times

## After running:

The categories will appear in:

- **Admin category management page** (`http://localhost:5173/admin/category`) - All categories and subcategories will be visible and editable
- Home page promo cards (if they have `headerCategoryId` assigned)
- Category navigation menus

## Admin Page Visibility:

The script creates categories with all required fields:

- `name`: Category name
- `slug`: Auto-generated unique slug
- `image`: Placeholder image
- `status`: "Active" (so they appear in the admin page)
- `parentId`: null for root categories, category.\_id for subcategories
- `headerCategoryId`: Links to the header category
- `order`: 0, 1, 2, 3 (for proper sorting)

All categories will be visible on the admin category page at `http://localhost:5173/admin/category` where admins can:

- View all categories in tree or list view
- Edit category details
- Add more subcategories
- Delete categories
- Toggle category status
- Category navigation menus

