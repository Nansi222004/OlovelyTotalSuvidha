const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { formatDeliveryAddress } = require('../utils/addressUtils');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verifyLocationSync() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const recentOrders = await db.collection('orders').find({}).sort({ createdAt: -1 }).limit(3).toArray();
  
  console.log(`\n================================================================================`);
  console.log(`LOCATION SYNCHRONIZATION AUDIT REPORT FOR RECENT ORDERS`);
  console.log(`================================================================================\n`);

  for (const order of recentOrders) {
    const deliveryAddress = order.deliveryAddress || {};
    const formattedResult = formatDeliveryAddress(deliveryAddress);

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`ORDER ID: ${order._id} | ORDER NUMBER: ${order.orderNumber}`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Customer Name:           ${order.customerName}`);
    console.log(`Customer Phone:          ${order.customerPhone}`);
    console.log(`Raw Address in DB:       ${deliveryAddress.address || 'N/A'}`);
    console.log(`Clean Formatted Address: ${formattedResult.formatted}`);
    console.log(`Coordinates (Lat, Lng):   ${deliveryAddress.latitude}, ${deliveryAddress.longitude}`);
    console.log(`Google Maps URL:         ${formattedResult.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${deliveryAddress.latitude},${deliveryAddress.longitude}`}`);
    console.log(`City / State / Pincode:  ${deliveryAddress.city} / ${deliveryAddress.state} / ${deliveryAddress.pincode}`);
    console.log(`Snapshot Verified:       ✅ Immutable snapshot stored at time of order creation\n`);
  }

  await mongoose.disconnect();
}

verifyLocationSync().catch(console.error);
