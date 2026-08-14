# Seed Grocery Staples Products Script

This script creates 20 products (5 per subcategory) under the Grocery header category's "Staples & Grains" category for a specific seller.

## What it does:

1. **Authenticates seller** using phone number and OTP

   - Phone: 7999267233
   - OTP: Taken at runtime (prompted in terminal)

2. **Finds categories:**

   - Grocery header category
   - Staples & Grains category (under Grocery)
   - All 4 subcategories: Rice & Rice Products, Wheat & Atta, Pulses & Dals, Cereals & Muesli

3. **Creates 5 products per subcategory** (20 products total):

   - **Rice & Rice Products**: 5 rice products
   - **Wheat & Atta**: 5 atta/flour products
   - **Pulses & Dals**: 5 dal products
   - **Cereals & Muesli**: 5 cereal/muesli products

4. **Uploads product images:**
   - Searches for images in `frontend/assets/product/` directory
   - Uploads to Cloudinary if configured
   - Uses placeholder images if no image found

## Product Details:

Each product includes:

- Realistic product names
- Random prices (₹50 - ₹500)
- Random discounts (5-25%)
- Random stock (20-100 units)
- Product pack size (e.g., "1 kg", "500 g")
- One variation (Standard pack size)
- Tags: grocery, staples, grains, subcategory name, premium
- Status: Active, Published
- Returnable: Yes (7 days)
- Product images from assets folder (if available)

## How to run:

### Using npm script:

```bash
cd backend
npm run seed:grocery-staples-products
```

### Direct execution:

```bash
cd backend
npx tsx src/scripts/seedGroceryStaplesProducts.ts
```

## Requirements:

- MongoDB connection string in `.env` file (`MONGODB_URI`)
- Seller must exist with mobile number: **7999267233**
- Grocery header category must exist and be Published
- Staples & Grains category must exist under Grocery
- All 4 subcategories must exist under Staples & Grains:
  - Rice & Rice Products
  - Wheat & Atta
  - Pulses & Dals
  - Cereals & Muesli
- Cloudinary credentials (optional, for image uploads)

## OTP Process:

1. Script sends OTP to seller's phone (7999267233)
2. If in mock mode, OTP is displayed in console
3. Otherwise, OTP is sent via SMS
4. Script prompts you to enter OTP
5. OTP is verified before proceeding

## Image Handling:

The script attempts to find product images in:

- `frontend/assets/product/Atta, Rice & Dal/...`
- `frontend/assets/product/Breakast & Instant Food/...`

If images are found, they are uploaded to Cloudinary. If not found, placeholder images are used.

## Logs:

The script creates a log file at `backend/seed_grocery_staples_products.log` with detailed information about:

- Seller authentication
- Categories found
- Products created
- Image uploads
- Any errors or warnings
- Summary statistics

## Notes:

- The script skips products that already exist (prevents duplicates)
- Products are created with realistic names and pricing
- All products are set to Active and Published status
- Products are assigned to the seller with mobile: 7999267233
- The script is idempotent - safe to run multiple times
- Different images are used for each product when available

## Product Names Created:

### Rice & Rice Products:

1. Basmati Rice Premium (1 kg)
2. Sona Masoori Rice (1 kg)
3. Brown Rice Organic (500 g)
4. Jasmine Rice Fragrant (1 kg)
5. Steamed Rice Parboiled (1 kg)

### Wheat & Atta:

1. Whole Wheat Atta Premium (5 kg)
2. Multigrain Atta (5 kg)
3. Chakki Fresh Atta (10 kg)
4. Organic Wheat Flour (5 kg)
5. Aashirvaad Whole Wheat Atta (5 kg)

### Pulses & Dals:

1. Toor Dal Premium (1 kg)
2. Moong Dal Split (1 kg)
3. Chana Dal Split (1 kg)
4. Urad Dal Whole (500 g)
5. Masoor Dal Red (1 kg)

### Cereals & Muesli:

1. Cornflakes Classic (500 g)
2. Oats Instant (500 g)
3. Muesli Fruit & Nut (500 g)
4. Wheat Flakes (500 g)
5. Granola Crunchy (400 g)

## After running:

All 20 products will be:

- Visible in seller's product list
- Available for customers to purchase
- Properly categorized under Grocery > Staples & Grains > [Subcategory]
- Linked to the seller account
- Have product images (if available in assets folder)
