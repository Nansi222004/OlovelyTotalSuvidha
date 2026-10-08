import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import Customer from '../models/Customer';
import Order from '../models/Order';
import { generateToken } from '../services/jwtService';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api/v1';

async function audit() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  await mongoose.connect(uri);

  const customer = await Customer.findOne({ phone: '8817469588' }).lean();
  if (!customer) {
    console.log('Customer not found');
    await mongoose.disconnect();
    return;
  }

  const token = generateToken(customer._id.toString(), 'Customer');
  console.log(`\nTesting customer: ${customer.name} (${customer.phone}), token generated.`);

  const endpointsToTest = [
    { name: 'GET /customer/profile', method: 'GET', url: `${API_BASE}/customer/profile` },
    { name: 'GET /customer/app-settings', method: 'GET', url: `${API_BASE}/customer/app-settings` },
    { name: 'GET /customer/orders', method: 'GET', url: `${API_BASE}/customer/orders` },
    { name: 'GET /customer/orders/6ac757e59dfab9ed15d79636 (ObjectId)', method: 'GET', url: `${API_BASE}/customer/orders/6ac757e59dfab9ed15d79636` },
    { name: 'GET /customer/orders/ORD1791449061623906 (orderNumber)', method: 'GET', url: `${API_BASE}/customer/orders/ORD1791449061623906` },
    { name: 'GET /customer/orders/6ac757e59dfab9ed15d79636/seller-locations (ObjectId)', method: 'GET', url: `${API_BASE}/customer/orders/6ac757e59dfab9ed15d79636/seller-locations` },
    { name: 'GET /customer/orders/ORD1791449061623906/seller-locations (orderNumber)', method: 'GET', url: `${API_BASE}/customer/orders/ORD1791449061623906/seller-locations` },
    { name: 'GET /customer/cart', method: 'GET', url: `${API_BASE}/customer/cart` },
    { name: 'GET /customer/notifications', method: 'GET', url: `${API_BASE}/customer/notifications` },
    { name: 'GET /customer/home/serviceability', method: 'GET', url: `${API_BASE}/customer/home/serviceability?latitude=22.7196&longitude=75.8577` },
    { name: 'GET /orders (Seller orders endpoint called with Customer token)', method: 'GET', url: `${API_BASE}/orders` },
    { name: 'GET /orders/6ac757e59dfab9ed15d79636 (Seller order by ID called with Customer token)', method: 'GET', url: `${API_BASE}/orders/6ac757e59dfab9ed15d79636` },
  ];

  console.log('\n--- CALLING ENDPOINTS WITH CUSTOMER TOKEN ---');
  for (const ep of endpointsToTest) {
    try {
      const res = await axios({
        method: ep.method,
        url: ep.url,
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true, // Don't throw on non-2xx
      });
      console.log(`${res.status === 200 ? '✅' : res.status === 401 ? '❌ 401 UNAUTHORIZED' : '⚠️ ' + res.status} [${res.status}] ${ep.name} -> response code: ${res.data?.code || 'none'}, msg: ${res.data?.message || 'ok'}`);
    } catch (err: any) {
      console.log(`💥 ERROR ${ep.name}: ${err.message}`);
    }
  }

  await mongoose.disconnect();
}

audit().catch(console.error);
