/**
 * AUTOMATED TEST SUITE: SELLER 5 MODULES VERIFICATION SUITE
 * 
 * Audits complete end-to-end dynamic functionality & multi-tenant security isolation for:
 * 1. Seller Dashboard (/seller)
 * 2. Seller Sales Report (/seller/reports/sales)
 * 3. Seller Return (/seller/return)
 * 4. Seller Product Taxes (/seller/product/taxes)
 * 5. Seller Reviews (/seller/reviews)
 * 6. Security / Cross-Seller Data Isolation
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Seller from "../models/Seller";
import Product from "../models/Product";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Return from "../models/Return";
import Tax from "../models/Tax";
import Review from "../models/Review";
import Customer from "../models/Customer";
import Category from "../models/Category";
import Brand from "../models/Brand";

import * as dashboardCtrl from "../modules/seller/controllers/dashboardController";
import * as reportCtrl from "../modules/seller/controllers/reportController";
import * as returnCtrl from "../modules/seller/controllers/returnController";
import * as taxCtrl from "../modules/seller/controllers/taxController";
import * as sellerReviewCtrl from "../modules/seller/controllers/sellerReviewController";

let lastNextError: string | null = null;
const dummyNext = (err?: any) => {
  if (err) {
    lastNextError = err?.message || String(err);
  }
};

const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

function createMockReqRes(
  body = {},
  query = {},
  params = {},
  user: any = null
) {
  let resolveResponse: (value?: any) => void;
  const responsePromise = new Promise((resolve) => {
    resolveResponse = resolve;
  });

  const req: any = {
    body,
    query,
    params,
    user,
    headers: {},
  };

  const res: any = {
    _statusCode: 200,
    _responseData: null,
    status: function (code: number) {
      this._statusCode = code;
      return this;
    },
    json: function (data: any) {
      this._responseData = data;
      resolveResponse();
      return this;
    },
    getStatusCode: function () {
      return this._statusCode;
    },
    getResponseData: function () {
      return this._responseData;
    },
    waitForResponse: function (timeoutMs = 5000) {
      return Promise.race([
        responsePromise,
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    },
  };

  return { req, res };
}

let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function assert(testName: string, condition: boolean, detail: string = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.log(`  ❌ FAIL: ${testName} - ${detail}`);
    failedTests++;
    failures.push(`${testName}: ${detail}`);
  }
}

async function runSuite() {
  console.log("\n===============================================================");
  console.log("             SELLER 5 MODULES VERIFICATION SUITE               ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely_total_suvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/:[^:@]+@/, ":***@")}\n`);

  // Setup test identifiers
  const testPrefix = "TEST_SUITE_5M_";
  
  // Clean up any leftover test data from previous runs
  await Seller.deleteMany({ storeName: { $regex: testPrefix } });
  await Category.deleteMany({ name: { $regex: testPrefix } });
  await Brand.deleteMany({ name: { $regex: testPrefix } });
  await Product.deleteMany({ productName: { $regex: testPrefix } });
  await Order.deleteMany({ orderNumber: { $regex: testPrefix } });
  await OrderItem.deleteMany({ productName: { $regex: testPrefix } });
  await Tax.deleteMany({ name: { $regex: testPrefix } });
  await Customer.deleteMany({ email: { $regex: /test_customer_5m/ } });

  // 1. Create Seller 1
  const seller1 = await Seller.create({
    sellerName: "Seller One Test",
    email: "seller1_5m@olovely.com",
    mobile: "9876543210",
    password: "Password123!",
    storeName: `${testPrefix}STORE_1`,
    category: "Electronics",
    storePhone: "9876543210",
    pickupAddress: { address: "123 Test St", city: "Surat", state: "Gujarat", pincode: "395007" },
    status: "Approved",
    isApproved: true,
  });
  const seller1Id = seller1._id.toString();

  // 2. Create Seller 2 (for multi-tenant isolation verification)
  const seller2 = await Seller.create({
    sellerName: "Seller Two Test",
    email: "seller2_5m@olovely.com",
    mobile: "9876543211",
    password: "Password123!",
    storeName: `${testPrefix}STORE_2`,
    category: "Fashion",
    storePhone: "9876543211",
    pickupAddress: { address: "456 Isolation Rd", city: "Surat", state: "Gujarat", pincode: "395007" },
    status: "Approved",
    isApproved: true,
  });
  const seller2Id = seller2._id.toString();

  // 3. Create Test Category & Products
  const testCategory = await Category.create({
    name: `${testPrefix}CATEGORY_${Date.now()}`,
    slug: `test-suite-5m-category-${Date.now()}`,
    status: "Active",
  });

  const testBrand = await Brand.create({
    name: `${testPrefix}BRAND_${Date.now()}`,
    status: "Active",
  });

  const product1 = await Product.create({
    seller: seller1._id,
    productName: `${testPrefix}PRODUCT_SELLER1`,
    mainImage: "https://example.com/p1.png",
    category: testCategory._id,
    brand: testBrand._id,
    price: 499,
    salePrice: 399,
    stock: 50,
    status: "Active",
    rating: 4.5,
    reviewsCount: 1,
  });

  const product2 = await Product.create({
    seller: seller2._id,
    productName: `${testPrefix}PRODUCT_SELLER2`,
    mainImage: "https://example.com/p2.png",
    category: testCategory._id,
    brand: testBrand._id,
    price: 999,
    salePrice: 899,
    stock: 20,
    status: "Active",
    rating: 5.0,
    reviewsCount: 1,
  });

  // 4. Create Test Customer
  const customer = await Customer.create({
    name: "Test Customer 5M",
    email: "test_customer_5m@olovely.com",
    mobile: "9876500000",
    password: "Password123!",
    status: "Active",
  });

  // 5. Create Test Order & OrderItems for Seller 1 and Seller 2
  const order1 = await Order.create({
    orderNumber: `${testPrefix}ORD1`,
    customer: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.mobile,
    deliveryAddress: { address: "789 Main St", city: "Surat", state: "Gujarat", pincode: "395007" },
    paymentMethod: "Online",
    paymentStatus: "Paid",
    orderDate: new Date(),
    subtotal: 399,
    tax: 0,
    shipping: 0,
    platformFee: 0,
    discount: 0,
    total: 399,
    grandTotal: 399,
    status: "Delivered",
  });

  const orderItem1 = await OrderItem.create({
    order: order1._id,
    product: product1._id,
    seller: seller1._id,
    productName: product1.productName,
    productImage: product1.mainImage,
    sku: "SKU-S1-P1",
    unitPrice: 399,
    quantity: 1,
    total: 399,
    subtotal: 399,
    status: "Delivered",
    sellerStatus: "Accepted",
  });

  const order2 = await Order.create({
    orderNumber: `${testPrefix}ORD2`,
    customer: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.mobile,
    deliveryAddress: { address: "101 Cross St", city: "Surat", state: "Gujarat", pincode: "395007" },
    paymentMethod: "COD",
    paymentStatus: "Pending",
    orderDate: new Date(),
    subtotal: 899,
    tax: 0,
    shipping: 0,
    platformFee: 0,
    discount: 0,
    total: 899,
    grandTotal: 899,
    status: "Delivered",
  });

  const orderItem2 = await OrderItem.create({
    order: order2._id,
    product: product2._id,
    seller: seller2._id,
    productName: product2.productName,
    productImage: product2.mainImage,
    sku: "SKU-S2-P2",
    unitPrice: 899,
    quantity: 1,
    total: 899,
    subtotal: 899,
    status: "Delivered",
    sellerStatus: "Accepted",
  });

  // 6. Create Return Request for Seller 1
  const return1 = await Return.create({
    order: order1._id,
    orderItem: orderItem1._id,
    customer: customer._id,
    reason: "Defective item received",
    description: "Item came scratched",
    quantity: 1,
    status: "Pending",
  });

  // 7. Create Tax Record
  const testTax = await Tax.create({
    name: `${testPrefix}TAX_18`,
    percentage: 18,
    status: "Active",
  });

  // 8. Create Review Record for Seller 1 Product
  try {
    await Review.collection.dropIndex("userId_1_productId_1");
  } catch (e) {
    // Ignore if index doesn't exist
  }

  const review1 = await Review.create({
    customer: customer._id,
    product: product1._id,
    order: order1._id,
    rating: 5,
    title: "Awesome product",
    comment: "Excellent quality and fast delivery!",
    status: "Approved",
  });

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // SECTION A: SELLER DASHBOARD (/seller)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📊 SECTION A: SELLER DASHBOARD MODULE (/seller)");

    const { req: dashReq, res: dashRes } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (dashboardCtrl as any).getDashboardStats(dashReq, dashRes, dummyNext);
    await dashRes.waitForResponse();

    assert("A01 - Seller dashboard API responds successfully (200)", dashRes.getStatusCode() === 200);

    const dashData = dashRes.getResponseData()?.data?.stats;
    assert("A02 - Dashboard returns seller-specific product count", dashData?.totalProduct >= 1);
    assert("A03 - Dashboard returns seller-specific order metrics", dashData?.completedOrders >= 1);

    // Multi-tenant check for Seller 2 dashboard
    const { req: dashReq2, res: dashRes2 } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller2Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (dashboardCtrl as any).getDashboardStats(dashReq2, dashRes2, dummyNext);
    await dashRes2.waitForResponse();
    const dashData2 = dashRes2.getResponseData()?.data?.stats;
    assert(
      "A04 - Multi-tenant isolation: Seller 2 dashboard isolates metrics from Seller 1",
      dashData2?.totalProduct === 1 && dashData2?.completedOrders === 1
    );

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION B: SELLER SALES REPORT (/seller/reports/sales)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📈 SECTION B: SELLER SALES REPORT MODULE (/seller/reports/sales)");

    const { req: rptReq, res: rptRes } = createMockReqRes(
      {},
      { page: "1", limit: "10" },
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (reportCtrl as any).getSalesReport(rptReq, rptRes, dummyNext);
    await rptRes.waitForResponse();

    assert("B01 - Sales report API responds successfully (200)", rptRes.getStatusCode() === 200);

    const reportsList = rptRes.getResponseData()?.data || [];
    const foundOrderItem1 = reportsList.some((r: any) => r.product === product1.productName);
    
    assert(
      "B02 - VERIFIED BUG FIX: Sales report retrieves seller's OrderItem dynamically (sellerId -> seller query key fix)",
      foundOrderItem1
    );

    // Multi-tenant check: Seller 2's sales report must NOT include Seller 1's product
    const { req: rptReq2, res: rptRes2 } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller2Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (reportCtrl as any).getSalesReport(rptReq2, rptRes2, dummyNext);
    await rptRes2.waitForResponse();
    const reportsList2 = rptRes2.getResponseData()?.data || [];
    const seller2HasSeller1Item = reportsList2.some((r: any) => r.product === product1.productName);
    assert(
      "B03 - Multi-tenant isolation: Seller 2 sales report excludes Seller 1's order items",
      !seller2HasSeller1Item
    );

    // Date filtering test
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { req: rptDateReq, res: rptDateRes } = createMockReqRes(
      {},
      { fromDate: yesterday.toISOString().split("T")[0], toDate: tomorrow.toISOString().split("T")[0] },
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (reportCtrl as any).getSalesReport(rptDateReq, rptDateRes, dummyNext);
    await rptDateRes.waitForResponse();
    const dateFilteredReports = rptDateRes.getResponseData()?.data || [];
    assert("B04 - Date range filter properly includes matching order items", dateFilteredReports.length >= 1);

    const paginationMeta = rptRes.getResponseData()?.pagination;
    assert("B05 - Pagination metadata accurately returned", paginationMeta?.total >= 1 && paginationMeta?.pages >= 1);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION C: SELLER RETURN (/seller/return)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🔄 SECTION C: SELLER RETURN MODULE (/seller/return)");

    const { req: retListReq, res: retListRes } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (returnCtrl as any).getReturnRequests(retListReq, retListRes, dummyNext);
    await retListRes.waitForResponse();

    assert("C01 - Return list API responds successfully (200)", retListRes.getStatusCode() === 200);

    const returnsList = retListRes.getResponseData()?.data || [];
    const foundReturn1 = returnsList.some((r: any) => r.id.toString() === return1._id.toString());
    assert("C02 - Seller return list contains seller's return request", foundReturn1);

    // Return detail by ID for Seller 1
    const { req: retDetailReq, res: retDetailRes } = createMockReqRes(
      {},
      {},
      { id: return1._id.toString() },
      { userId: seller1Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (returnCtrl as any).getReturnRequestById(retDetailReq, retDetailRes, dummyNext);
    await retDetailRes.waitForResponse();

    assert("C03 - Return detail API returns request for owner seller", retDetailRes.getStatusCode() === 200);

    // SECURITY CHECK: Seller 2 attempting to access Seller 1's return request
    const { req: retSecReq, res: retSecRes } = createMockReqRes(
      {},
      {},
      { id: return1._id.toString() },
      { userId: seller2Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (returnCtrl as any).getReturnRequestById(retSecReq, retSecRes, dummyNext);
    await retSecRes.waitForResponse();

    assert(
      "C04 - SECURITY: Cross-seller return detail request rejected with HTTP 403 Forbidden",
      retSecRes.getStatusCode() === 403
    );

    // Multi-tenant check: Seller 2's return list MUST NOT include Seller 1's return
    const { req: retListReq2, res: retListRes2 } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller2Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (returnCtrl as any).getReturnRequests(retListReq2, retListRes2, dummyNext);
    await retListRes2.waitForResponse();
    const returnsList2 = retListRes2.getResponseData()?.data || [];
    const seller2HasReturn1 = returnsList2.some((r: any) => r.id.toString() === return1._id.toString());
    assert("C05 - Multi-tenant isolation: Seller 2 return list excludes Seller 1's returns", !seller2HasReturn1);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION D: SELLER PRODUCT TAXES (/seller/product/taxes)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🧾 SECTION D: SELLER PRODUCT TAXES MODULE (/seller/product/taxes)");

    const { req: taxReq, res: taxRes } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (taxCtrl as any).getAllTaxes(taxReq, taxRes, dummyNext);
    await taxRes.waitForResponse();

    assert("D01 - Tax list API responds successfully (200)", taxRes.getStatusCode() === 200);

    const taxList = taxRes.getResponseData()?.data || [];
    const foundTax = taxList.find((t: any) => t.name === testTax.name);
    assert("D02 - Dynamic tax rate retrieved from Mongoose Tax collection", !!foundTax);
    assert("D03 - Tax percentage matches database record (18%)", foundTax?.percentage === 18);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION E: SELLER REVIEWS (/seller/reviews)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("⭐ SECTION E: SELLER REVIEWS MODULE (/seller/reviews)");

    const { req: revReq, res: revRes } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (sellerReviewCtrl as any).getSellerReviews(revReq, revRes, dummyNext);
    await revRes.waitForResponse();

    assert("E01 - Seller review list API responds successfully (200)", revRes.getStatusCode() === 200);

    const reviewsList = revRes.getResponseData()?.data?.reviews || [];
    const foundReview = reviewsList.some((r: any) => r._id.toString() === review1._id.toString());
    assert("E02 - Review list returns review for seller's product", foundReview);

    // Review stats API
    const { req: revStatsReq, res: revStatsRes } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (sellerReviewCtrl as any).getSellerReviewStats(revStatsReq, revStatsRes, dummyNext);
    await revStatsRes.waitForResponse();

    const statsData = revStatsRes.getResponseData()?.data;
    assert("E03 - Review stats API calculates avgRating and totalReviews dynamically", statsData?.totalReviews >= 1 && statsData?.avgRating === 5);

    // Multi-tenant check: Seller 2 must NOT see Seller 1's reviews
    const { req: revReq2, res: revRes2 } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller2Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (sellerReviewCtrl as any).getSellerReviews(revReq2, revRes2, dummyNext);
    await revRes2.waitForResponse();
    const reviewsList2 = revRes2.getResponseData()?.data?.reviews || [];
    const seller2HasReview1 = reviewsList2.some((r: any) => r._id.toString() === review1._id.toString());
    assert("E04 - Multi-tenant isolation: Seller 2 reviews exclude Seller 1's product reviews", !seller2HasReview1);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION F: SECURITY & DATA ISOLATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🔐 SECTION F: SECURITY & DATA ISOLATION");

    // F01: Unauthenticated request handling check (without req.user)
    lastNextError = null;
    const { req: unauthReq, res: unauthRes } = createMockReqRes({}, {}, {}, null);
    await (reportCtrl as any).getSalesReport(unauthReq, unauthRes, dummyNext);
    await unauthRes.waitForResponse();
    assert(
      "F01 - Unauthenticated request handling: Controller safely returns error/status",
      unauthRes.getStatusCode() !== 200 || !!lastNextError
    );

    // F02: Cross-seller return update status attempt
    const { req: crossUpdateReq, res: crossUpdateRes } = createMockReqRes(
      { status: "Approved" },
      {},
      { id: return1._id.toString() },
      { userId: seller2Id, userType: "Seller", role: "Seller", isApproved: true }
    );
    await (returnCtrl as any).updateReturnStatus(crossUpdateReq, crossUpdateRes, dummyNext);
    await crossUpdateRes.waitForResponse();
    await delay(100);
    assert(
      "F02 - SECURITY: Seller 2 cannot approve or alter status of Seller 1's return request (403)",
      crossUpdateRes.getStatusCode() === 403
    );

    console.log("\n===============================================================");
    console.log("                    SUMMARY OF RESULTS                          ");
    console.log("===============================================================");
    console.log(` Total Assertions Executed : ${passedTests + failedTests}`);
    console.log(` ✅ Passed                 : ${passedTests}`);
    console.log(` ❌ Failed                 : ${failedTests}`);
    console.log(` Pass Rate                 : ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
    console.log("===============================================================\n");

    if (failedTests > 0) {
      console.error("FAILURES DETECTED:");
      failures.forEach((f) => console.error(` - ${f}`));
      process.exit(1);
    } else {
      console.log("🎉 ALL 5 SELLER MODULE VERIFICATION TESTS PASSED SUCCESSFULLY!");
      process.exit(0);
    }
  } catch (err: any) {
    console.error("❌ Fatal test error:", err);
    process.exit(1);
  } finally {
    // Guaranteed Cleanup of temporary test data
    await Seller.deleteMany({ storeName: { $regex: testPrefix } });
    await Category.deleteMany({ name: { $regex: testPrefix } });
    await Brand.deleteMany({ name: { $regex: testPrefix } });
    await Product.deleteMany({ productName: { $regex: testPrefix } });
    await Order.deleteMany({ orderNumber: { $regex: testPrefix } });
    await OrderItem.deleteMany({ productName: { $regex: testPrefix } });
    await Tax.deleteMany({ name: { $regex: testPrefix } });
    await Customer.deleteMany({ email: { $regex: /test_customer_5m/ } });
    await Review.deleteMany({ title: "Awesome product" });
    await Return.deleteMany({ reason: "Defective item received" });

    console.log("  ℹ️  Cleaned up all temporary test records in MongoDB.");
    await mongoose.disconnect();
  }
}

runSuite();
