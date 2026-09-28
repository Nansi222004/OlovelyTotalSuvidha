import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function restoreSeller() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('No MONGODB_URI found');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    const db = mongoose.connection.db;
    if (!db) {
      console.error('No db instance available');
      process.exit(1);
    }

    const sellerCol = db.collection('sellers');
    const productCol = db.collection('products');

    const sellerId = new mongoose.Types.ObjectId('6ab66a851bbd4844556eed26');
    const mobile = '6261583108';

    // 1. Check if seller already exists (or partially exists)
    const existingSeller = await sellerCol.findOne({
      $or: [{ _id: sellerId }, { mobile }]
    });

    const sellerDoc = {
      _id: sellerId,
      sellerName: 'Neelam Tiwari',
      storeName: 'Neelam Store',
      email: '6261583108@olovely.temp',
      mobile: mobile,
      password: '$2b$10$7jwpYNotYUx9V85Gu6bIEewI98RsctSZNcTIR03QGCFo5bNLLoglO', // Standard bcrypt hash
      category: 'Grocery',
      categories: [
        'Grocery',
        'Electronics',
        'Beauty',
        'Fashion',
        'Fruits & Vegetables',
        'Dairy & Milk',
        'Bakery & Biscuits',
        'Snacks & Drinks',
        'Home & Furniture',
        'Toys & Sports',
        'Rani Masala Spices All',
        'All Grocery Mart',
        'Vegetable & Fruits Fresh',
        'Oils Ghee',
        'Dairy Items Milk Product',
        'Chips Namkeen & Cold Drinks',
        'Bakery & Biscuit Item',
        'Sweet Farsan & Chocolate',
        'Pan Parlour All Item',
        'Tea & Coffee',
        'Fruits Vegetable Juice',
        'Icecream Faluda',
        'Breakfast, Lunch & Dinner',
        'Ready to Eat Item',
        'Non Veg Restaurant',
        'Cosmetics Item, Bath & Body',
        'Skins Face Hair',
        'Baby Care Products',
        'Ladies Wear Fashion',
        'Mens Wear Fashion',
        'Foot Wear Ladies',
        'Foot Wear Mens',
        'Toys & Sports Item',
        'Travel Item',
        'Cleaners & Refill Item',
        'Stationery & Games Item',
        'Electronics All Items',
        'Pet Store Products',
        'Jewellery Item',
        'Home Decor',
        'Handicraft & Hosiery Item',
        'Kids Wear',
        'Ladies & Jean Bag Purse',
        'Yoga & Jim Item',
        'Kitchen Item Vasan Bhandar',
        'AC, Fridge, TV, Electronics',
        'Mobile Item Accessories',
        'Furniture All',
        'Festival Item',
        'All Spices Wholesaler',
        'Pan Masala Shutiya Wholesaler',
        'All Kiriyana Item Wholesaler',
        'Confectionery Retail Item'
      ],
      city: 'Indore',
      address: 'Indore City, Madhya Pradesh, 452001',
      serviceRadiusKm: 500,
      latitude: '22.717650',
      longitude: '75.871860',
      location: {
        type: 'Point',
        coordinates: [75.871860, 22.717650]
      },
      status: 'Approved',
      isShopOpen: true,
      vendorType: 'HYBRID',
      shippingConfig: {
        pickupAddress: 'Indore City, Madhya Pradesh, 452001',
        pickupPincode: '452001',
        warehouseAddress: 'Indore City, Madhya Pradesh, 452001',
        returnAddress: 'Indore City, Madhya Pradesh, 452001',
        freeShippingThreshold: 0,
        flatShippingFee: 0
      },
      wholesaleEnabled: true,
      requireProductApproval: false,
      viewCustomerDetails: true,
      commission: 0,
      balance: 0,
      onHoldBalance: 0,
      isPlatform: false,
      fcmTokens: [
        'f660rPmD1ReUITn2Shyj8g:APA91bHjZ-MOB3oMgz39igi1MTu0FBf7GervGZEZz3-A6DhfiDefaJg1ZIQG-T_azjkXytX0jhu7BM7T0A2LSbc_8AZ9JEOAOM6rcVsvVWknH1Ww7S0rvhQ'
      ],
      fcmTokenMobile: [
        'c9IffTDlTDOJqWJMv2Q8IV:APA91bG3EnRNt0rvqTfYRRCHRAlve2ku0dxHU6MJRmUL-CRqNqYH8UasdlGeRxXlnKcC5tyZyME8XJjRxHNvgJ_Ekr_HRckUtLFs3dGxztuSYL1onx-Ue-c'
      ],
      categoryCommissions: [],
      workingHours: {
        offDays: []
      },
      createdAt: new Date('2026-09-25T12:35:49.000Z'),
      updatedAt: new Date(),
      __v: 7
    };

    if (existingSeller) {
      console.log('Seller already exists, updating with complete configuration...');
      await sellerCol.updateOne({ _id: existingSeller._id }, { $set: sellerDoc });
      console.log(`✅ Updated existing seller ${existingSeller._id}`);
    } else {
      console.log('Inserting restored seller document...');
      await sellerCol.insertOne(sellerDoc);
      console.log(`✅ Successfully restored seller with ID: ${sellerId} and Mobile: ${mobile}`);
    }

    // 2. Reactivate and publish all products belonging to this seller
    console.log('\nRestoring products associated with seller...');
    const prodUpdateResult = await productCol.updateMany(
      { seller: sellerId },
      {
        $set: {
          status: 'Active',
          publish: true,
          updatedAt: new Date()
        }
      }
    );

    console.log(`✅ Products updated: ${prodUpdateResult.matchedCount} matched, ${prodUpdateResult.modifiedCount} modified.`);

    // 3. Verification
    console.log('\n--- VERIFICATION ---');
    const verifiedSeller = await sellerCol.findOne({ _id: sellerId });
    console.log('Seller Document in DB:', {
      _id: verifiedSeller?._id,
      sellerName: verifiedSeller?.sellerName,
      storeName: verifiedSeller?.storeName,
      mobile: verifiedSeller?.mobile,
      email: verifiedSeller?.email,
      status: verifiedSeller?.status,
      vendorType: verifiedSeller?.vendorType,
      isShopOpen: verifiedSeller?.isShopOpen,
      serviceRadiusKm: verifiedSeller?.serviceRadiusKm,
      city: verifiedSeller?.city,
      categoriesCount: verifiedSeller?.categories?.length
    });

    const activeProductsCount = await productCol.countDocuments({ seller: sellerId, status: 'Active', publish: true });
    const totalProductsCount = await productCol.countDocuments({ seller: sellerId });
    console.log(`Products: ${activeProductsCount} of ${totalProductsCount} are Active & Published.`);

    await mongoose.disconnect();
    console.log('\n✅ Restore process completed successfully!');
  } catch (err: any) {
    console.error('❌ Restore failed:', err);
    process.exit(1);
  }
}

restoreSeller();
