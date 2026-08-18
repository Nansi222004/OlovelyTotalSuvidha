import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from '../models/Seller';
import HeaderCategory from '../models/HeaderCategory';
import Category from '../models/Category';
import SubCategory from '../models/SubCategory';
import Product from '../models/Product';
import { register, updateProfile, getProfile } from '../modules/seller/controllers/sellerAuthController';
import { getAllowedHeaderCategories, createProduct } from '../modules/seller/controllers/productController';

dotenv.config();

// Helper to invoke asyncHandler wrapped controllers and wait for json response
async function invokeController(fn: any, req: any, res: any) {
  await new Promise<void>((resolve, reject) => {
    res.json = function (data: any) {
      res.data = data;
      resolve();
      return res;
    };
    res.status = function (code: number) {
      res.statusCode = code;
      return res;
    };
    fn(req, res, (err: any) => {
      if (err) {
        console.error('Controller error via next():', err);
        res.data = { success: false, message: err.message };
        res.statusCode = 500;
        resolve();
      } else {
        resolve();
      }
    });
  });
}

async function runSellerCategoryFlowTests() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('====================================================');
    console.log('🚀 RUNNING SELLER CATEGORY FLOW & PRODUCT MAPPING TESTS');
    console.log('====================================================\n');

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition: boolean, description: string) {
      if (condition) {
        console.log(`  ✅ PASS: ${description}`);
        passedTests++;
      } else {
        console.error(`  ❌ FAIL: ${description}`);
        failedTests++;
      }
    }

    // Setup Test Categories
    const testHeaderA = await HeaderCategory.findOneAndUpdate(
      { name: 'TEST_HEADER_CAT_A' },
      { name: 'TEST_HEADER_CAT_A', slug: 'test-header-cat-a', status: 'Published', order: 99 },
      { upsert: true, new: true }
    );
    const testHeaderB = await HeaderCategory.findOneAndUpdate(
      { name: 'TEST_HEADER_CAT_B' },
      { name: 'TEST_HEADER_CAT_B', slug: 'test-header-cat-b', status: 'Published', order: 100 },
      { upsert: true, new: true }
    );

    const parentCatA = await Category.findOneAndUpdate(
      { name: 'TEST_PARENT_CAT_A' },
      { name: 'TEST_PARENT_CAT_A', slug: 'test-parent-cat-a', headerCategoryId: testHeaderA._id, parentId: null, status: 'Active' },
      { upsert: true, new: true }
    );
    const parentCatB = await Category.findOneAndUpdate(
      { name: 'TEST_PARENT_CAT_B' },
      { name: 'TEST_PARENT_CAT_B', slug: 'test-parent-cat-b', headerCategoryId: testHeaderB._id, parentId: null, status: 'Active' },
      { upsert: true, new: true }
    );

    const subCatA = await SubCategory.findOneAndUpdate(
      { name: 'TEST_SUBCAT_A' },
      { name: 'TEST_SUBCAT_A', category: parentCatA._id },
      { upsert: true, new: true }
    );
    const subCatB = await SubCategory.findOneAndUpdate(
      { name: 'TEST_SUBCAT_B' },
      { name: 'TEST_SUBCAT_B', category: parentCatB._id },
      { upsert: true, new: true }
    );

    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const testEmail = `seller_cat_test_${Date.now()}@example.com`;

    console.log('--- [1] SELLER REGISTRATION & CATEGORY PERSISTENCE ---');
    const reqReg: any = {
      body: {
        sellerName: 'QA Category Seller',
        mobile: testMobile,
        email: testEmail,
        storeName: 'QA Category Store',
        category: 'TEST_HEADER_CAT_A',
        categories: ['TEST_HEADER_CAT_A'],
        city: 'Jaipur',
      },
    };
    const resReg: any = {};
    await invokeController(register, reqReg, resReg);
    if (!resReg.data?.success) {
      console.log('Registration response data:', resReg.data);
    }
    assert(resReg.statusCode === 201 && resReg.data?.success === true, 'Seller registered successfully with category');

    const sellerDoc = await Seller.findOne({ email: testEmail });
    assert(sellerDoc !== null && sellerDoc.category === 'TEST_HEADER_CAT_A', 'Primary category persisted to MongoDB');
    assert(Array.isArray(sellerDoc?.categories) && sellerDoc.categories.includes('TEST_HEADER_CAT_A'), 'Allowed categories array persisted to MongoDB');

    console.log('\n--- [2] SELLER PROFILE FETCH & PROFILE CATEGORY UPDATE ---');
    const reqProfile: any = { user: { userId: sellerDoc!._id.toString() } };
    const resProfile: any = {};
    await invokeController(getProfile, reqProfile, resProfile);
    assert(resProfile.data?.data?.category === 'TEST_HEADER_CAT_A', 'Profile API returns persisted primary category');
    assert(resProfile.data?.data?.categories?.includes('TEST_HEADER_CAT_A'), 'Profile API returns allowed categories array');

    // Update profile with multiple allowed categories
    const reqUpdate: any = {
      user: { userId: sellerDoc!._id.toString() },
      body: {
        category: 'TEST_HEADER_CAT_A',
        categories: ['TEST_HEADER_CAT_A'],
      },
    };
    const resUpdate: any = {};
    await invokeController(updateProfile, reqUpdate, resUpdate);
    assert(resUpdate.statusCode === 200, 'Profile update API succeeds');
    const updatedSellerDoc = await Seller.findById(sellerDoc!._id);
    assert(updatedSellerDoc?.categories?.length === 1 && updatedSellerDoc.categories.includes('TEST_HEADER_CAT_A'), 'Seller allowed categories updated in MongoDB');

    console.log('\n--- [3] ALLOWED HEADER CATEGORIES FILTERING ---');
    const reqAllowed: any = { user: { userId: sellerDoc!._id.toString() } };
    const resAllowed: any = {};
    await invokeController(getAllowedHeaderCategories, reqAllowed, resAllowed);
    assert(resAllowed.statusCode === 200, 'getAllowedHeaderCategories API succeeds');
    const allowedNames = (resAllowed.data?.data || []).map((h: any) => h.name);
    assert(allowedNames.includes('TEST_HEADER_CAT_A'), 'Allowed header category list contains TEST_HEADER_CAT_A');
    assert(!allowedNames.includes('TEST_HEADER_CAT_B'), 'Allowed header category list excludes unauthorized TEST_HEADER_CAT_B');

    console.log('\n--- [4] PRODUCT CREATION CATEGORY & SUBCATEGORY VALIDATION ---');

    // Test 4A: Valid product creation
    const reqCreateValid: any = {
      user: { userId: sellerDoc!._id.toString() },
      body: {
        productName: 'Valid Test Item',
        headerCategoryId: testHeaderA._id.toString(),
        categoryId: parentCatA._id.toString(),
        subcategoryId: subCatA._id.toString(),
        variations: [{ title: 'Standard', price: 100, discPrice: 90, stock: 10 }],
      },
    };
    const resCreateValid: any = {};
    await invokeController(createProduct, reqCreateValid, resCreateValid);
    assert(resCreateValid.statusCode === 201, 'Valid product creation succeeds (matching Header + Category + Subcategory)');

    // Test 4B: Rejection of unauthorized header category
    const reqCreateUnauthHeader: any = {
      user: { userId: sellerDoc!._id.toString() },
      body: {
        productName: 'Unauthorized Item',
        headerCategoryId: testHeaderB._id.toString(),
        categoryId: parentCatB._id.toString(),
        subcategoryId: subCatB._id.toString(),
        variations: [{ title: 'Standard', price: 100, discPrice: 90, stock: 10 }],
      },
    };
    const resCreateUnauthHeader: any = {};
    await invokeController(createProduct, reqCreateUnauthHeader, resCreateUnauthHeader);
    assert(resCreateUnauthHeader.statusCode === 403, 'Product creation rejected when using unauthorized header category (HTTP 403)');

    // Test 4C: Rejection of mismatched category and subcategory
    const reqCreateMismatchedSub: any = {
      user: { userId: sellerDoc!._id.toString() },
      body: {
        productName: 'Mismatched Item',
        headerCategoryId: testHeaderA._id.toString(),
        categoryId: parentCatA._id.toString(),
        subcategoryId: subCatB._id.toString(), // Belongs to parentCatB, not parentCatA!
        variations: [{ title: 'Standard', price: 100, discPrice: 90, stock: 10 }],
      },
    };
    const resCreateMismatchedSub: any = {};
    await invokeController(createProduct, reqCreateMismatchedSub, resCreateMismatchedSub);
    assert(resCreateMismatchedSub.statusCode === 400, 'Product creation rejected when subcategory does not belong to category (HTTP 400)');

    // Cleanup test data
    await Product.deleteMany({ seller: sellerDoc!._id });
    await Seller.deleteOne({ _id: sellerDoc!._id });
    await HeaderCategory.deleteMany({ name: { $in: ['TEST_HEADER_CAT_A', 'TEST_HEADER_CAT_B'] } });
    await Category.deleteMany({ _id: { $in: [parentCatA._id, parentCatB._id] } });
    await SubCategory.deleteMany({ _id: { $in: [subCatA._id, subCatB._id] } });
    console.log('\n🧹 Cleaned up test data');

    console.log('\n====================================================');
    console.log(`📊 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Integration test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runSellerCategoryFlowTests();
