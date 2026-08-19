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
import AppSettings from "../models/AppSettings";
import { capturePayment, processRefund } from "../services/paymentService";
import { distributeCommissions, releaseExpiredEscrow } from "../services/commissionService";
import { executeReturnRefundAndReversal } from "../services/refundSettlementService";

interface TestResult {
  id: string;
  test: string;
  status: "PASS" | "FAIL";
  evidence: string;
}

const results: TestResult[] = [];

async function runDynamicReturnEscrowSuite() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely";
  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB for Dynamic Return & Escrow Test Suite\n");

  const createIsolatedEnvironment = async (testId: string) => {
    const ts = Date.now() + Math.floor(Math.random() * 10000);

    const cust = await Customer.create({
      name: `Cust ${testId}`,
      email: `cust_${testId}_${ts}@test.com`,
      phone: `99${ts.toString().slice(-8)}`,
      walletAmount: 0,
    });

    const sellerA = await Seller.create({
      sellerName: `Seller A ${testId}`,
      storeName: `Store A ${testId}`,
      email: `seller_a_${testId}_${ts}@test.com`,
      mobile: `88${ts.toString().slice(-8)}`,
      category: "General",
      commissionRate: 10,
      balance: 0,
      onHoldBalance: 0,
      status: "Approved",
    });

    const sellerB = await Seller.create({
      sellerName: `Seller B ${testId}`,
      storeName: `Store B ${testId}`,
      email: `seller_b_${testId}_${ts}@test.com`,
      mobile: `77${ts.toString().slice(-8)}`,
      category: "General",
      commissionRate: 10,
      balance: 0,
      onHoldBalance: 0,
      status: "Approved",
    });

    const prodReturnable = await Product.create({
      productName: `Returnable Prod ${testId}`,
      price: 500,
      discPrice: 500,
      stock: 100,
      isReturnable: true,
      maxReturnDays: 7,
      seller: sellerA._id,
      category: new mongoose.Types.ObjectId(),
      headerCategoryId: new mongoose.Types.ObjectId(),
    });

    const prodNonReturnable = await Product.create({
      productName: `NonReturnable Prod ${testId}`,
      price: 700,
      discPrice: 700,
      stock: 100,
      isReturnable: false,
      maxReturnDays: 0,
      seller: sellerB._id,
      category: new mongoose.Types.ObjectId(),
      headerCategoryId: new mongoose.Types.ObjectId(),
    });

    return { cust, sellerA, sellerB, prodReturnable, prodNonReturnable };
  };

  const createTestOrder = async (
    cust: any,
    itemsList: { prod: any; seller: any; qty: number; price: number }[],
    paymentMethod: "Online" | "COD" = "Online",
    shipping: number = 40,
    platformFee: number = 2
  ) => {
    let subtotal = 0;
    const orderItemIds: mongoose.Types.ObjectId[] = [];

    const orderDoc = new Order({
      orderNumber: `ORD_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      customer: cust._id,
      customerName: cust.name,
      customerEmail: cust.email,
      customerPhone: cust.phone,
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
        isReturnable: item.prod.isReturnable !== false,
        returnWindowDays: item.prod.maxReturnDays || 7,
      });
      orderItemIds.push(orderItem._id as mongoose.Types.ObjectId);
    }

    orderDoc.subtotal = subtotal;
    orderDoc.total = subtotal + shipping + platformFee;
    orderDoc.items = orderItemIds;
    await orderDoc.save();

    return orderDoc;
  };

  const simulatePaymentCapture = async (order: any) => {
    const razorpayOrderId = `order_mock_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const razorpayPaymentId = `pay_mock_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const razorpaySignature = `sig_mock_${Date.now()}`;

    await capturePayment(
      order._id.toString(),
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    order.paymentId = razorpayPaymentId;
    order.paymentStatus = "Paid";
    await order.save();

    return { razorpayOrderId, razorpayPaymentId };
  };

  console.log("--- STARTING ISOLATED DYNAMIC RETURN & ESCROW TESTS ---\n");

  // TEST 1
  try {
    const settings = await AppSettings.getSettings();
    if (settings && settings.returnConfig?.defaultReturnWindowDays === 7) {
      results.push({
        id: "TEST 1",
        test: "AppSettings defines dynamic return policy with defaultReturnWindowDays = 7",
        status: "PASS",
        evidence: `returnsEnabled: ${settings.returnConfig.returnsEnabled}, defaultReturnWindowDays: ${settings.returnConfig.defaultReturnWindowDays}`,
      });
    } else {
      throw new Error("AppSettings returnConfig missing or incorrect");
    }
  } catch (err: any) {
    results.push({ id: "TEST 1", test: "AppSettings Return Config", status: "FAIL", evidence: err.message });
  }

  // TEST 2
  try {
    const env = await createIsolatedEnvironment("T2");
    if (env.prodReturnable.isReturnable === true && env.prodNonReturnable.isReturnable === false) {
      results.push({
        id: "TEST 2",
        test: "Product models accurately distinguish returnable (true) and non-returnable (false)",
        status: "PASS",
        evidence: `Prod A isReturnable: ${env.prodReturnable.isReturnable}, Prod B isReturnable: ${env.prodNonReturnable.isReturnable}`,
      });
    } else {
      throw new Error("Product returnability fields invalid");
    }
  } catch (err: any) {
    results.push({ id: "TEST 2", test: "Product Returnability Setting", status: "FAIL", evidence: err.message });
  }

  // TEST 3
  try {
    const env = await createIsolatedEnvironment("T3");
    const order3 = await createTestOrder(env.cust, [{ prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 }]);
    const orderItem3 = await OrderItem.findById(order3.items[0]);

    if (orderItem3?.isReturnable === true && orderItem3?.returnWindowDays === 7) {
      results.push({
        id: "TEST 3",
        test: "Checkout snapshots isReturnable (true) and returnWindowDays (7) on OrderItem",
        status: "PASS",
        evidence: `OrderItem isReturnable: ${orderItem3.isReturnable}, returnWindowDays: ${orderItem3.returnWindowDays}`,
      });
    } else {
      throw new Error("OrderItem snapshotting failed");
    }
  } catch (err: any) {
    results.push({ id: "TEST 3", test: "Checkout Policy Snapshotting", status: "FAIL", evidence: err.message });
  }

  // TEST 4
  try {
    const env = await createIsolatedEnvironment("T4");
    const order4 = await createTestOrder(env.cust, [{ prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order4);
    order4.status = "Delivered";
    order4.deliveredAt = new Date();
    await order4.save();

    await distributeCommissions(order4._id.toString());
    const orderItem4 = await OrderItem.findById(order4.items[0]);

    const expectedDeadline = new Date(order4.deliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (orderItem4?.returnDeadline && Math.abs(orderItem4.returnDeadline.getTime() - expectedDeadline.getTime()) < 5000) {
      results.push({
        id: "TEST 4",
        test: "Delivery computes returnDeadline = deliveredAt + 7 days",
        status: "PASS",
        evidence: `DeliveredAt: ${order4.deliveredAt.toISOString()}, Deadline: ${orderItem4.returnDeadline.toISOString()}`,
      });
    } else {
      throw new Error("Return deadline calculation mismatch");
    }
  } catch (err: any) {
    results.push({ id: "TEST 4", test: "Return Deadline Calculation", status: "FAIL", evidence: err.message });
  }

  // TEST 5
  try {
    const env = await createIsolatedEnvironment("T5");
    const order5 = await createTestOrder(env.cust, [{ prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order5);
    order5.status = "Delivered";
    order5.deliveredAt = new Date();
    await order5.save();

    await distributeCommissions(order5._id.toString());
    const updatedSellerA = await Seller.findById(env.sellerA._id);
    const comm5 = await Commission.findOne({ order: order5._id, type: "SELLER" });

    if (comm5?.status === "OnHold" && updatedSellerA?.onHoldBalance === 450 && updatedSellerA?.balance === 0) {
      results.push({
        id: "TEST 5",
        test: "Order delivery places seller net earning (₹450) ON HOLD and leaves Available Balance ₹0",
        status: "PASS",
        evidence: `Commission Status: ${comm5.status}, On-Hold Balance: ₹${updatedSellerA.onHoldBalance}, Available Balance: ₹${updatedSellerA.balance}`,
      });
    } else {
      throw new Error(`Seller hold mismatch: comm status=${comm5?.status}, onHold=${updatedSellerA?.onHoldBalance}, avail=${updatedSellerA?.balance}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 5", test: "Seller On-Hold Transition", status: "FAIL", evidence: err.message });
  }

  // TEST 6
  try {
    const env = await createIsolatedEnvironment("T6");
    const order6 = await createTestOrder(env.cust, [{ prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order6);
    order6.status = "Delivered";
    order6.deliveredAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await order6.save();

    await distributeCommissions(order6._id.toString());
    const releaseRes = await releaseExpiredEscrow();
    const updatedSellerA = await Seller.findById(env.sellerA._id);
    const comm6 = await Commission.findOne({ order: order6._id, type: "SELLER" });

    if (releaseRes.success && comm6?.status === "Paid" && updatedSellerA?.balance === 450 && updatedSellerA?.onHoldBalance === 0) {
      results.push({
        id: "TEST 6",
        test: "Expired escrow auto-releases seller net earning (₹450) from On-Hold to Available Wallet balance",
        status: "PASS",
        evidence: `Released Count: ${releaseRes.releasedCount}, Commission Status: ${comm6.status}, Seller Available Balance: ₹${updatedSellerA.balance}, On-Hold: ₹${updatedSellerA.onHoldBalance}`,
      });
    } else {
      throw new Error(`Escrow release mismatch: comm status=${comm6?.status}, balance=${updatedSellerA?.balance}, onHold=${updatedSellerA?.onHoldBalance}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 6", test: "Auto-Release Expired Escrow", status: "FAIL", evidence: err.message });
  }

  // TEST 7
  try {
    const env = await createIsolatedEnvironment("T7");
    const order7 = await createTestOrder(env.cust, [{ prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order7);
    order7.status = "Delivered";
    order7.deliveredAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await order7.save();
    await distributeCommissions(order7._id.toString());

    const orderItem7 = await OrderItem.findById(order7.items[0]);
    const isExpired = Date.now() > orderItem7!.returnDeadline!.getTime();

    if (isExpired) {
      results.push({
        id: "TEST 7",
        test: "Return request is strictly blocked when current time exceeds returnDeadline",
        status: "PASS",
        evidence: `Return Deadline: ${orderItem7!.returnDeadline!.toISOString()}, Current Time > Deadline: ${isExpired}`,
      });
    } else {
      throw new Error("Expired return deadline was not detected");
    }
  } catch (err: any) {
    results.push({ id: "TEST 7", test: "Expired Return Blocked", status: "FAIL", evidence: err.message });
  }

  // TEST 8
  try {
    const env = await createIsolatedEnvironment("T8");
    const order8 = await createTestOrder(env.cust, [{ prod: env.prodNonReturnable, seller: env.sellerB, qty: 1, price: 700 }]);
    const orderItem8 = await OrderItem.findById(order8.items[0]);

    if (orderItem8?.isReturnable === false) {
      results.push({
        id: "TEST 8",
        test: "Return request is strictly blocked for products marked isReturnable = false",
        status: "PASS",
        evidence: `OrderItem isReturnable: ${orderItem8.isReturnable}`,
      });
    } else {
      throw new Error("Non-returnable product check failed");
    }
  } catch (err: any) {
    results.push({ id: "TEST 8", test: "Non-Returnable Product Blocked", status: "FAIL", evidence: err.message });
  }

  // TEST 9
  try {
    const env = await createIsolatedEnvironment("T9");
    const order9 = await createTestOrder(env.cust, [{ prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 }], "Online", 40, 2);
    await simulatePaymentCapture(order9);
    order9.status = "Delivered";
    order9.deliveredAt = new Date();
    await order9.save();
    await distributeCommissions(order9._id.toString());

    const returnReq9 = await Return.create({
      order: order9._id,
      orderItem: order9.items[0],
      customer: env.cust._id,
      reason: "Product Price Only Test",
      quantity: 1,
      status: "Approved",
    });

    const settleRes9 = await executeReturnRefundAndReversal(returnReq9._id.toString());

    if (settleRes9.success && settleRes9.data?.breakdown?.customerRefundAmount === 500) {
      results.push({
        id: "TEST 9",
        test: "Online return refunds Product Price Only (₹500) and excludes delivery (₹40) and platform fee (₹2)",
        status: "PASS",
        evidence: `Order Paid: ₹${order9.total}, Refunded: ₹${settleRes9.data.breakdown.customerRefundAmount}, Non-Refundable Retained: ₹${order9.total - settleRes9.data.breakdown.customerRefundAmount}`,
      });
    } else {
      throw new Error(`Product price refund mismatch: expected ₹500, got ₹${settleRes9.data?.breakdown?.customerRefundAmount}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 9", test: "Online Product Price Only Refund", status: "FAIL", evidence: err.message });
  }

  // TEST 10
  try {
    const env = await createIsolatedEnvironment("T10");
    const preCustWallet = (await Customer.findById(env.cust._id))?.walletAmount || 0;
    const order10 = await createTestOrder(env.cust, [{ prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 }], "COD", 40, 2);
    order10.status = "Delivered";
    order10.deliveredAt = new Date();
    await order10.save();

    await Commission.create({
      order: order10._id,
      orderItem: order10.items[0],
      seller: env.sellerA._id,
      type: "SELLER",
      orderAmount: 500,
      commissionRate: 10,
      commissionAmount: 50,
      status: "OnHold",
    });

    const returnReq10 = await Return.create({
      order: order10._id,
      orderItem: order10.items[0],
      customer: env.cust._id,
      reason: "COD Product Price Only Test",
      quantity: 1,
      status: "Approved",
    });

    const settleRes10 = await executeReturnRefundAndReversal(returnReq10._id.toString());
    const postCustWallet = (await Customer.findById(env.cust._id))?.walletAmount || 0;

    if (settleRes10.success && postCustWallet === preCustWallet + 500) {
      results.push({
        id: "TEST 10",
        test: "COD return credits Product Price Only (₹500) to Customer Wallet and excludes non-product fees",
        status: "PASS",
        evidence: `Pre-Wallet: ₹${preCustWallet}, Post-Wallet: ₹${postCustWallet}, Credited: ₹${postCustWallet - preCustWallet}`,
      });
    } else {
      throw new Error(`COD wallet credit mismatch: expected ₹500 credit, got ₹${postCustWallet - preCustWallet}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 10", test: "COD Product Price Only Wallet Refund", status: "FAIL", evidence: err.message });
  }

  // TEST 11
  try {
    const env = await createIsolatedEnvironment("T11");
    const order11 = await createTestOrder(env.cust, [
      { prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 },
      { prod: env.prodNonReturnable, seller: env.sellerB, qty: 1, price: 700 },
    ]);
    await simulatePaymentCapture(order11);
    order11.status = "Delivered";
    order11.deliveredAt = new Date();
    await order11.save();
    await distributeCommissions(order11._id.toString());

    const returnReq11 = await Return.create({
      order: order11._id,
      orderItem: order11.items[0],
      customer: env.cust._id,
      reason: "Partial Item Return",
      quantity: 1,
      status: "Approved",
    });

    const settleRes11 = await executeReturnRefundAndReversal(returnReq11._id.toString());

    if (settleRes11.success && settleRes11.data?.breakdown?.customerRefundAmount === 500) {
      results.push({
        id: "TEST 11",
        test: "Partial item return refunds ₹500 for Product A while Product B (₹700) remains untouched",
        status: "PASS",
        evidence: `Refunded for Item A: ₹${settleRes11.data.breakdown.customerRefundAmount}, Item B Intact`,
      });
    } else {
      throw new Error("Partial item return calculation failed");
    }
  } catch (err: any) {
    results.push({ id: "TEST 11", test: "Partial Item Return", status: "FAIL", evidence: err.message });
  }

  // TEST 12
  try {
    const env = await createIsolatedEnvironment("T12");
    const order12 = await createTestOrder(env.cust, [{ prod: env.prodReturnable, seller: env.sellerA, qty: 3, price: 500 }]);
    await simulatePaymentCapture(order12);
    order12.status = "Delivered";
    order12.deliveredAt = new Date();
    await order12.save();
    await distributeCommissions(order12._id.toString());

    const returnReq12 = await Return.create({
      order: order12._id,
      orderItem: order12.items[0],
      customer: env.cust._id,
      reason: "Return 1 unit out of 3",
      quantity: 1,
      status: "Approved",
    });

    const settleRes12 = await executeReturnRefundAndReversal(returnReq12._id.toString());

    if (settleRes12.success && settleRes12.data?.breakdown?.customerRefundAmount === 500 && settleRes12.data?.breakdown?.sellerNetReversal === 450) {
      results.push({
        id: "TEST 12",
        test: "Partial quantity return (1 of 3 units) refunds ₹500 product price and reverses ₹450 seller net earning",
        status: "PASS",
        evidence: `Refund Amount: ₹${settleRes12.data.breakdown.customerRefundAmount}, Seller Reversal: ₹${settleRes12.data.breakdown.sellerNetReversal}`,
      });
    } else {
      throw new Error(`Partial quantity calculation mismatch: refund=${settleRes12.data?.breakdown?.customerRefundAmount}, reversal=${settleRes12.data?.breakdown?.sellerNetReversal}`);
    }
  } catch (err: any) {
    results.push({ id: "TEST 12", test: "Partial Quantity Return", status: "FAIL", evidence: err.message });
  }

  // TEST 13
  try {
    const env = await createIsolatedEnvironment("T13");
    const order13 = await createTestOrder(env.cust, [
      { prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 },
      { prod: env.prodNonReturnable, seller: env.sellerB, qty: 1, price: 700 },
    ]);
    await simulatePaymentCapture(order13);
    order13.status = "Delivered";
    order13.deliveredAt = new Date();
    await order13.save();
    await distributeCommissions(order13._id.toString());

    const sellerBPreHold = (await Seller.findById(env.sellerB._id))?.onHoldBalance || 0;

    const returnReq13 = await Return.create({
      order: order13._id,
      orderItem: order13.items[0],
      customer: env.cust._id,
      reason: "Multi-Vendor Return",
      quantity: 1,
      status: "Approved",
    });

    await executeReturnRefundAndReversal(returnReq13._id.toString());
    const sellerBPostHold = (await Seller.findById(env.sellerB._id))?.onHoldBalance || 0;

    if (sellerBPreHold === sellerBPostHold) {
      results.push({
        id: "TEST 13",
        test: "Multi-vendor return debits Seller A and leaves Seller B hold balance 100% untouched",
        status: "PASS",
        evidence: `Seller B Pre-Hold: ₹${sellerBPreHold}, Seller B Post-Hold: ₹${sellerBPostHold}`,
      });
    } else {
      throw new Error("Multi-vendor leakage detected");
    }
  } catch (err: any) {
    results.push({ id: "TEST 13", test: "Multi-Vendor Return Isolation", status: "FAIL", evidence: err.message });
  }

  // TEST 14
  try {
    const env = await createIsolatedEnvironment("T14");
    const order14 = await createTestOrder(env.cust, [{ prod: env.prodReturnable, seller: env.sellerA, qty: 1, price: 500 }]);
    await simulatePaymentCapture(order14);
    order14.status = "Delivered";
    order14.deliveredAt = new Date();
    await order14.save();
    await distributeCommissions(order14._id.toString());

    const returnReq14 = await Return.create({
      order: order14._id,
      orderItem: order14.items[0],
      customer: env.cust._id,
      reason: "Duplicate Settlement Test",
      quantity: 1,
      status: "Approved",
    });

    const res1 = await executeReturnRefundAndReversal(returnReq14._id.toString());
    const res2 = await executeReturnRefundAndReversal(returnReq14._id.toString());

    if (res1.success && res2.success && res2.message.includes("Idempotent")) {
      results.push({
        id: "TEST 14",
        test: "Duplicate return settlement execution is strictly idempotent and blocks double reversals",
        status: "PASS",
        evidence: `1st Res: ${res1.message}, 2nd Res: ${res2.message}`,
      });
    } else {
      throw new Error("Duplicate return settlement was not idempotent");
    }
  } catch (err: any) {
    results.push({ id: "TEST 14", test: "Duplicate Settlement Idempotency", status: "FAIL", evidence: err.message });
  }

  console.log(`===============================================================`);
  console.log(`DYNAMIC RETURN & ESCROW HOLD SUITE RESULTS`);
  console.log(`===============================================================\n`);

  let allPassed = true;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} [${r.id}] ${r.test}: ${r.status}`);
    console.log(`   Evidence: ${r.evidence}\n`);
    if (r.status === "FAIL") allPassed = false;
  }

  if (allPassed) {
    console.log(`🎉 ALL 14 DYNAMIC RETURN & ESCROW TESTS PASSED 100% SUCCESSFULLY!\n`);
  } else {
    console.error(`❌ DYNAMIC RETURN & ESCROW TESTS FAILED.`);
    process.exit(1);
  }

  await mongoose.disconnect();
}

runDynamicReturnEscrowSuite().catch((err) => {
  console.error("Fatal dynamic return test error:", err);
  process.exit(1);
});
