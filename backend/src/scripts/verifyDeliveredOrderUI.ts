// Test Delivered Order UI Status mapping
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Order from '../models/Order';

const JWT_SECRET = process.env.JWT_SECRET || 'fallbacksecretkey';
const CUSTOMER_ID = '6a7e05ddd9341125c8a8dea9';
const CUSTOMER_TOKEN = jwt.sign({ userId: CUSTOMER_ID, userType: 'Customer', phone: '8817469588' }, JWT_SECRET, { expiresIn: '1d' });

function apiCall(token: string, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1' + path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 500, body: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode || 500, body: d }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  // Set latest order to Delivered
  const latestOrder = await Order.findOne({ customer: CUSTOMER_ID }).sort({ createdAt: -1 });
  if (!latestOrder) {
    console.log('No order found!');
    await mongoose.disconnect();
    return;
  }

  latestOrder.status = 'Delivered';
  await latestOrder.save();

  const orderId = latestOrder._id.toString();
  console.log(`Updated Order ${orderId} status to "Delivered" in MongoDB.`);
  await mongoose.disconnect();

  console.log(`\nTesting GET /customer/orders/${orderId}...`);
  const res = await apiCall(CUSTOMER_TOKEN, `/customer/orders/${orderId}`);
  console.log(`Status HTTP Code: ${res.status}`);
  console.log(`Order Status in API response: "${res.body?.data?.status}"`);
  console.log(`Customer Name: "${res.body?.data?.customerName}"`);
  console.log(`Address: "${res.body?.data?.deliveryAddress?.address}"`);
}

verify();
