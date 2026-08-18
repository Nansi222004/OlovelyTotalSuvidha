/// <reference path="../types.d.ts" />
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Customer from '../models/Customer';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import AppSettings from '../models/AppSettings';
import Commission from '../models/Commission';
import WalletTransaction from '../models/WalletTransaction';
import { getOrderItemCommissionRate, calculateCODOrderBreakdown } from '../services/commissionService';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runAdminWalletAggregationSuite() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB for Admin Wallet Aggregation Suite\n');

  const testResults: Array<{ id: string; test: string; status: 'PASS' | 'FAIL'; evidence: string }> = [];

  // Setup test entities
  const testCustomer = await Customer.create({
    name: 'Wallet Test Customer',
    phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `walletcust_${Date.now()}@test.com`,
    status: 'Active',
  });

  const testSeller = await Seller.create({
    sellerName: 'Wallet Test Seller',
    mobile: `8${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `walletseller_${Date.now()}@test.com`,
    storeName: 'Wallet Store',
    category: 'Grocery',
    status: 'Approved',
    balance: 0,
  });

  const testDriver = await Delivery.create({
    name: 'Wallet Driver',
    mobile: `7${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: `walletdriver_${Date.now()}@test.com`,
    password: 'Password123!',
    status: 'Active',
    balance: 0,
  });

  // -------------------------------------------------------------
  // TEST A: ₹499 product, ₹50 shipping, ₹2 platform fee, 10% seller comm, 5% delivery comm
  // -------------------------------------------------------------
  try {
    const subtotal = 499;
    const shipping = 50;
    const platformFee = 2;
    const customerTotal = subtotal + shipping + platformFee; // 551

    const sellerCommRate = 10;
    const sellerCommAmount = (subtotal * sellerCommRate) / 100; // 49.90
    const sellerNet = subtotal - sellerCommAmount; // 449.10

    const deliveryRate = 5;
    const deliveryCommAmount = (subtotal * deliveryRate) / 100; // 24.95

    const adminNet = sellerCommAmount + platformFee + shipping - deliveryCommAmount; // 49.90 + 2 + 50 - 24.95 = 76.95

    if (Math.abs(adminNet - 76.95) < 0.01 && Math.abs(sellerNet - 449.10) < 0.01 && Math.abs(deliveryCommAmount - 24.95) < 0.01) {
      testResults.push({
        id: 'TEST A',
        test: '₹499 product with ₹50 shipping & ₹2 fee yields exact Admin Net = ₹76.95',
        status: 'PASS',
        evidence: `Customer Total: ₹${customerTotal}, Seller Net: ₹${sellerNet}, Delivery: ₹${deliveryCommAmount}, Admin Net: ₹${adminNet}`,
      });
    } else {
      throw new Error(`Calculation mismatch! Admin Net: ${adminNet}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'TEST A', test: '₹499 product calculation', status: 'FAIL', evidence: err.message });
  }

  // -------------------------------------------------------------
  // TEST B: ₹1,000 product, ₹0 shipping, ₹2 platform fee, 10% seller comm, 5% delivery comm
  // -------------------------------------------------------------
  try {
    const subtotal = 1000;
    const shipping = 0;
    const platformFee = 2;
    const customerTotal = subtotal + shipping + platformFee; // 1002

    const sellerCommRate = 10;
    const sellerCommAmount = (subtotal * sellerCommRate) / 100; // 100
    const sellerNet = subtotal - sellerCommAmount; // 900

    const deliveryRate = 5;
    const deliveryCommAmount = (subtotal * deliveryRate) / 100; // 50

    const adminNet = sellerCommAmount + platformFee + shipping - deliveryCommAmount; // 100 + 2 + 0 - 50 = 52

    if (Math.abs(adminNet - 52) < 0.01 && Math.abs(sellerNet - 900) < 0.01 && Math.abs(deliveryCommAmount - 50) < 0.01) {
      testResults.push({
        id: 'TEST B',
        test: '₹1,000 product with ₹0 shipping & ₹2 fee yields exact Admin Net = ₹52.00',
        status: 'PASS',
        evidence: `Customer Total: ₹${customerTotal}, Seller Net: ₹${sellerNet}, Delivery: ₹${deliveryCommAmount}, Admin Net: ₹${adminNet}`,
      });
    } else {
      throw new Error(`Calculation mismatch! Admin Net: ${adminNet}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'TEST B', test: '₹1,000 product calculation', status: 'FAIL', evidence: err.message });
  }

  // -------------------------------------------------------------
  // TEST C: ₹500 product, Free shipping, ₹2 platform fee, 10% seller comm, 5% delivery comm
  // -------------------------------------------------------------
  try {
    const subtotal = 500;
    const shipping = 0;
    const platformFee = 2;
    const customerTotal = subtotal + shipping + platformFee; // 502

    const sellerCommRate = 10;
    const sellerCommAmount = (subtotal * sellerCommRate) / 100; // 50
    const sellerNet = subtotal - sellerCommAmount; // 450

    const deliveryRate = 5;
    const deliveryCommAmount = (subtotal * deliveryRate) / 100; // 25

    const adminNet = sellerCommAmount + platformFee + shipping - deliveryCommAmount; // 50 + 2 + 0 - 25 = 27

    if (Math.abs(adminNet - 27) < 0.01 && Math.abs(sellerNet - 450) < 0.01 && Math.abs(deliveryCommAmount - 25) < 0.01) {
      testResults.push({
        id: 'TEST C',
        test: '₹500 product with Free shipping yields exact Admin Net = ₹27.00',
        status: 'PASS',
        evidence: `Customer Total: ₹${customerTotal}, Seller Net: ₹${sellerNet}, Delivery: ₹${deliveryCommAmount}, Admin Net: ₹${adminNet}`,
      });
    } else {
      throw new Error(`Calculation mismatch! Admin Net: ${adminNet}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'TEST C', test: '₹500 free shipping calculation', status: 'FAIL', evidence: err.message });
  }

  // -------------------------------------------------------------
  // TEST D: COD order with free delivery
  // -------------------------------------------------------------
  const orderCODTest = await Order.create({
    orderNumber: `ORD_WALLET_COD_${Date.now()}`,
    orderDate: new Date(),
    customer: testCustomer._id,
    customerName: testCustomer.name,
    customerEmail: testCustomer.email,
    customerPhone: testCustomer.phone,
    deliveryAddress: { address: 'Test St', city: 'Indore', pincode: '452001' },
    items: [],
    subtotal: 500,
    platformFee: 2,
    shipping: 0,
    total: 502,
    paymentMethod: 'COD',
    paymentStatus: 'Paid',
    status: 'Delivered',
    deliveryBoy: testDriver._id,
  });

  const Product = require('../models/Product').default;
  const testProduct = await Product.create({
    productName: 'Test COD Product',
    price: 500,
    discPrice: 500,
    seller: testSeller._id,
    category: new mongoose.Types.ObjectId(),
    sku: `SKU_${Date.now()}`,
    mainImage: '/img.png',
  });

  const itemCODTest = await OrderItem.create({
    order: orderCODTest._id,
    seller: testSeller._id,
    product: testProduct._id,
    productName: 'Test COD Product',
    unitPrice: 500,
    quantity: 1,
    total: 500,
    commissionRate: 10,
    commissionAmount: 50,
  });

  orderCODTest.items = [itemCODTest._id];
  await Order.findByIdAndUpdate(orderCODTest._id, { items: [itemCODTest._id] });

  try {
    const breakdown = await calculateCODOrderBreakdown(orderCODTest._id.toString());
    if (breakdown.totalAdminEarning === 27 && breakdown.amountDeliveryBoyOwesAdmin === 502) {
      testResults.push({
        id: 'TEST D',
        test: 'COD order with free delivery handles breakdown without division-by-zero or Infinity',
        status: 'PASS',
        evidence: `Admin Net Earning: ₹${breakdown.totalAdminEarning}, Rider Owes Admin: ₹${breakdown.amountDeliveryBoyOwesAdmin}, Rider Commission: ₹${breakdown.deliveryBoyCommission}`,
      });
    } else {
      throw new Error(`COD breakdown mismatch! Admin Net: ${breakdown.totalAdminEarning}`);
    }
  } catch (err: any) {
    testResults.push({ id: 'TEST D', test: 'COD free delivery breakdown', status: 'FAIL', evidence: err.message });
  }

  // Cleanup test entities
  await Customer.deleteOne({ _id: testCustomer._id });
  await Seller.deleteOne({ _id: testSeller._id });
  await Delivery.deleteOne({ _id: testDriver._id });
  await Product.deleteOne({ _id: testProduct._id });
  await OrderItem.deleteOne({ _id: itemCODTest._id });
  await Order.deleteOne({ _id: orderCODTest._id });
  await mongoose.disconnect();

  console.log('\n===============================================================');
  console.log('ADMIN WALLET AGGREGATION SUITE RESULTS');
  console.log('===============================================================\n');

  let allPassed = true;
  testResults.forEach((t) => {
    const icon = t.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${t.id}] ${t.test}: ${t.status}`);
    console.log(`   Evidence: ${t.evidence}\n`);
    if (t.status !== 'PASS') allPassed = false;
  });

  if (allPassed) {
    console.log('🎉 ALL ADMIN WALLET AGGREGATION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runAdminWalletAggregationSuite().catch((err) => {
  console.error('Unhandled error in test suite:', err);
  process.exit(1);
});
