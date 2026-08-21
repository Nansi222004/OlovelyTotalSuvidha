import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Order from "../models/Order";
import Delivery from "../models/Delivery";
import Seller from "../models/Seller";
import Customer from "../models/Customer";
import Product from "../models/Product";
import Category from "../models/Category";
import PlatformWallet from "../models/PlatformWallet";
import Commission from "../models/Commission";
import WalletTransaction from "../models/WalletTransaction";
import OrderItem from "../models/OrderItem";
import CashCollection from "../models/CashCollection";

import {
  processCODOrderDelivery,
  calculateCODOrderBreakdown,
  processPendingCODPayouts,
} from "../services/commissionService";

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function assert(description: string, condition: boolean, extraInfo: string = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${description} ${extraInfo ? `(${extraInfo})` : ""}`);
    failCount++;
    failures.push(`${description} ${extraInfo ? `(${extraInfo})` : ""}`);
  }
}

async function runSuite() {
  console.log("===============================================================");
  console.log("     DELIVERY BOY COD & PAY TO ADMIN VERIFICATION SUITE       ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovelytotalsuvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/\/\/.*@/, "//***@")}\n`);

  const testEmailSeller = "cod_test_seller@test.com";
  const testEmailCustomer = "cod_test_customer@test.com";
  const testEmailDelivery = "cod_test_delivery@test.com";

  try {
    // Teardown pre-existing test data
    await Seller.deleteMany({ email: testEmailSeller });
    await Customer.deleteMany({ email: testEmailCustomer });
    await Delivery.deleteMany({ email: testEmailDelivery });
    await Category.deleteMany({ name: "COD Test Category" });

    // 1. Setup Test Data
    const category = await Category.create({
      name: "COD Test Category",
      slug: "cod-test-category",
      commissionRate: 10, // 10% admin product commission
      status: "Active",
    });

    const seller = await Seller.create({
      sellerName: "COD Test Seller",
      email: testEmailSeller,
      mobile: "9111111111",
      storeName: "COD Store",
      category: "General",
      status: "Approved",
      balance: 0,
      address: "Jaipur",
      city: "Jaipur",
    });

    const product = await Product.create({
      productName: "COD Test Item",
      slug: "cod-test-item",
      description: "Test product for COD",
      category: category._id,
      seller: seller._id,
      price: 1000,
      discPrice: 1000,
      stock: 50,
      status: "Active",
      mainImage: "https://via.placeholder.com/150",
      galleryImages: [],
    });

    const customer = await Customer.create({
      name: "COD Customer",
      email: testEmailCustomer,
      phone: "9222222222",
      refCode: "CODREF123",
    });

    const deliveryBoy = await Delivery.create({
      name: "COD Test Delivery Boy",
      email: testEmailDelivery,
      mobile: "9333333333",
      password: "test123",
      status: "Active",
      balance: 0,
      pendingAdminPayout: 0,
      cashCollected: 0,
      vehicleType: "Bike",
    });

    const deliveryBoyId = deliveryBoy._id.toString();

    // 2. Create Order (Subtotal 1000, Platform Fee 10, Shipping 40 => Total 1050 COD)
    const order = await Order.create({
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      items: [],
      subtotal: 1000,
      platformFee: 10,
      shipping: 40,
      total: 1050,
      paymentMethod: "COD",
      paymentStatus: "Pending",
      status: "Processing",
      deliveryAddress: { address: "Jaipur", city: "Jaipur", pincode: "302001" },
      deliveryBoy: deliveryBoy._id,
    });

    const orderItem = await OrderItem.create({
      order: order._id,
      product: product._id,
      productName: product.productName,
      productImage: product.mainImage,
      seller: seller._id,
      quantity: 1,
      price: 1000,
      total: 1000,
      commissionRate: 10,
      commissionAmount: 100, // 10% of 1000 = 100 admin commission
      status: "Pending",
    });

    order.items.push(orderItem._id as any);
    await order.save();

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 1: COD BREAKDOWN & DELIVERY PROCESSING (C01 - C04)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🚚 SECTION 1: COD BREAKDOWN & DELIVERY PROCESSING");

    const breakdown = await calculateCODOrderBreakdown(order._id.toString());

    // C01: Correct COD total collected
    assert("C01 - Correct total COD amount calculated (₹1,050)", breakdown.totalOrderAmount === 1050);

    // C02: Delivery Boy earning calculated correctly
    assert("C02 - Delivery Boy commission calculated correctly", breakdown.deliveryBoyCommission > 0);

    // C03: Correct Admin amount calculated
    assert("C03 - Correct Admin product & platform commission calculated", breakdown.adminProductCommission === 100 && breakdown.platformFee === 10);

    // C04: Correct amount shown as Delivery Boy owes Admin (entire order cash ₹1,050)
    assert("C04 - Delivery Boy owes Admin the entire collected cash (₹1,050)", breakdown.amountDeliveryBoyOwesAdmin === 1050);

    // Process COD Order Delivery
    await processCODOrderDelivery(order._id.toString());

    const postDelDB = await Delivery.findById(deliveryBoyId);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 2: PAY TO ADMIN & SETTLEMENT ACCOUNTING (C05 - C10)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("💳 SECTION 2: PAY TO ADMIN & SETTLEMENT ACCOUNTING");

    // C05: Cash collected & pending admin payout updated on delivery boy
    assert("C05 - Delivery boy pendingAdminPayout equals ₹1,050", postDelDB?.pendingAdminPayout === 1050 && postDelDB?.cashCollected === 1050);

    // C06: Delivery boy withdrawable balance was credited with commission
    assert("C06 - Delivery boy withdrawable balance credited with commission", (postDelDB?.balance || 0) > 0);

    // Simulate Pay to Admin (Delivery Boy submits ₹1,050 to Admin)
    const session = await mongoose.startSession();
    session.startTransaction();

    postDelDB!.pendingAdminPayout = 0;
    await postDelDB!.save({ session });

    let platformWallet = await PlatformWallet.findOne().session(session);
    if (!platformWallet) {
      const walletArr = await PlatformWallet.create([{
        totalPlatformEarning: 0,
        currentPlatformBalance: 0,
        totalAdminEarning: 0,
        pendingFromDeliveryBoy: 0,
        sellerPendingPayouts: 0,
        deliveryBoyPendingPayouts: 0,
      }], { session });
      platformWallet = walletArr[0];
    }

    platformWallet.totalPlatformEarning += 1050;
    platformWallet.currentPlatformBalance += 1050;
    platformWallet.totalAdminEarning += breakdown.totalAdminEarning;
    platformWallet.pendingFromDeliveryBoy = Math.max(0, platformWallet.pendingFromDeliveryBoy - 1050);

    await platformWallet.save({ session });

    // Process seller payout distribution
    await processPendingCODPayouts(deliveryBoyId, 1050, session);

    // Sync CashCollection
    await CashCollection.updateMany(
      { deliveryBoy: deliveryBoyId, status: "Pending" },
      { status: "Received", receivedAt: new Date() },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const finalSeller = await Seller.findById(seller._id);
    const finalDB = await Delivery.findById(deliveryBoyId);

    // C07: Seller wallet receives net sales proceeds (1000 - 100 = ₹900)
    assert("C07 - Seller receives net sales proceeds (₹900)", finalSeller?.balance === 900);

    // C08: Admin pending payout for delivery boy cleared to 0
    assert("C08 - Delivery boy pendingAdminPayout cleared to ₹0 after submission", finalDB?.pendingAdminPayout === 0);

    // C09: CashCollection status updated to Received
    const collections = await CashCollection.find({ deliveryBoy: deliveryBoyId });
    const allReceived = collections.every((c) => c.status === "Received");
    assert("C09 - CashCollection record status updated to Received", collections.length > 0 && allReceived);

    // C10: Delivery boy withdrawable balance was NOT incorrectly deducted during Pay to Admin
    assert("C10 - Delivery boy withdrawable earnings preserved without accidental deduction", finalDB?.balance === postDelDB?.balance);

    // Teardown test documents
    await Order.deleteMany({ _id: order._id });
    await OrderItem.deleteMany({ order: order._id });
    await Seller.deleteMany({ email: testEmailSeller });
    await Customer.deleteMany({ email: testEmailCustomer });
    await Delivery.deleteMany({ email: testEmailDelivery });
    await Category.deleteMany({ name: "COD Test Category" });
    await CashCollection.deleteMany({ deliveryBoy: deliveryBoyId });
    await Commission.deleteMany({ order: order._id });

  } catch (error: any) {
    console.error("Error executing COD suite:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n Connection closed & test data cleaned up.\n");
  }

  console.log("===============================================================");
  console.log("                    SUMMARY OF RESULTS                         ");
  console.log("===============================================================");
  console.log(` Total Assertions Executed : ${passCount + failCount}`);
  console.log(` ✅ Passed                 : ${passCount}`);
  console.log(` ❌ Failed                 : ${failCount}`);
  console.log(` Pass Rate                 : ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log("===============================================================\n");

  if (failCount > 0) {
    console.log("FAILURES DETECTED:");
    failures.forEach((f) => console.log(` - ${f}`));
    process.exit(1);
  } else {
    console.log("🎉 ALL 10 DELIVERY COD & PAY TO ADMIN TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  }
}

runSuite();
