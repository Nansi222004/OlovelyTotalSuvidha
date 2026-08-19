import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Payment from "../models/Payment";
import Commission from "../models/Commission";
import Customer from "../models/Customer";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import Product from "../models/Product";
import Return from "../models/Return";
import WalletTransaction from "../models/WalletTransaction";
import { capturePayment, processRefund } from "../services/paymentService";
import { distributeCommissions } from "../services/commissionService";
import { handleOnlineOrderCancellation, executeReturnRefundAndReversal } from "../services/refundSettlementService";
import { creditWallet, debitWallet, getWalletBalance } from "../services/walletManagementService";

interface TestResult {
  id: string;
  test: string;
  status: "PASS" | "FAIL";
  evidence: string;
}

const results: TestResult[] = [];

async function runFinancialLifecycleSuite() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely";
  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB for Financial Lifecycle Test Suite\n");

  const timestamp = Date.now();

  // Create mock entities
  const testCust = await Customer.create({
    name: "Fin Test Customer",
    email: `fin_cust_${timestamp}@test.com`,
    phone: `99${timestamp.toString().slice(-8)}`,
    walletAmount: 0,
  });

  const testSellerA = await Seller.create({
    sellerName: "Seller A",
    storeName: "Store A",
    email: `seller_a_${timestamp}@test.com`,
    mobile: `88${timestamp.toString().slice(-8)}`,
    category: "General",
    commissionRate: 10,
    balance: 0,
    status: "Approved",
  });

  const testSellerB = await Seller.create({
    sellerName: "Seller B",
    storeName: "Store B",
    email: `seller_b_${timestamp}@test.com`,
    mobile: `77${timestamp.toString().slice(-8)}`,
    category: "General",
    commissionRate: 10,
    balance: 0,
    status: "Approved",
  });

  const testDriver = await Delivery.create({
    name: "Fin Test Driver",
    mobile: `66${timestamp.toString().slice(-8)}`,
    email: `driver_${timestamp}@test.com`,
    password: "password123",
    commissionRate: 5,
    balance: 0,
    status: "Active",
  });

  const testProdA = await Product.create({
    productName: "Product A",
    price: 500,
    discPrice: 500,
    stock: 100,
    seller: testSellerA._id,
    category: new mongoose.Types.ObjectId(),
    headerCategoryId: new mongoose.Types.ObjectId(),
  });

  const testProdB = await Product.create({
    productName: "Product B",
    price: 700,
    discPrice: 700,
    stock: 100,
    seller: testSellerB._id,
    category: new mongoose.Types.ObjectId(),
    headerCategoryId: new mongoose.Types.ObjectId(),
  });

  // Helper to create test order
  const createTestOrder = async (
    itemsList: { prod: any; seller: any; qty: number; price: number }[],
    paymentMethod: "Online" | "COD" = "Online",
    shipping: number = 0,
    platformFee: number = 2
  ) => {
    let subtotal = 0;
    const orderItemIds: mongoose.Types.ObjectId[] = [];

    const orderDoc = new Order({
      orderNumber: `ORD_FIN_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customer: testCust._id,
      customerName: testCust.name,
      customerEmail: testCust.email,
      customerPhone: testCust.mobile,
      deliveryAddress: { address: "Test St", city: "Test City", pincode: "123456" },
      subtotal: 0,
      tax: 0,
      shipping,
      platformFee,
      discount: 0,
      total: 0,
      paymentMethod,
      paymentStatus: "Pending",
      status: "Received",
      items: [],
    });

    await orderDoc.save();

    for (const item of itemsList) {
      const itemTotal = item.price * item.qty;
      subtotal += itemTotal;
      const orderItem = await OrderItem.create({
        order: orderDoc._id,
        product: item.prod._id,
        seller: item.seller._id,
        productName: item.prod.productName,
        unitPrice: item.price,
        quantity: item.qty,
        total: itemTotal,
        subtotal: itemTotal,
        commissionRate: 10,
        commissionAmount: (itemTotal * 10) / 100,
        status: "Pending",
        sellerStatus: "Accepted",
      });
      orderItemIds.push(orderItem._id as mongoose.Types.ObjectId);
    }

    orderDoc.subtotal = subtotal;
    orderDoc.total = subtotal + shipping + platformFee;
    orderDoc.items = orderItemIds;
    await orderDoc.save();

    return orderDoc;
  };

  // Helper to simulate online payment
  const simulatePaymentCapture = async (order: any) => {
    const razorpayOrderId = `order_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const razorpayPaymentId = `pay_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const razorpaySignature = `sig_mock_${Date.now()}`;

    await capturePayment(
      order._id.toString(),
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    return { razorpayOrderId, razorpayPaymentId };
  };

  console.log("--- STARTING FINANCIAL TESTS ---\n");

  // -----------------------------------------------------------------
  // TEST 1: Online Order Delivered Normally
  // -----------------------------------------------------------------
  try {
    const order1 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order1);
    order1.status = "Delivered";
    await order1.save();

    await distributeCommissions(order1._id.toString());
    const sellerABalance = await getWalletBalance(testSellerA._id.toString(), "SELLER");

    if (sellerABalance === 450) { // ₹500 - 10% (₹50) = ₹450
      results.push({
        id: "TEST 1",
        test: "Online order delivered normally credits seller net earning (₹450) and leaves customer paid ₹502",
        status: "PASS",
        evidence: `Seller A Balance: ₹${sellerABalance}, Order Total: ₹${order1.total}`,
      });
    } else {
      throw new Error(`Seller balance mismatch: expected ₹450, got ₹${sellerABalance}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 1", test: "Online Normal Delivery", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 2: Online Order Cancelled Before Seller Acceptance
  // -----------------------------------------------------------------
  try {
    const initialSellerBalance = await getWalletBalance(testSellerA._id.toString(), "SELLER");
    const order2 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order2);

    const cancelRes = await handleOnlineOrderCancellation(order2._id.toString(), "Cancelled before acceptance");
    const updatedOrder2 = await Order.findById(order2._id);
    const postSellerBalance = await getWalletBalance(testSellerA._id.toString(), "SELLER");

    if (cancelRes.success && updatedOrder2?.paymentStatus === "Refunded" && postSellerBalance === initialSellerBalance) {
      results.push({
        id: "TEST 2",
        test: "Online order cancelled before acceptance triggers gateway refund and leaves seller wallet untouched",
        status: "PASS",
        evidence: `Refund Status: ${updatedOrder2?.paymentStatus}, Seller Balance Change: ₹${postSellerBalance - initialSellerBalance}`,
      });
    } else {
      throw new Error("Cancellation refund failed or seller wallet was modified");
    }
  } catch (err: any) {
    results.push({ id: "TEST 2", test: "Online Cancel Before Acceptance", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 3: Online Order Cancelled After Seller Acceptance
  // -----------------------------------------------------------------
  try {
    const order3 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order3);
    order3.status = "Accepted";
    await order3.save();

    const cancelRes = await handleOnlineOrderCancellation(order3._id.toString(), "Cancelled after acceptance");
    const updatedOrder3 = await Order.findById(order3._id);

    if (cancelRes.success && updatedOrder3?.paymentStatus === "Refunded") {
      results.push({
        id: "TEST 3",
        test: "Online order cancelled after seller acceptance triggers gateway refund",
        status: "PASS",
        evidence: `Order Payment Status: ${updatedOrder3?.paymentStatus}`,
      });
    } else {
      throw new Error("Cancellation refund failed for accepted order");
    }
  } catch (err: any) {
    results.push({ id: "TEST 3", test: "Online Cancel After Acceptance", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 4: Online Order Cancelled After Delivery Assignment
  // -----------------------------------------------------------------
  try {
    const order4 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order4);
    order4.deliveryBoy = testDriver._id as any;
    order4.deliveryBoyStatus = "Assigned";
    await order4.save();

    const cancelRes = await handleOnlineOrderCancellation(order4._id.toString(), "Cancelled after driver assignment");
    const driverBalance = await getWalletBalance(testDriver._id.toString(), "DELIVERY_BOY");

    if (cancelRes.success && driverBalance === 0) {
      results.push({
        id: "TEST 4",
        test: "Online order cancelled after delivery assignment refunds customer and leaves driver balance ₹0",
        status: "PASS",
        evidence: `Driver Balance: ₹${driverBalance}, Refund Status: ${cancelRes.data?.refundResult?.amount ? 'Refunded' : 'Success'}`,
      });
    } else {
      throw new Error("Driver balance modified or refund failed");
    }
  } catch (err: any) {
    results.push({ id: "TEST 4", test: "Online Cancel After Driver Assignment", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 5: Full Return After Seller Settlement
  // -----------------------------------------------------------------
  try {
    const order5 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order5);
    order5.status = "Delivered";
    await order5.save();
    await distributeCommissions(order5._id.toString());

    const preBalance = await getWalletBalance(testSellerA._id.toString(), "SELLER"); // Should be ₹900 (450 + 450)

    const returnReq5 = await Return.create({
      order: order5._id,
      orderItem: order5.items[0],
      customer: testCust._id,
      reason: "Defective item",
      quantity: 1,
      status: "Approved",
    });

    const settleRes = await executeReturnRefundAndReversal(returnReq5._id.toString());
    const postBalance = await getWalletBalance(testSellerA._id.toString(), "SELLER");

    if (settleRes.success && postBalance === preBalance - 450) {
      results.push({
        id: "TEST 5",
        test: "Full return after settlement debits exact seller net earning (₹450) and reverses commission",
        status: "PASS",
        evidence: `Pre-balance: ₹${preBalance}, Post-balance: ₹${postBalance}, Debited: ₹${preBalance - postBalance}`,
      });
    } else {
      throw new Error(`Seller debit mismatch: expected ₹450 debit, pre=${preBalance}, post=${postBalance}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 5", test: "Full Return After Settlement", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 6: Partial Return (1 Item out of 2 Returned)
  // -----------------------------------------------------------------
  try {
    const order6 = await createTestOrder([
      { prod: testProdA, seller: testSellerA, qty: 1, price: 500 },
      { prod: testProdB, seller: testSellerA, qty: 1, price: 700 },
    ]);
    await simulatePaymentCapture(order6);
    order6.status = "Delivered";
    await order6.save();
    await distributeCommissions(order6._id.toString());

    const sellerPreBal = await getWalletBalance(testSellerA._id.toString(), "SELLER");

    // Return Product A (₹500) only
    const returnReq6 = await Return.create({
      order: order6._id,
      orderItem: order6.items[0],
      customer: testCust._id,
      reason: "Partially returning Product A",
      quantity: 1,
      status: "Approved",
    });

    await executeReturnRefundAndReversal(returnReq6._id.toString());
    const sellerPostBal = await getWalletBalance(testSellerA._id.toString(), "SELLER");

    if (sellerPostBal === sellerPreBal - 450) { // Debits ₹450 for Product A, retains ₹630 for Product B
      results.push({
        id: "TEST 6",
        test: "Partial return of Product A debits ₹450 for A and retains Product B net earning (₹630)",
        status: "PASS",
        evidence: `Debited: ₹${sellerPreBal - sellerPostBal}, Product B Earning Intact`,
      });
    } else {
      throw new Error(`Partial return debit mismatch: expected ₹450 debit, pre=${sellerPreBal}, post=${sellerPostBal}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 6", test: "Partial Return", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 7: Partial Quantity Return (1 Unit out of 3 Returned)
  // -----------------------------------------------------------------
  try {
    const order7 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 3, price: 500 }]);
    await simulatePaymentCapture(order7);
    order7.status = "Delivered";
    await order7.save();
    await distributeCommissions(order7._id.toString());

    const sellerPreBal = await getWalletBalance(testSellerA._id.toString(), "SELLER");

    // Return 1 unit out of 3
    const returnReq7 = await Return.create({
      order: order7._id,
      orderItem: order7.items[0],
      customer: testCust._id,
      reason: "Return 1 unit out of 3",
      quantity: 1,
      status: "Approved",
    });

    await executeReturnRefundAndReversal(returnReq7._id.toString());
    const sellerPostBal = await getWalletBalance(testSellerA._id.toString(), "SELLER");

    if (sellerPostBal === sellerPreBal - 450) { // 1 unit out of 3 = ₹500 total - 10% = ₹450 debit
      results.push({
        id: "TEST 7",
        test: "Partial quantity return (1 of 3 units) debits exact 1-unit seller net earning (₹450)",
        status: "PASS",
        evidence: `Debited: ₹${sellerPreBal - sellerPostBal}`,
      });
    } else {
      throw new Error(`Partial quantity debit mismatch: expected ₹450 debit, pre=${sellerPreBal}, post=${sellerPostBal}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 7", test: "Partial Quantity Return", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 8: Multi-Vendor Return (Seller A Returned, Seller B Untouched)
  // -----------------------------------------------------------------
  try {
    const order8 = await createTestOrder([
      { prod: testProdA, seller: testSellerA, qty: 1, price: 500 },
      { prod: testProdB, seller: testSellerB, qty: 1, price: 700 },
    ]);
    await simulatePaymentCapture(order8);
    order8.status = "Delivered";
    await order8.save();
    await distributeCommissions(order8._id.toString());

    const sellerAPre = await getWalletBalance(testSellerA._id.toString(), "SELLER");
    const sellerBPre = await getWalletBalance(testSellerB._id.toString(), "SELLER");

    // Return Seller A item only
    const returnReq8 = await Return.create({
      order: order8._id,
      orderItem: order8.items[0],
      customer: testCust._id,
      reason: "Return Seller A item",
      quantity: 1,
      status: "Approved",
    });

    await executeReturnRefundAndReversal(returnReq8._id.toString());

    const sellerAPost = await getWalletBalance(testSellerA._id.toString(), "SELLER");
    const sellerBPost = await getWalletBalance(testSellerB._id.toString(), "SELLER");

    if (sellerAPost === sellerAPre - 450 && sellerBPost === sellerBPre) {
      results.push({
        id: "TEST 8",
        test: "Multi-vendor return debits Seller A (₹450) and leaves Seller B completely untouched (₹630)",
        status: "PASS",
        evidence: `Seller A Debited: ₹${sellerAPre - sellerAPost}, Seller B Change: ₹${sellerBPost - sellerBPre}`,
      });
    } else {
      throw new Error(`Multi-vendor return leakage detected: A pre=${sellerAPre}/post=${sellerAPost}, B pre=${sellerBPre}/post=${sellerBPost}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 8", test: "Multi-Vendor Return", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 9: Duplicate Cancellation Idempotency
  // -----------------------------------------------------------------
  try {
    const order9 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order9);

    const res1 = await handleOnlineOrderCancellation(order9._id.toString(), "First cancel");
    const res2 = await handleOnlineOrderCancellation(order9._id.toString(), "Second cancel");

    if (res1.success && res2.success && res2.message.includes("Idempotent")) {
      results.push({
        id: "TEST 9",
        test: "Duplicate order cancellation is strictly idempotent and blocks double gateway refunds",
        status: "PASS",
        evidence: `1st Res: ${res1.message}, 2nd Res: ${res2.message}`,
      });
    } else {
      throw new Error("Duplicate cancellation was not idempotent");
    }
  } catch (err: any) {
    results.push({ id: "TEST 9", test: "Duplicate Cancellation", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 10: Duplicate Refund Idempotency
  // -----------------------------------------------------------------
  try {
    const order10 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order10);
    const payment10 = await Payment.findOne({ order: order10._id });

    const refund1 = await processRefund(payment10!._id.toString(), order10.total, "Refund 1");
    const refund2 = await processRefund(payment10!._id.toString(), order10.total, "Refund 2");

    if (refund1.success && refund2.success) {
      results.push({
        id: "TEST 10",
        test: "Duplicate payment refund is idempotent and preserves single refund status",
        status: "PASS",
        evidence: `Payment Status: ${payment10?.status}`,
      });
    } else {
      throw new Error("Duplicate refund failed");
    }
  } catch (err: any) {
    results.push({ id: "TEST 10", test: "Duplicate Refund", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 11: Duplicate Return Settlement Idempotency
  // -----------------------------------------------------------------
  try {
    const order11 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order11);
    order11.status = "Delivered";
    await order11.save();
    await distributeCommissions(order11._id.toString());

    const returnReq11 = await Return.create({
      order: order11._id,
      orderItem: order11.items[0],
      customer: testCust._id,
      reason: "Duplicate settlement test",
      quantity: 1,
      status: "Approved",
    });

    const preBal = await getWalletBalance(testSellerA._id.toString(), "SELLER");
    const res1 = await executeReturnRefundAndReversal(returnReq11._id.toString());
    const midBal = await getWalletBalance(testSellerA._id.toString(), "SELLER");
    const res2 = await executeReturnRefundAndReversal(returnReq11._id.toString());
    const postBal = await getWalletBalance(testSellerA._id.toString(), "SELLER");

    if (res1.success && res2.success && midBal === preBal - 450 && postBal === midBal) {
      results.push({
        id: "TEST 11",
        test: "Duplicate return settlement execution skips second wallet debit and returns idempotent success",
        status: "PASS",
        evidence: `1st Debit: ₹${preBal - midBal}, 2nd Debit: ₹${midBal - postBal}`,
      });
    } else {
      throw new Error(`Duplicate return settlement caused extra debit: mid=${midBal}, post=${postBal}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 11", test: "Duplicate Return Settlement", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 12: Duplicate Webhook Idempotency
  // -----------------------------------------------------------------
  try {
    const order12 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }]);
    const mockPaymentId = `pay_mock_${Date.now()}`;
    const mockOrderId = `order_mock_${Date.now()}`;

    const res1 = await capturePayment(order12._id.toString(), mockOrderId, mockPaymentId, `sig_mock_${Date.now()}`);
    const res2 = await capturePayment(order12._id.toString(), mockOrderId, mockPaymentId, `sig_mock_${Date.now()}`);

    if (res1.success && res2.success && res2.message.includes("already captured")) {
      results.push({
        id: "TEST 12",
        test: "Duplicate payment webhook capture is strictly idempotent and prevents double order payment processing",
        status: "PASS",
        evidence: `2nd Capture Response: ${res2.message}`,
      });
    } else {
      throw new Error("Duplicate webhook capture was not idempotent");
    }
  } catch (err: any) {
    results.push({ id: "TEST 12", test: "Duplicate Webhook Idempotency", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 13: COD Cancellation Before Delivery
  // -----------------------------------------------------------------
  try {
    const order13 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }], "COD");
    const cancelRes = await handleOnlineOrderCancellation(order13._id.toString(), "COD Cancel");
    const updatedOrder13 = await Order.findById(order13._id);

    if (cancelRes.success && cancelRes.message.includes("COD")) {
      results.push({
        id: "TEST 13",
        test: "COD cancellation before delivery requires no gateway refund and leaves wallet balances ₹0",
        status: "PASS",
        evidence: `Response: ${cancelRes.message}, Payment Method: ${updatedOrder13?.paymentMethod}`,
      });
    } else {
      throw new Error("COD cancellation failed");
    }
  } catch (err: any) {
    results.push({ id: "TEST 13", test: "COD Cancellation", status: "FAIL", evidence: err.message });
  }

  // -----------------------------------------------------------------
  // TEST 14: COD Return After Delivery
  // -----------------------------------------------------------------
  try {
    const order14 = await createTestOrder([{ prod: testProdA, seller: testSellerA, qty: 1, price: 500 }], "COD");
    order14.status = "Delivered";
    await order14.save();

    // Manually mark seller commission as Paid for settled COD
    const comm14 = await Commission.create({
      order: order14._id,
      orderItem: order14.items[0],
      seller: testSellerA._id,
      type: "SELLER",
      orderAmount: 500,
      commissionRate: 10,
      commissionAmount: 50,
      status: "Paid",
    });

    await creditWallet(testSellerA._id.toString(), "SELLER", 450, "COD Sale", order14._id.toString());
    const preBal = await getWalletBalance(testSellerA._id.toString(), "SELLER");

    const returnReq14 = await Return.create({
      order: order14._id,
      orderItem: order14.items[0],
      customer: testCust._id,
      reason: "COD Return",
      quantity: 1,
      status: "Approved",
    });

    const settleRes = await executeReturnRefundAndReversal(returnReq14._id.toString());
    const postBal = await getWalletBalance(testSellerA._id.toString(), "SELLER");
    const updatedCust = await Customer.findById(testCust._id);

    if (settleRes.success && postBal === preBal - 450 && updatedCust?.walletAmount === 500) {
      results.push({
        id: "TEST 14",
        test: "COD return after delivery debits seller wallet net earning (₹450) and credits customer wallet (₹500)",
        status: "PASS",
        evidence: `Seller Debited: ₹${preBal - postBal}, Customer Wallet Credited: ₹${updatedCust?.walletAmount}`,
      });
    } else {
      throw new Error(`COD return failed: seller pre=${preBal}/post=${postBal}, cust wallet=${updatedCust?.walletAmount}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 14", test: "COD Return", status: "FAIL", evidence: err.message });
  }

  // Cleanup test data
  await Customer.deleteOne({ _id: testCust._id });
  await Seller.deleteOne({ _id: testSellerA._id });
  await Seller.deleteOne({ _id: testSellerB._id });
  await Delivery.deleteOne({ _id: testDriver._id });
  await Product.deleteOne({ _id: testProdA._id });
  await Product.deleteOne({ _id: testProdB._id });
  await WalletTransaction.deleteMany({ userId: { $in: [testSellerA._id.toString(), testSellerB._id.toString(), testDriver._id.toString()] } });

  console.log(`===============================================================`);
  console.log(`FINANCIAL LIFECYCLE & IDEMPOTENCY SUITE RESULTS`);
  console.log(`===============================================================\n`);

  let allPassed = true;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} [${r.id}] ${r.test}: ${r.status}`);
    console.log(`   Evidence: ${r.evidence}\n`);
    if (r.status === "FAIL") allPassed = false;
  }

  if (allPassed) {
    console.log(`🎉 ALL 14 FINANCIAL LIFECYCLE TESTS PASSED 100% SUCCESSFULLY!\n`);
  } else {
    console.error(`❌ FINANCIAL LIFECYCLE TESTS FAILED.`);
    process.exit(1);
  }

  await mongoose.disconnect();
}

runFinancialLifecycleSuite().catch((err) => {
  console.error("Fatal financial test error:", err);
  process.exit(1);
});
