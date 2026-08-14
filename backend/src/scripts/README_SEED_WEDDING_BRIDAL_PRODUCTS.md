# Seed Wedding Bridal Products Script

This script creates 20 products (5 per subcategory) under the Wedding header category's "Bridal Wear" category for a specific seller.

## What it does:

1. **Authenticates seller** using phone number and OTP

   - Phone: 7999267233
   - OTP: Taken at runtime (prompted in terminal)

2. **Finds categories:**

   - Wedding header category
   - Bridal Wear category (under Wedding)
   - All 4 subcategories: Bridal Lehengas, Bridal Sarees, Bridal Gowns, Bridal Accessories

3. **Creates 5 products per subcategory** (20 products total):
   - **Bridal Lehengas**: 5 lehenga products
   - **Bridal Sarees**: 5 saree products
   - **Bridal Gowns**: 5 gown products
   - **Bridal Accessories**: 5 accessory products

## Product Details:

Each product includes:

- Realistic product names
- Random prices (₹5,000 - ₹50,000)
- Random discounts (10-40%)
- Random stock (10-100 units)
- One variation (Standard Size)
- Tags: wedding, bridal, subcategory name, traditional
- Status: Active, Published
- Returnable: Yes (7 days)

## How to run:

### Using npm script:

```bash
cd backend
npm run seed:wedding-bridal-products
```

### Direct execution:

```bash
cd backend
npx tsx src/scripts/seedWeddingBridalProducts.ts
```

## Requirements:

- MongoDB connection string in `.env` file (`MONGODB_URI`)
- Seller must exist with mobile number: **7999267233**
- Wedding header category must exist and be Published
- Bridal Wear category must exist under Wedding
- All 4 subcategories must exist under Bridal Wear:
  - Bridal Lehengas
  - Bridal Sarees
  - Bridal Gowns
  - Bridal Accessories

## OTP Process:

1. Script sends OTP to seller's phone (7999267233)
2. If in mock mode, OTP is displayed in console
3. Otherwise, OTP is sent via SMS
4. Script prompts you to enter OTP
5. OTP is verified before proceeding

## Logs:

The script creates a log file at `backend/seed_wedding_bridal_products.log` with detailed information about:

- Seller authentication
- Categories found
- Products created
- Any errors or warnings
- Summary statistics

## Notes:

- The script skips products that already exist (prevents duplicates)
- Products are created with realistic names and pricing
- All products are set to Active and Published status
- Products are assigned to the seller with mobile: 7999267233
- The script is idempotent - safe to run multiple times

## Product Names Created:

### Bridal Lehengas:

1. Red Embroidered Bridal Lehenga
2. Maroon Zardosi Bridal Lehenga
3. Pink Sequined Bridal Lehenga
4. Ivory Traditional Bridal Lehenga
5. Gold Thread Work Bridal Lehenga

### Bridal Sarees:

1. Red Banarasi Bridal Saree
2. Maroon Kanjeevaram Bridal Saree
3. Pink Silk Bridal Saree
4. Ivory Designer Bridal Saree
5. Gold Zari Work Bridal Saree

### Bridal Gowns:

1. White A-Line Bridal Gown
2. Ivory Mermaid Bridal Gown
3. Champagne Ball Gown
4. Blush Pink Bridal Gown
5. Cream Designer Bridal Gown

### Bridal Accessories:

1. Bridal Jewelry Set
2. Bridal Maang Tikka
3. Bridal Nose Ring
4. Bridal Bangles Set
5. Bridal Hair Accessories

## After running:

All 20 products will be:

- Visible in seller's product list
- Available for customers to purchase
- Properly categorized under Wedding > Bridal Wear > [Subcategory]
- Linked to the seller account
