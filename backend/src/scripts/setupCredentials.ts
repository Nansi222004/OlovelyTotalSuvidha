import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function setupCredentials() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri!);
  const db = mongoose.connection.db;

  // 1. Admin Account
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  await db.collection('admins').updateOne(
    { email: 'admin@olovely.com' },
    {
      $set: {
        name: 'Olovely Super Admin',
        email: 'admin@olovely.com',
        mobile: '9876543210',
        password: adminPasswordHash,
        role: 'Super Admin',
        status: 'Active',
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  console.log('✅ Admin: admin@olovely.com / Admin@123');

  // 2. Seller Account
  const sellerPasswordHash = await bcrypt.hash('Seller@123', 10);
  await db.collection('sellers').updateOne(
    { email: 'seller@olovely.com' },
    {
      $set: {
        sellerName: 'Olovely Supermart',
        storeName: 'Olovely Supermart',
        email: 'seller@olovely.com',
        mobile: '9999999999',
        password: sellerPasswordHash,
        category: 'Grocery',
        city: 'Indore',
        address: 'Indore City, Madhya Pradesh, 452001',
        status: 'Approved',
        isShopOpen: true,
        serviceRadiusKm: 500,
        latitude: '22.717650',
        longitude: '75.871860',
        location: {
          type: 'Point',
          coordinates: [75.871860, 22.717650]
        },
        requireProductApproval: false,
        viewCustomerDetails: true,
        commission: 0,
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  console.log('✅ Seller: seller@olovely.com / Seller@123 (or mobile: 9999999999)');

  // 3. Delivery Boy Account
  const deliveryPasswordHash = await bcrypt.hash('Delivery@123', 10);
  await db.collection('deliveryboys').updateOne(
    { email: 'delivery@olovely.com' },
    {
      $set: {
        name: 'Rahul Delivery Partner',
        email: 'delivery@olovely.com',
        mobile: '9876543210',
        password: deliveryPasswordHash,
        status: 'Approved',
        isOnline: true,
        vehicleType: 'Bike',
        vehicleNumber: 'MP09-AB-1234',
        drivingLicenseNumber: 'MP09-2023-12345',
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  // 4. App Settings
  await db.collection('appsettings').updateOne(
    {},
    {
      $set: {
        appName: 'Olovely Total Suvidha',
        appLogo: '/assets/olovelylogo.png',
        estimatedDeliveryTime: '12-15 mins',
        contactEmail: 'contact@olovely.com',
        contactPhone: '9876543210',
        supportEmail: 'support@olovely.com',
        supportPhone: '9876543210',
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  console.log('✅ AppSettings initialized: Olovely Total Suvidha / 12-15 mins / logo');

  await mongoose.disconnect();
}

setupCredentials().catch(console.error);
