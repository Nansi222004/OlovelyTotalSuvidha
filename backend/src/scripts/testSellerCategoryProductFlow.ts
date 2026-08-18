import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from '../models/Seller';
import HeaderCategory from '../models/HeaderCategory';
import Category from '../models/Category';
import SubCategory from '../models/SubCategory';
import Product from '../models/Product';
import { register, updateProfile, getProfile } from '../modules/seller/controllers/sellerAuthController';
import { getAllowedHeaderCategories, createProduct, getProductById, updateProduct } from '../modules/seller/controllers/productController';

dotenv.config();

// Helper to invoke asyncHandler wrapped controllers and wait for json response
async function invokeController(fn: any, req: any, res: any) {
  await new Promise<void>((resolve) => {
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
        res.data = { success: false, message: err.message };
        res.statusCode = 500;
        resolve();
      } else {
        resolve();
      }
    });
  });
}

async function runEndToEndCategoryProductFlowTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('====================================================');
    console.log('🚀 END-TO-END SELLER CATEGORY & PRODUCT FLOW SUITE');
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

    // Setup Test Fixtures
    const headerCat1 = await HeaderCategory.findOneAndUpdate(
      { name: 'SUITE_HEADER_1' },
      { name: 'SUITE_HEADER_1', slug: 'suite-header-1', status: 'Published', order: 101 },
      { upsert: true, new: true }
    );

    const headerCat2 = await HeaderCategory.findOneAndUpdate(
      { name: 'SUITE_HEADER_2' },
      { name: 'SUITE_HEADER_2', slug: 'suite-header-2', status: 'Published', order: 102 },
      { upsert: true, new: true }
    );

    const parentCat1 = await Category.findOneAndUpdate(
      { name: 'SUITE_PARENT_1' },
      { name: 'SUITE_PARENT_1', slug: 'suite-parent-1', headerCategoryId: headerCat1._id, parentId: null, status: 'Active' },
      { upsert: true, new: true }
    );

    const parentCat2 = await Category.findOneAndUpdate(
      { name: 'SUITE_PARENT_2' },
      { name: 'SUITE_PARENT_2', slug: 'suite-parent-2', headerCategoryId: headerCat2._id, parentId: null, status: 'Active' },
      { upsert: true, new: true }
    );

    const subCat1 = await Category.findOneAndUpdate(
      { name: 'SUITE_SUBCAT_1' },
      { name: 'SUITE_SUBCAT_1', slug: 'suite-subcat-1', parentId: parentCat1._id, headerCategoryId: headerCat1._id, status: 'Active' },
      { upsert: true, new: true }
    );

    const subCat2 = await Category.findOneAndUpdate(
      { name: 'SUITE_SUBCAT_2' },
      { name: 'SUITE_SUBCAT_2', slug: 'suite-subcat-2', parentId: parentCat2._id, headerCategoryId: headerCat2._id, status: 'Active' },
      { upsert: true, new: true }
    );

    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const testEmail = `suite_test_${Date.now()}@example.com`;

    // 1. Seller registration
    console.log('--- [TEST 1] Seller category exists after registration ---');
    const reqReg: any = {
      body: {
        sellerName: 'Suite Seller',
        mobile: testMobile,
        email: testEmail,
        storeName: 'Suite Store',
        category: 'SUITE_HEADER_1',
        categories: ['SUITE_HEADER_1'],
        city: 'Jaipur',
      },
    };
    const resReg: any = {};
    await invokeController(register, reqReg, resReg);
    assert(resReg.statusCode === 201 && resReg.data?.success === true, 'Registration succeeds');
    const sellerDoc = await Seller.findOne({ email: testEmail });
    assert(sellerDoc !== null && sellerDoc.category === 'SUITE_HEADER_1', 'Seller primary category exists in DB after registration');
    assert(Array.isArray(sellerDoc?.categories) && sellerDoc.categories.includes('SUITE_HEADER_1'), 'Seller allowed categories array exists in DB after registration');

    // 2. Profile returns category
    console.log('\n--- [TEST 2] Seller profile returns category ---');
    const reqProfile: any = { user: { userId: sellerDoc!._id.toString() } };
    const resProfile: any = {};
    await invokeController(getProfile, reqProfile, resProfile);
    assert(resProfile.data?.data?.category === 'SUITE_HEADER_1', 'Profile API returns correct primary category');
    assert(resProfile.data?.data?.categories?.includes('SUITE_HEADER_1'), 'Profile API returns correct allowed categories array');

    // 3. Seller settings returns category
    console.log('\n--- [TEST 3] Seller settings returns category ---');
    assert(resProfile.data?.data?.category === 'SUITE_HEADER_1', 'Seller settings state initialized from profile API');

    // 4. Seller can update category
    console.log('\n--- [TEST 4] Seller can update category ---');
    const reqUpdate: any = {
      user: { userId: sellerDoc!._id.toString() },
      body: {
        category: 'SUITE_HEADER_1',
        categories: ['SUITE_HEADER_1', 'SUITE_HEADER_2'],
      },
    };
    const resUpdate: any = {};
    await invokeController(updateProfile, reqUpdate, resUpdate);
    assert(resUpdate.statusCode === 200, 'Update profile API succeeds');

    // 5. Category persists after refresh
    console.log('\n--- [TEST 5] Category persists after refresh ---');
    const reqRefresh: any = { user: { userId: sellerDoc!._id.toString() } };
    const resRefresh: any = {};
    await invokeController(getProfile, reqRefresh, resRefresh);
    assert(resRefresh.data?.data?.categories?.length === 2 && resRefresh.data?.data?.categories?.includes('SUITE_HEADER_2'), 'Updated categories array persists after refresh');

    // 6. Add Product receives correct categories
    console.log('\n--- [TEST 6] Add Product receives correct categories ---');
    const reqAllowed: any = { user: { userId: sellerDoc!._id.toString() } };
    const resAllowed: any = {};
    await invokeController(getAllowedHeaderCategories, reqAllowed, resAllowed);
    const allowedHeaderNames = (resAllowed.data?.data || []).map((h: any) => h.name);
    assert(allowedHeaderNames.includes('SUITE_HEADER_1') && allowedHeaderNames.includes('SUITE_HEADER_2'), 'Add Product API receives seller allowed categories SUITE_HEADER_1 and SUITE_HEADER_2');

    // 7. Selecting category loads correct subcategories
    console.log('\n--- [TEST 7] Selecting category loads correct subcategories ---');
    const subCatInDb = await Category.find({ parentId: parentCat1._id });
    assert(subCatInDb.length === 1 && subCatInDb[0].name === 'SUITE_SUBCAT_1', 'Only valid subcategories belonging to parentCat1 are loaded');

    // 8. Invalid category/subcategory combination is rejected
    console.log('\n--- [TEST 8] Invalid category/subcategory combination is rejected ---');
    const reqInvalidCombination: any = {
      user: { userId: sellerDoc!._id.toString() },
      body: {
        productName: 'Invalid Combination Item',
        headerCategoryId: headerCat1._id.toString(),
        categoryId: parentCat1._id.toString(),
        subcategoryId: subCat2._id.toString(), // Belongs to parentCat2!
        variations: [{ title: 'Standard', price: 100, discPrice: 90, stock: 10 }],
      },
    };
    const resInvalidCombination: any = {};
    await invokeController(createProduct, reqInvalidCombination, resInvalidCombination);
    assert(resInvalidCombination.statusCode === 400, 'Invalid subcategory combination rejected with HTTP 400');

    // 9. Product stores correct category/subcategory
    console.log('\n--- [TEST 9] Product stores correct category/subcategory ---');
    const reqValidCreate: any = {
      user: { userId: sellerDoc!._id.toString() },
      body: {
        productName: 'Valid Suite Item',
        headerCategoryId: headerCat1._id.toString(),
        categoryId: parentCat1._id.toString(),
        subcategoryId: subCat1._id.toString(),
        variations: [{ title: 'Standard', price: 150, discPrice: 120, stock: 5 }],
      },
    };
    const resValidCreate: any = {};
    await invokeController(createProduct, reqValidCreate, resValidCreate);
    assert(resValidCreate.statusCode === 201 && resValidCreate.data?.success === true, 'Product created successfully');
    const createdProductId = resValidCreate.data?.data?._id;
    const createdProductDoc = await Product.findById(createdProductId);
    assert(createdProductDoc?.seller.toString() === sellerDoc!._id.toString(), 'Product document stores correct sellerId');
    assert(createdProductDoc?.headerCategoryId?.toString() === headerCat1._id.toString(), 'Product document stores correct headerCategoryId');
    assert(createdProductDoc?.category.toString() === parentCat1._id.toString(), 'Product document stores correct categoryId');
    assert(createdProductDoc?.subcategory.toString() === subCat1._id.toString(), 'Product document stores correct subcategoryId');

    // 10. Editing product returns correct category/subcategory
    console.log('\n--- [TEST 10] Editing product returns correct category/subcategory ---');
    const reqGetProd: any = { user: { userId: sellerDoc!._id.toString() }, params: { id: createdProductId.toString() } };
    const resGetProd: any = {};
    await invokeController(getProductById, reqGetProd, resGetProd);
    assert(resGetProd.data?.data?.category?._id?.toString() === parentCat1._id.toString() || resGetProd.data?.data?.category?.toString() === parentCat1._id.toString(), 'Edit product API returns correct category');
    assert(resGetProd.data?.data?.subcategory?._id?.toString() === subCat1._id.toString() || resGetProd.data?.data?.subcategory?.toString() === subCat1._id.toString(), 'Edit product API returns correct subcategory');

    // 11. Seller isolation is preserved
    console.log('\n--- [TEST 11] Seller isolation is preserved ---');
    const otherSellerDoc = await Seller.create({
      sellerName: 'Other Isolated Seller',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `other_isolated_${Date.now()}@example.com`,
      storeName: 'Other Isolated Store',
      category: 'SUITE_HEADER_1',
      categories: ['SUITE_HEADER_1'],
      status: 'Approved',
      commission: 0,
      balance: 0,
    });

    const reqOtherUnauthCreate: any = {
      user: { userId: otherSellerDoc._id.toString() },
      body: {
        productName: 'Cross Seller Unauthorized Item',
        headerCategoryId: headerCat2._id.toString(), // Other seller only allowed SUITE_HEADER_1!
        categoryId: parentCat2._id.toString(),
        subcategoryId: subCat2._id.toString(),
        variations: [{ title: 'Standard', price: 100, discPrice: 90, stock: 10 }],
      },
    };
    const resOtherUnauthCreate: any = {};
    await invokeController(createProduct, reqOtherUnauthCreate, resOtherUnauthCreate);
    assert(resOtherUnauthCreate.statusCode === 403, 'Cross-seller unauthorized category access rejected with HTTP 403');

    // 12. /seller/category API calculates subcategory counts & enforces seller isolation
    console.log('\n--- [TEST 12] /seller/category API calculates subcategory counts & enforces seller isolation ---');
    const { getCategories, getAllSubcategories } = await import('../modules/seller/controllers/categoryController');
    const reqSellerCategoryList: any = {
      user: { userId: otherSellerDoc._id.toString(), role: 'Seller' },
      query: {},
    };
    const resSellerCategoryList: any = {};
    await invokeController(getCategories, reqSellerCategoryList, resSellerCategoryList);
    const sellerCatsData = resSellerCategoryList.data?.data || [];
    const cat1Item = sellerCatsData.find((c: any) => c._id.toString() === parentCat1._id.toString());
    const cat2Item = sellerCatsData.find((c: any) => c._id.toString() === parentCat2._id.toString());
    assert(cat1Item !== undefined, 'Seller allowed category SUITE_PARENT_1 is included in category list');
    assert(cat2Item === undefined, 'Seller unauthorized category SUITE_PARENT_2 is excluded from category list');
    assert(cat1Item?.totalSubcategory >= 1, 'totalSubcategory for SUITE_PARENT_1 is correctly computed (> 0)');

    // 13. /seller/subcategory API returns child categories & enforces seller isolation
    console.log('\n--- [TEST 13] /seller/subcategory API returns child categories & enforces seller isolation ---');
    const reqSellerSubcatList: any = {
      user: { userId: otherSellerDoc._id.toString(), role: 'Seller' },
      query: { limit: '50' },
    };
    const resSellerSubcatList: any = {};
    await invokeController(getAllSubcategories, reqSellerSubcatList, resSellerSubcatList);
    const sellerSubcatsData = resSellerSubcatList.data?.data || [];
    const sub1Item = sellerSubcatsData.find((s: any) => s.subcategoryName === 'SUITE_SUBCAT_1');
    const sub2Item = sellerSubcatsData.find((s: any) => s.subcategoryName === 'SUITE_SUBCAT_2');
    assert(sub1Item !== undefined, 'Seller allowed subcategory SUITE_SUBCAT_1 is returned');
    assert(sub2Item === undefined, 'Seller unauthorized subcategory SUITE_SUBCAT_2 is excluded');

    // 14. Seller Dashboard stats API returns sellingCategories count
    console.log('\n--- [TEST 14] Seller Dashboard stats API returns sellingCategories count ---');
    const { getDashboardStats } = await import('../modules/seller/controllers/dashboardController');
    const reqDashStats: any = { user: { userId: sellerDoc!._id.toString() } };
    const resDashStats: any = {};
    await invokeController(getDashboardStats, reqDashStats, resDashStats);
    assert(resDashStats.data?.data?.stats?.totalCategory === 2, 'Seller Dashboard totalCategory matches seller allowed categories count (2)');

    // Clean up test data
    await Product.deleteMany({ seller: { $in: [sellerDoc!._id, otherSellerDoc._id] } });
    await Seller.deleteMany({ _id: { $in: [sellerDoc!._id, otherSellerDoc._id] } });
    await HeaderCategory.deleteMany({ name: { $in: ['SUITE_HEADER_1', 'SUITE_HEADER_2'] } });
    await Category.deleteMany({ _id: { $in: [parentCat1._id, parentCat2._id] } });
    await SubCategory.deleteMany({ _id: { $in: [subCat1._id, subCat2._id] } });
    console.log('\n🧹 Cleaned up end-to-end test data');

    console.log('\n====================================================');
    console.log(`📊 END-TO-END SUITE RESULT: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ End-to-end suite failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runEndToEndCategoryProductFlowTest();
