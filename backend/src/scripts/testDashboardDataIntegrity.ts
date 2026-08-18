import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from '../models/Customer';
import Category from '../models/Category';
import SubCategory from '../models/SubCategory';
import Product from '../models/Product';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import { getDashboardStats as getAdminDashboardStats } from '../services/dashboardService';
import { getDashboardStats as getSellerDashboardStats } from '../modules/seller/controllers/dashboardController';

dotenv.config();

async function auditDashboardData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB for Dashboard Integrity Audit');

    console.log('\n====================================================');
    console.log('📊 DIRECT MONGODB DOCUMENT COUNTS (GROUND TRUTH)');
    console.log('====================================================');

    const totalCategoriesColl = await Category.countDocuments();
    const parentCategoriesCount = await Category.countDocuments({ parentId: null });
    const childCategoriesCount = await Category.countDocuments({ parentId: { $ne: null } });
    const subCategoriesCollCount = await SubCategory.countDocuments();
    const totalSubcategoriesCombined = childCategoriesCount + subCategoriesCollCount;

    const totalProductsColl = await Product.countDocuments();
    const activeProductsColl = await Product.countDocuments({ status: 'Active' });
    const totalCustomersColl = await Customer.countDocuments();
    const activeCustomersColl = await Customer.countDocuments({ status: 'Active' });
    const totalSellersColl = await Seller.countDocuments();
    const approvedSellersColl = await Seller.countDocuments({ status: 'Approved' });
    const totalDeliveriesColl = await Delivery.countDocuments();
    const activeDeliveriesColl = await Delivery.countDocuments({ status: 'Active' });

    const totalOrdersColl = await Order.countDocuments();
    const nonPendingOrdersColl = await Order.countDocuments({ status: { $ne: 'Pending' } });
    const deliveredOrdersColl = await Order.countDocuments({ status: 'Delivered' });
    const pendingOrdersColl = await Order.countDocuments({ status: { $in: ['Received', 'Accepted', 'Processed', 'Shipped', 'Out for Delivery', 'Out For Delivery'] } });
    const cancelledOrdersColl = await Order.countDocuments({ status: 'Cancelled' });

    console.log(`📁 Categories Collection Total: ${totalCategoriesColl}`);
    console.log(`   ├─ Parent Categories (parentId: null): ${parentCategoriesCount}`);
    console.log(`   └─ Child/Sub Categories (parentId != null): ${childCategoriesCount}`);
    console.log(`📁 SubCategory Collection Total: ${subCategoriesCollCount}`);
    console.log(`📁 TOTAL SUBCATEGORIES COMBINED: ${totalSubcategoriesCombined}`);

    console.log(`📦 Products Collection Total: ${totalProductsColl} (Active: ${activeProductsColl})`);
    console.log(`👥 Customers Collection Total: ${totalCustomersColl} (Active: ${activeCustomersColl})`);
    console.log(`🏪 Sellers Collection Total: ${totalSellersColl} (Approved: ${approvedSellersColl})`);
    console.log(`🛵 Delivery Collection Total: ${totalDeliveriesColl} (Active: ${activeDeliveriesColl})`);

    console.log(`🛒 Orders Collection Total: ${totalOrdersColl} (Non-Pending: ${nonPendingOrdersColl})`);
    console.log(`   ├─ Delivered: ${deliveredOrdersColl}`);
    console.log(`   ├─ Pending/In-Progress: ${pendingOrdersColl}`);
    console.log(`   └─ Cancelled: ${cancelledOrdersColl}`);

    console.log('\n====================================================');
    console.log('🔍 ADMIN DASHBOARD API CONTRACT VERIFICATION');
    console.log('====================================================');

    const adminStats = await getAdminDashboardStats();
    console.log('Admin Dashboard Stats API Output:', JSON.stringify(adminStats, null, 2));

    console.log('\n--- Admin Stats Discrepancy Analysis ---');
    console.log(`Total Users (Customers): DB=${totalCustomersColl} | API=${adminStats.totalUser}`);
    console.log(`Total Category: DB Parent=${parentCategoriesCount} | API=${adminStats.totalCategory}`);
    console.log(`Total Subcategory: DB Combined=${totalSubcategoriesCombined} | API=${adminStats.totalSubcategory}`);
    console.log(`Total Products: DB Total=${totalProductsColl} | API=${adminStats.totalProduct}`);

    console.log('\n====================================================');
    console.log('🏪 SELLER DASHBOARD AUDIT FOR ALL SELLERS');
    console.log('====================================================');

    const sellers = await Seller.find().select('_id sellerName storeName status');
    console.log(`Found ${sellers.length} sellers in database.`);

    for (const seller of sellers) {
      console.log(`\n--- Seller: ${seller.sellerName} (${seller.storeName}) [ID: ${seller._id}] Status: ${seller.status} ---`);
      
      const sellerProducts = await Product.countDocuments({ seller: seller._id });
      const sellerCategories = await Product.distinct('category', { seller: seller._id }).then(ids => ids.length);
      const sellerSubcategories = await Product.distinct('subcategory', { seller: seller._id }).then(ids => ids.length);

      const sellerOrderItems = await OrderItem.find({ seller: seller._id }).select('order');
      const sellerOrderIds = [...new Set(sellerOrderItems.map(item => item.order.toString()))];

      const sellerOrdersTotal = await Order.countDocuments({ _id: { $in: sellerOrderIds }, status: { $ne: 'Pending' } });
      const sellerDelivered = await Order.countDocuments({ _id: { $in: sellerOrderIds }, status: 'Delivered' });
      const sellerPending = await Order.countDocuments({ _id: { $in: sellerOrderIds }, status: { $in: ['Received', 'Accepted', 'Processed', 'Shipped', 'Out for Delivery', 'Out For Delivery'] } });
      const sellerCancelled = await Order.countDocuments({ _id: { $in: sellerOrderIds }, status: 'Cancelled' });
      const sellerCustomers = await Order.distinct('customer', { _id: { $in: sellerOrderIds }, status: { $ne: 'Pending' } }).then(ids => ids.length);

      console.log(`   ├─ Products: ${sellerProducts}`);
      console.log(`   ├─ Categories Used: ${sellerCategories}`);
      console.log(`   ├─ Subcategories Used: ${sellerSubcategories}`);
      console.log(`   ├─ Orders Total: ${sellerOrdersTotal} (Delivered: ${sellerDelivered}, Pending: ${sellerPending}, Cancelled: ${sellerCancelled})`);
      console.log(`   └─ Distinct Customers: ${sellerCustomers}`);
    }

  } catch (err) {
    console.error('❌ Audit script failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

auditDashboardData();
