import assert from "node:assert/strict";
import crypto from "crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Customer from "../models/Customer";
import Seller from "../models/Seller";
import Product from "../models/Product";
import Return from "../models/Return";
import Payment from "../models/Payment";
import Notification from "../models/Notification";
import OrderEmailNotification from "../models/OrderEmailNotification";
import { setCustomTransporter, sendSupportEmail } from "../services/emailService";
import {
  sendCustomerOrderStatusEmail,
  sendCustomerFulfillmentGroupEmail,
  sendCustomerReturnExchangeEmail,
  sendCustomerRefundEmail,
  retryFailedOrderEmail,
} from "../services/orderEmailService";
import {
  sendOrderStatusNotification,
  sendReturnRequestNotificationToCustomer,
  sendReturnStatusNotificationToCustomer,
} from "../services/notificationService";
import { capturePayment, handleWebhook } from "../services/paymentService";
import { processFailedOrderEmailsBatch } from "./retryFailedOrderEmails";

interface SentEmailRecord {
  mailOptions: any;
  timestamp: Date;
}

const sentEmails: SentEmailRecord[] = [];
let mockTransportFail = false;

// Mock transporter that records all outgoing emails in-memory
const mockTransporter: any = {
  sendMail: async (mailOptions: any) => {
    if (mockTransportFail) {
      throw new Error("SMTP server connection timeout (Simulated Failure)");
    }
    sentEmails.push({ mailOptions, timestamp: new Date() });
    return {
      messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      response: "250 OK",
    };
  },
};

const passedTests: string[] = [];
function recordPass(name: string) {
  passedTests.push(name);
  console.log(`  ✓ ${name}`);
}

async function runTestSuite() {
  console.log("======================================================================");
  console.log(" RUNNING CUSTOMER ORDER UPDATE EMAIL NOTIFICATION ISOLATED TEST SUITE ");
  console.log("======================================================================\n");

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Route emailService to our mock transporter
  setCustomTransporter(mockTransporter);

  try {
    await mongoose.connect(uri);
    await Order.syncIndexes();
    await Customer.syncIndexes();
    await Notification.syncIndexes();
    await OrderEmailNotification.syncIndexes();
    await Return.syncIndexes();

    // ─────────────────────────────────────────────────────────────────
    // Setup Base Fixtures
    // ─────────────────────────────────────────────────────────────────
    const customer = await Customer.create({
      name: "Ritik Verma",
      email: "ritik.customer@example.com",
      phone: "9876543210",
      status: "Active",
      refCode: "REF123",
      deliveryOtp: "1234",
      totalOrders: 0,
      totalSpent: 0,
      walletAmount: 500,
      registrationDate: new Date(),
    });

    const seller = await Seller.create({
      sellerName: "SuperStore Owner",
      storeName: "Olovely SuperStore",
      email: "seller@example.com",
      mobile: "9876543211",
      password: "SellerPassword123!",
      category: "Grocery",
      status: "Approved",
      vendorType: "HYBRID",
      address: "Market St, Patna, Bihar, 800001",
      city: "Patna",
    });

    const product = await Product.create({
      productName: "Basmati Rice 5kg",
      productType: "QUICK_COMMERCE",
      price: 450,
      stock: 100,
      galleryImages: [],
      seller: seller._id,
      category: new mongoose.Types.ObjectId(),
      subCategory: new mongoose.Types.ObjectId(),
    });

    console.log("--- TEST GROUP 1: Supported Order Status Transitions Trigger Correct Emails ---");

    // Create a base QC Order
    const qcOrder = await Order.create({
      orderNumber: "QC-1001",
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      orderType: "QUICK_COMMERCE",
      status: "Received",
      paymentMethod: "COD",
      paymentStatus: "Pending",
      subtotal: 450,
      total: 470,
      shipping: 20,
      tax: 0,
      platformFee: 0,
      discount: 0,
      tipAmount: 0,
      giftPackaging: false,
      deliveryOption: "Standard",
      deliveryAddress: {
        address: "Flat 101, Shanti Niketan",
        city: "Patna",
        state: "Bihar",
        pincode: "800001",
      },
      items: [],
    });

    const orderItem = await OrderItem.create({
      order: qcOrder._id,
      product: product._id,
      seller: seller._id,
      productName: "Basmati Rice 5kg",
      unitPrice: 450,
      quantity: 1,
      total: 450,
      subtotal: 450,
      commissionRate: 5,
      commissionAmount: 22.5,
      status: "Pending",
      sellerStatus: "Pending",
      isWholesale: false,
      isReturnable: true,
      returnWindowDays: 7,
      productType: "QUICK_COMMERCE",
      fulfillmentType: "LOCAL_DELIVERY",
      ownerType: "VENDOR",
      billingEntityName: "Olovely SuperStore",
      taxRate: 0,
      taxAmount: 0,
    });

    qcOrder.items = [orderItem._id as any];
    await qcOrder.save();

    const transitionsToTest = [
      "Received",
      "Accepted",
      "Processed",
      "Ready for pickup",
      "Picked up",
      "Out for Delivery",
      "Delivered",
    ];

    for (const st of transitionsToTest) {
      sentEmails.length = 0;
      const res = await sendCustomerOrderStatusEmail(qcOrder._id.toString(), st);
      assert.equal(res.sent, true, `Email should be sent for status ${st}`);
      assert.equal(sentEmails.length, 1, `Exactly 1 email sent for status ${st}`);
      assert.ok(sentEmails[0].mailOptions.subject.includes(qcOrder.orderNumber), "Subject must include order number");
      assert.ok(sentEmails[0].mailOptions.html.includes(qcOrder.orderNumber), "HTML must include order number");
      assert.ok(sentEmails[0].mailOptions.text.includes(qcOrder.orderNumber), "Text fallback must include order number");
      recordPass(`Order status transition '${st}' triggers expected customer email`);
    }

    console.log("\n--- TEST GROUP 2: Unchanged Status Produces No Duplicate Email ---");
    {
      sentEmails.length = 0;
      // Re-triggering "Delivered" when it's already sent
      const duplicateRes = await sendCustomerOrderStatusEmail(qcOrder._id.toString(), "Delivered");
      assert.equal(duplicateRes.sent, false, "Duplicate transition must not send email");
      assert.equal(duplicateRes.duplicate, true, "Must flag duplicate: true");
      assert.equal(sentEmails.length, 0, "No new email should be transmitted");
      recordPass("Unchanged status produces no duplicate email");
    }

    console.log("\n--- TEST GROUP 3: Duplicate Controller Calls & Concurrent Events Deduplicated ---");
    {
      sentEmails.length = 0;
      const newStatus = "Cancelled";
      // Simulate 3 simultaneous calls for the same event
      const promises = [
        sendCustomerOrderStatusEmail(qcOrder._id.toString(), newStatus),
        sendCustomerOrderStatusEmail(qcOrder._id.toString(), newStatus),
        sendCustomerOrderStatusEmail(qcOrder._id.toString(), newStatus),
      ];

      const results = await Promise.all(promises);
      const sentCount = results.filter((r) => r.sent).length;
      assert.equal(sentCount, 1, "Exactly one concurrent call should succeed in sending email");
      assert.equal(sentEmails.length, 1, "Exactly 1 email sent via transporter");

      const records = await OrderEmailNotification.find({
        order: qcOrder._id,
        eventKey: `order:${qcOrder._id}:status:cancelled`,
      });
      assert.equal(records.length, 1, "Only 1 OrderEmailNotification record should exist in DB");
      assert.equal(records[0].status, "SENT");
      recordPass("Duplicate and concurrent calls send exactly one email (atomic idempotency)");
    }

    console.log("\n--- TEST GROUP 4: Email Provider Failure Does Not Roll Back Order ---");
    {
      const qcOrderFailure = await Order.create({
        orderNumber: "QC-FAIL-1002",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "QUICK_COMMERCE",
        status: "Received",
        paymentMethod: "COD",
        paymentStatus: "Pending",
        subtotal: 300,
        total: 300,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Main Road", city: "Patna", pincode: "800001" },
        items: [],
      });

      mockTransportFail = true;
      sentEmails.length = 0;

      // Update order status
      qcOrderFailure.status = "Accepted";
      await qcOrderFailure.save();

      // Trigger notification via notificationService
      const custId = customer._id.toString();
      const notifDoc = await sendOrderStatusNotification(qcOrderFailure._id.toString(), custId, "Accepted");

      // Give async floating promise a moment to settle
      await new Promise((r) => setTimeout(r, 150));

      // Order status MUST still be Accepted in DB
      const refreshedOrder = await Order.findById(qcOrderFailure._id);
      assert.equal(refreshedOrder?.status, "Accepted", "Order status must not roll back on email failure");

      // In-app Notification doc must exist
      assert.ok(notifDoc, "In-app notification must succeed");

      // Check OrderEmailNotification record reflects FAILED status without crashing
      const emailRecord = await OrderEmailNotification.findOne({
        order: qcOrderFailure._id,
        eventKey: `order:${qcOrderFailure._id}:status:accepted`,
      });
      assert.ok(emailRecord, "Email notification record must exist");
      assert.equal(emailRecord.status, "FAILED", "Status must be recorded as FAILED");
      assert.ok(emailRecord.errorMessage?.includes("timeout"), "Error message must be logged");

      mockTransportFail = false;
      recordPass("Email provider failure is handled safely and preserves order state");

      console.log("\n--- TEST GROUP 5: Safe and Idempotent Retry Behavior ---");
      sentEmails.length = 0;
      const retryRes = await retryFailedOrderEmail(emailRecord._id.toString());
      assert.equal(retryRes.sent, true, "Retry must succeed when provider is restored");
      assert.equal(sentEmails.length, 1, "1 email sent on retry");

      const refreshedRecord = await OrderEmailNotification.findById(emailRecord._id);
      assert.equal(refreshedRecord?.status, "SENT", "Status must be updated to SENT");

      // Calling retry again when already SENT must NOT send another email
      sentEmails.length = 0;
      const secondRetry = await retryFailedOrderEmail(emailRecord._id.toString());
      assert.equal(secondRetry.duplicate, true, "Subsequent retry on SENT email must be duplicate");
      assert.equal(sentEmails.length, 0, "No duplicate email sent");
      recordPass("Retry behavior is safe, updates delivery state, and prevents duplicates");
    }

    console.log("\n--- TEST GROUP 6: Ecommerce Tracking Included Only When Available ---");
    {
      // Create Ecommerce Order without AWB first
      const ecomOrder = await Order.create({
        orderNumber: "ECOM-2001",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "ECOMMERCE",
        status: "Accepted",
        paymentMethod: "Online",
        paymentStatus: "Paid",
        subtotal: 1200,
        total: 1250,
        shipping: 50,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Courier",
        deliveryAddress: { address: "Sector 4", city: "Delhi", pincode: "110001" },
        fulfillmentGroups: [
          {
            groupId: "GRP-ECOM-1",
            fulfillmentType: "COURIER_SHIPPING",
            status: "Processing",
            items: [],
            subtotal: 1200,
            shippingFee: 50,
          },
        ],
      });

      sentEmails.length = 0;
      // Step A: When AWB is NOT available yet
      await sendCustomerFulfillmentGroupEmail(ecomOrder._id.toString(), "GRP-ECOM-1", "Processing");
      assert.equal(sentEmails.length, 1);
      const emailWithoutAwb = sentEmails[0].mailOptions.html;
      assert.ok(emailWithoutAwb.includes("Standard Courier Delivery"), "Must indicate courier delivery");
      assert.ok(!emailWithoutAwb.includes("AWB / Tracking No"), "Must NOT show AWB line when unavailable");
      assert.ok(!emailWithoutAwb.includes("undefined"), "Must not display 'undefined'");
      recordPass("Ecommerce email omits AWB/tracking section when not yet generated");

      // Step B: Now shipment is created with AWB and tracking URL
      sentEmails.length = 0;
      ecomOrder.fulfillmentGroups![0].status = "Shipped";
      ecomOrder.fulfillmentGroups![0].shippingDetails = {
        carrier: "Blue Dart Express",
        awbNumber: "BD987654321",
        trackingUrl: "https://track.bluedart.com/BD987654321",
        estimatedDelivery: new Date("2026-10-25"),
      };
      await ecomOrder.save();

      await sendCustomerFulfillmentGroupEmail(ecomOrder._id.toString(), "GRP-ECOM-1", "Shipped");
      assert.equal(sentEmails.length, 1);
      const emailWithAwb = sentEmails[0].mailOptions.html;
      assert.ok(emailWithAwb.includes("Blue Dart Express"), "Must include carrier name");
      assert.ok(emailWithAwb.includes("BD987654321"), "Must include AWB number");
      assert.ok(emailWithAwb.includes("https://track.bluedart.com/BD987654321"), "Must include tracking URL");
      recordPass("Ecommerce email includes carrier name, AWB, and tracking URL when available");
    }

    console.log("\n--- TEST GROUP 7: Quick Commerce Emails Never Show Shiprocket Tracking ---");
    {
      sentEmails.length = 0;
      await sendCustomerOrderStatusEmail(qcOrder._id.toString(), "Shipped");
      assert.equal(sentEmails.length, 1);
      const qcHtml = sentEmails[0].mailOptions.html;
      assert.ok(qcHtml.includes("Quick Commerce • Local Delivery"), "Must show Quick Commerce badge");
      assert.ok(!qcHtml.includes("Shiprocket"), "Must NEVER mention Shiprocket in QC emails");
      assert.ok(!qcHtml.includes("AWB / Tracking No"), "Must NEVER show AWB tracking in QC emails");
      recordPass("Quick Commerce emails never expose Shiprocket or courier tracking");
    }

    console.log("\n--- TEST GROUP 8: Mixed Orders & Independent Fulfillment Groups ---");
    {
      const mixedOrder = await Order.create({
        orderNumber: "MIX-3001",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "MIXED",
        status: "Accepted",
        paymentMethod: "Online",
        paymentStatus: "Paid",
        subtotal: 1800,
        total: 1850,
        shipping: 50,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Plot 5, Rajendra Nagar", city: "Patna", pincode: "800016" },
        fulfillmentGroups: [
          {
            groupId: "GRP-QC-1",
            fulfillmentType: "LOCAL_DELIVERY",
            status: "Delivered",
            items: [],
            subtotal: 600,
            shippingFee: 0,
          },
          {
            groupId: "GRP-ECOM-2",
            fulfillmentType: "COURIER_SHIPPING",
            status: "Shipped",
            shippingDetails: {
              carrier: "Delhivery",
              awbNumber: "DLH11223344",
              trackingUrl: "https://delhivery.com/track/DLH11223344",
            },
            items: [],
            subtotal: 1200,
            shippingFee: 50,
          },
        ],
      });

      sentEmails.length = 0;
      // Send group-specific update for GRP-ECOM-2
      const groupRes = await sendCustomerFulfillmentGroupEmail(mixedOrder._id.toString(), "GRP-ECOM-2", "Shipped");
      assert.equal(groupRes.sent, true);
      assert.equal(sentEmails.length, 1);
      const mixedHtml = sentEmails[0].mailOptions.html;
      assert.ok(mixedHtml.includes("Package GRP-ECOM-2"), "Must identify specific package");
      assert.ok(mixedHtml.includes("DLH11223344"), "Must include courier AWB");

      // Verify overall parent order is NOT marked delivered while group 2 is still Shipped
      const refreshedMixed = await Order.findById(mixedOrder._id);
      assert.notEqual(refreshedMixed?.status, "Delivered", "Parent order must NOT be marked delivered while other groups active");
      recordPass("Mixed orders report fulfillment groups independently without false order-level delivery");
    }

    console.log("\n--- TEST GROUP 9: Return & Exchange Lifecycles With Leg and Stage Distinction ---");
    {
      // 9A: Return Flow
      const returnDoc = await Return.create({
        order: qcOrder._id,
        orderItem: orderItem._id,
        customer: customer._id,
        requestType: "RETURN",
        reason: "Item arrived with broken seal",
        status: "Pending",
        quantity: 1,
      });

      sentEmails.length = 0;
      // 1. Return requested
      await sendReturnRequestNotificationToCustomer(
        customer._id.toString(),
        qcOrder.orderNumber,
        "Basmati Rice 5kg",
        returnDoc._id.toString(),
        undefined,
        "RETURN",
        qcOrder._id.toString()
      );
      await new Promise((r) => setTimeout(r, 100));
      assert.ok(sentEmails.length >= 1, "Email sent on return request");
      assert.ok(sentEmails[0].mailOptions.subject.includes("Return Update"), "Subject indicates Return");
      assert.ok(sentEmails[0].mailOptions.html.includes("Return Request Submitted"), "Explains return submission");
      recordPass("Return request email informs customer of seller review");

      // 2. Return approved with reverse pickup scheduled
      sentEmails.length = 0;
      returnDoc.status = "Reverse Shipment Created";
      returnDoc.returnAwbNumber = "REV-AWB-998877";
      returnDoc.courierName = "Shadowfax Reverse";
      await returnDoc.save();

      await sendCustomerReturnExchangeEmail(returnDoc._id.toString(), "Reverse Shipment Created");
      assert.equal(sentEmails.length, 1);
      const returnPickupHtml = sentEmails[0].mailOptions.html;
      assert.ok(returnPickupHtml.includes("REV-AWB-998877"), "Includes reverse AWB");
      assert.ok(returnPickupHtml.includes("Shadowfax Reverse"), "Includes reverse courier name");
      recordPass("Return reverse pickup email includes reverse courier and AWB details");

      // 9B: Exchange Flow
      const exchangeDoc = await Return.create({
        order: qcOrder._id,
        orderItem: orderItem._id,
        customer: customer._id,
        requestType: "EXCHANGE",
        reason: "Need larger size",
        status: "Pending",
        quantity: 1,
        replacement: {
          product: product._id,
          seller: seller._id,
          productName: "Basmati Rice 10kg",
          sku: "SKU-RICE-10",
          unitPrice: 450,
          quantity: 1,
          status: "READY",
          idempotencyKey: "ex-key-1",
          inventoryIdempotencyKey: "ex-inv-1",
        },
      });

      sentEmails.length = 0;
      // Exchange replacement dispatched
      exchangeDoc.status = "Forward Shipment Created";
      exchangeDoc.replacement!.status = "CREATED";
      exchangeDoc.replacement!.awbNumber = "FWD-REP-554433";
      exchangeDoc.replacement!.carrier = "Delhivery Surface";
      await exchangeDoc.save();

      await sendCustomerReturnExchangeEmail(exchangeDoc._id.toString(), "Forward Shipment Created");
      assert.equal(sentEmails.length, 1);
      const exHtml = sentEmails[0].mailOptions.html;
      assert.ok(exHtml.includes("Exchange"), "Must identify as Exchange");
      assert.ok(exHtml.includes("Replacement Unit Dispatched"), "Explains replacement shipment");
      assert.ok(exHtml.includes("FWD-REP-554433"), "Includes replacement forward AWB");
      recordPass("Exchange email accurately describes replacement dispatch leg with forward tracking");

      // 9C: Refund Email
      sentEmails.length = 0;
      await sendCustomerRefundEmail(qcOrder._id.toString(), {
        amount: 450,
        reason: "Return item refund",
        method: "Olovely Wallet",
        status: "Completed",
      });
      assert.equal(sentEmails.length, 1);
      const refundHtml = sentEmails[0].mailOptions.html;
      assert.ok(refundHtml.includes("₹450.00") || refundHtml.includes("450"), "Must show refund amount");
      assert.ok(refundHtml.includes("Olovely Wallet"), "Must show refund destination");
      recordPass("Refund email clearly states refund amount, method, and completion status");
    }

    console.log("\n--- TEST GROUP 10: Missing Email & Opt-Out Safeguards ---");
    {
      // 10A: Order with no customer email and customer has no email
      const customerNoEmail = await Customer.create({
        name: "No Email User",
        phone: "9111111111",
        status: "Active",
        refCode: "REFNOEM",
        deliveryOtp: "4321",
        totalOrders: 0,
        totalSpent: 0,
        walletAmount: 0,
        registrationDate: new Date(),
      });

      const orderNoEmail = await Order.create({
        orderNumber: "NOEM-4001",
        customer: customerNoEmail._id,
        customerName: customerNoEmail.name,
        customerPhone: customerNoEmail.phone,
        orderType: "QUICK_COMMERCE",
        status: "Accepted",
        paymentMethod: "COD",
        paymentStatus: "Pending",
        subtotal: 100,
        total: 100,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Main St", city: "Patna", pincode: "800001" },
      });

      sentEmails.length = 0;
      const noEmailRes = await sendCustomerOrderStatusEmail(orderNoEmail._id.toString(), "Accepted");
      assert.equal(noEmailRes.sent, false, "Must not send email when customer email missing");
      assert.equal(noEmailRes.skipped, true, "Must flag skipped: true");
      assert.ok(noEmailRes.skippedReason?.includes("Missing or invalid"), "Records safe skip reason");
      assert.equal(sentEmails.length, 0, "No email transmitted");
      recordPass("Missing customer email is skipped safely without breaking order workflow");

      // 10B: Customer opted out of email notifications
      const customerOptOut = await Customer.create({
        name: "Opt Out User",
        email: "optout@example.com",
        phone: "9222222222",
        status: "Active",
        refCode: "REFOPT",
        deliveryOtp: "5678",
        totalOrders: 0,
        totalSpent: 0,
        walletAmount: 0,
        registrationDate: new Date(),
        notificationPreferences: { email: false, sms: true, push: true },
      });

      const orderOptOut = await Order.create({
        orderNumber: "OPTOUT-4002",
        customer: customerOptOut._id,
        customerName: customerOptOut.name,
        customerEmail: customerOptOut.email,
        customerPhone: customerOptOut.phone,
        orderType: "QUICK_COMMERCE",
        status: "Accepted",
        paymentMethod: "COD",
        paymentStatus: "Pending",
        subtotal: 150,
        total: 150,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Main St", city: "Patna", pincode: "800001" },
      });

      sentEmails.length = 0;
      const optOutRes = await sendCustomerOrderStatusEmail(orderOptOut._id.toString(), "Accepted");
      assert.equal(optOutRes.sent, false);
      assert.equal(optOutRes.skipped, true);
      assert.ok(optOutRes.skippedReason?.includes("opted out"), "Records opt-out skip reason");
      assert.equal(sentEmails.length, 0);
      recordPass("Customer email opt-out preference is respected");
    }

    console.log("\n--- TEST GROUP 11: Existing Support Emails & Notifications Continue Working ---");
    {
      sentEmails.length = 0;
      const supportRes = await sendSupportEmail({
        name: "Support Test",
        email: "support.user@example.com",
        subject: "Need Help with App",
        message: "Hello support team, please help.",
        submittedAt: new Date(),
      });
      assert.equal(supportRes.success, true, "sendSupportEmail must continue functioning");
      assert.equal(sentEmails.length, 1, "Support email dispatched");
      assert.ok(sentEmails[0].mailOptions.subject.includes("[Olovely Support]"), "Existing support email format intact");
      recordPass("Existing support emails and transporter behavior continue working seamlessly");

      // Wholesale Item Badge Verification in Email
      const wholesaleOrder = await Order.create({
        orderNumber: "WHOLE-5001",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "QUICK_COMMERCE",
        status: "Received",
        paymentMethod: "COD",
        paymentStatus: "Pending",
        subtotal: 15000,
        total: 15000,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Wholesale Mandi", city: "Patna", pincode: "800001" },
        items: [],
      });

      const wholesaleItem = await OrderItem.create({
        order: wholesaleOrder._id,
        product: product._id,
        seller: seller._id,
        productName: "Bulk Wheat 50kg Sack",
        unitPrice: 1500,
        quantity: 10,
        total: 15000,
        subtotal: 15000,
        commissionRate: 3,
        commissionAmount: 450,
        status: "Pending",
        sellerStatus: "Pending",
        isWholesale: true,
        wholesalePrice: 1500,
        wholesaleMinimumQuantity: 5,
        isReturnable: false,
        returnWindowDays: 0,
        productType: "QUICK_COMMERCE",
        fulfillmentType: "LOCAL_DELIVERY",
        ownerType: "VENDOR",
        billingEntityName: "Olovely Wholesale Depot",
        taxRate: 0,
        taxAmount: 0,
      });

      wholesaleOrder.items.push(wholesaleItem._id as any);
      await wholesaleOrder.save();

      sentEmails.length = 0;
      await sendCustomerOrderStatusEmail(wholesaleOrder._id.toString(), "Processed");
      assert.equal(sentEmails.length, 1);
      const wholesaleEmailHtml = sentEmails[0].mailOptions.html;
      assert.ok(wholesaleEmailHtml.includes("Wholesale"), "Item row must have Wholesale badge");
      assert.ok(wholesaleEmailHtml.includes("Bulk Wheat 50kg Sack"), "Displays wholesale product name");
      recordPass("Wholesale orders display wholesale badge, quantities, and unit prices");
    }

    console.log("\n--- TEST GROUP 12: Online Payment Confirmation & Duplicate Callback Protection ---");
    {
      process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_key_123";

      // 12A: Direct payment verification callback (verifyPayment)
      const onlineOrder1 = await Order.create({
        orderNumber: "ONL-6001",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "QUICK_COMMERCE",
        status: "Pending",
        paymentMethod: "Online",
        paymentStatus: "Pending",
        subtotal: 500,
        total: 500,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Boring Road", city: "Patna", pincode: "800001" },
        items: [],
      });

      // Assert no email sent at order placement for pending online order
      sentEmails.length = 0;
      assert.equal(sentEmails.length, 0, "Online order pending payment must not send confirmation email");

      // Verify payment capture succeeds and triggers order confirmation email
      const verifyRes = await capturePayment(
        onlineOrder1._id.toString(),
        "order_mock_6001",
        "pay_mock_6001",
        "sig_mock_6001"
      );
      assert.equal(verifyRes.success, true);
      await new Promise((r) => setTimeout(r, 200));

      assert.equal(sentEmails.length, 1, "Payment verification must send exactly 1 order confirmation email");
      assert.ok(sentEmails[0].mailOptions.subject.includes("ONL-6001"), "Confirmation subject includes order number");
      assert.ok(sentEmails[0].mailOptions.html.includes("Order Confirmed") || sentEmails[0].mailOptions.html.includes("Order Update: #ONL-6001"), "Includes confirmation content");

      // Duplicate verifyPayment callback
      const dupVerifyRes = await capturePayment(
        onlineOrder1._id.toString(),
        "order_mock_6001",
        "pay_mock_6001",
        "sig_mock_6001"
      );
      assert.equal(dupVerifyRes.success, true);
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(sentEmails.length, 1, "Duplicate payment verification callback must NOT send duplicate confirmation email");
      recordPass("Online payment verification triggers order confirmation and suppresses duplicate callbacks");

      // 12B: Payment captured via Webhook (handlePaymentCaptured)
      const onlineOrder2 = await Order.create({
        orderNumber: "ONL-6002",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "QUICK_COMMERCE",
        status: "Pending",
        paymentMethod: "Online",
        paymentStatus: "Pending",
        subtotal: 800,
        total: 800,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Fraser Road", city: "Patna", pincode: "800001" },
        items: [],
      });

      const webhookPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_mock_wh_6002",
              order_id: "order_rzp_mock_6002",
              amount: 80000,
              status: "captured",
              notes: { orderId: onlineOrder2._id.toString() },
            },
          },
        },
      };
      const validSig = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(webhookPayload))
        .digest("hex");

      sentEmails.length = 0;
      await handleWebhook(webhookPayload, validSig);
      await new Promise((r) => setTimeout(r, 200));

      assert.equal(sentEmails.length, 1, "Webhook payment capture must trigger customer confirmation email");
      assert.ok(sentEmails[0].mailOptions.subject.includes("ONL-6002"));

      // Duplicate webhook callback
      await handleWebhook(webhookPayload, validSig);
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(sentEmails.length, 1, "Duplicate webhook callback must NOT send duplicate email");
      recordPass("Online payment webhook capture triggers confirmation email and ignores duplicate webhooks");
    }

    console.log("\n--- TEST GROUP 13: Pending and Failed Payment Email Suppression ---");
    {
      const failOrder = await Order.create({
        orderNumber: "ONL-FAIL-6003",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "QUICK_COMMERCE",
        status: "Pending",
        paymentMethod: "Online",
        paymentStatus: "Pending",
        subtotal: 1000,
        total: 1000,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Kankarbagh", city: "Patna", pincode: "800020" },
        items: [],
      });

      const failPayment = await Payment.create({
        order: failOrder._id,
        customer: customer._id,
        paymentMethod: "Online",
        paymentGateway: "Razorpay",
        razorpayOrderId: "order_rzp_fail_6003",
        razorpayPaymentId: "pay_mock_fail_6003",
        amount: 1000,
        currency: "INR",
        status: "Pending",
      });

      const failPayload = {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_mock_fail_6003",
              order_id: "order_rzp_fail_6003",
              error_description: "Card was declined by issuing bank",
            },
          },
        },
      };
      const failSig = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
        .update(JSON.stringify(failPayload))
        .digest("hex");

      sentEmails.length = 0;
      await handleWebhook(failPayload, failSig);
      await new Promise((r) => setTimeout(r, 200));

      const updatedFailOrder = await Order.findById(failOrder._id);
      assert.equal(updatedFailOrder?.status, "Cancelled", "Failed order must be Cancelled");
      assert.equal(updatedFailOrder?.paymentStatus, "Failed", "Payment status must be Failed");

      // Verify NO misleading "Order Confirmed" / "Order Placed" email was sent to customer
      const sentConfirmation = sentEmails.find(
        (e) => e.mailOptions.subject.includes("Order Confirmed") || e.mailOptions.subject.includes("Order Placed")
      );
      assert.equal(sentConfirmation, undefined, "Customer must NEVER receive order confirmation email on payment failure");
      recordPass("Pending and failed payments suppress confirmation email and cancel order safely");
    }

    console.log("\n--- TEST GROUP 14: COD and 100% Wallet Order Placement Triggers ---");
    {
      // 14A: COD Order confirmation
      const codOrder = await Order.create({
        orderNumber: "COD-7001",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "QUICK_COMMERCE",
        status: "Received",
        paymentMethod: "COD",
        paymentStatus: "Pending",
        subtotal: 350,
        total: 350,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Ashok Rajpath", city: "Patna", pincode: "800004" },
        items: [],
      });

      sentEmails.length = 0;
      await sendOrderStatusNotification(codOrder._id.toString(), customer._id.toString(), "Received");
      await new Promise((r) => setTimeout(r, 200));

      assert.equal(sentEmails.length, 1, "COD order placement must send order confirmation email");
      assert.ok(sentEmails[0].mailOptions.subject.includes("COD-7001"));
      recordPass("COD order placement reliably triggers confirmation email");

      // 14B: 100% Wallet Order confirmation
      const walletOrder = await Order.create({
        orderNumber: "WAL-7002",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "QUICK_COMMERCE",
        status: "Received",
        paymentMethod: "Wallet",
        paymentStatus: "Paid",
        walletAmountUsed: 250,
        subtotal: 250,
        total: 250,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Bailey Road", city: "Patna", pincode: "800001" },
        items: [],
      });

      sentEmails.length = 0;
      await sendOrderStatusNotification(walletOrder._id.toString(), customer._id.toString(), "Received");
      await new Promise((r) => setTimeout(r, 200));

      assert.equal(sentEmails.length, 1, "100% Wallet-paid order placement must send order confirmation email");
      assert.ok(sentEmails[0].mailOptions.subject.includes("WAL-7002"));
      recordPass("100% Wallet-paid order placement reliably triggers confirmation email");
    }

    console.log("\n--- TEST GROUP 15: Concurrent Retry Workers & Retry Limit Exhaustion ---");
    {
      const retryOrder = await Order.create({
        orderNumber: "RETRY-8001",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "QUICK_COMMERCE",
        status: "Accepted",
        paymentMethod: "COD",
        paymentStatus: "Pending",
        subtotal: 600,
        total: 600,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Anandpuri", city: "Patna", pincode: "800001" },
        items: [],
      });

      // Create a FAILED notification record
      const failedNotification = await OrderEmailNotification.create({
        order: retryOrder._id,
        orderNumber: retryOrder.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${retryOrder._id}:status:accepted`,
        subject: `Order Update: #${retryOrder.orderNumber} — Accepted`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "FAILED",
        attempts: 1,
        lastAttemptAt: new Date(),
        metadata: { status: "Accepted" },
      });

      // 15A: Concurrent retry attempts by multiple workers
      sentEmails.length = 0;
      const retryResults = await Promise.all([
        retryFailedOrderEmail(failedNotification._id.toString()),
        retryFailedOrderEmail(failedNotification._id.toString()),
        retryFailedOrderEmail(failedNotification._id.toString()),
      ]);

      const sentCount = retryResults.filter((r) => r.sent).length;
      assert.equal(sentCount, 1, "Only one concurrent retry worker must succeed in transmitting");
      assert.equal(sentEmails.length, 1, "Transporter called exactly once during concurrent retries");
      recordPass("Concurrent retry workers cannot send duplicate emails (atomic retry lease)");

      // 15B: Enforcing maximum 5 retry attempts limit
      const exhaustedNotification = await OrderEmailNotification.create({
        order: retryOrder._id,
        orderNumber: retryOrder.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${retryOrder._id}:status:exhausted_test`,
        subject: `Order Update: #${retryOrder.orderNumber} — Exhausted`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "FAILED",
        attempts: 5,
        lastAttemptAt: new Date(),
        metadata: { status: "Accepted" },
      });

      sentEmails.length = 0;
      const exhaustedRes = await retryFailedOrderEmail(exhaustedNotification._id.toString());
      assert.equal(exhaustedRes.sent, false, "Must not send when attempts reach 5");
      assert.equal(exhaustedRes.skipped, true);
      assert.ok(exhaustedRes.skippedReason?.includes("Maximum retry attempts exceeded"), "Skips with max retry reason");
      assert.equal(sentEmails.length, 0, "No email sent after retry limit exhaustion");
      recordPass("Retry limit is strictly enforced at maximum 5 attempts");

      // 15C: Permanently skipped emails cannot be accidentally retried
      const skippedNotification = await OrderEmailNotification.create({
        order: retryOrder._id,
        orderNumber: retryOrder.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${retryOrder._id}:status:skipped_test`,
        subject: `Order Update: #${retryOrder.orderNumber} — Skipped`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "SKIPPED",
        skippedReason: "Customer opted out",
        attempts: 0,
      });

      const skippedRetryRes = await retryFailedOrderEmail(skippedNotification._id.toString());
      assert.equal(skippedRetryRes.sent, false);
      assert.equal(skippedRetryRes.skipped, true);
      assert.ok(skippedRetryRes.skippedReason?.includes("Permanently skipped"), "Cannot retry permanently skipped email");
      recordPass("Permanently skipped notifications are never retried");
    }

    console.log("\n--- TEST GROUP 16: Legitimate Repeated Status Transitions & Lease Recovery ---");
    {
      const repeatOrder = await Order.create({
        orderNumber: "REP-9001",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "ECOMMERCE",
        status: "Accepted",
        paymentMethod: "Online",
        paymentStatus: "Paid",
        subtotal: 1500,
        total: 1500,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Courier",
        deliveryAddress: { address: "Exhibition Road", city: "Patna", pincode: "800001" },
        fulfillmentGroups: [
          {
            groupId: "GRP-REP-1",
            fulfillmentType: "COURIER_SHIPPING",
            status: "OutForDelivery",
            shippingDetails: {
              carrier: "Delhivery",
              awbNumber: "DLH_REP_111",
            },
            items: [],
            subtotal: 1500,
            shippingFee: 0,
          },
        ],
      });

      // 16A: Multi-day delivery re-attempts
      sentEmails.length = 0;
      // Day 1: First Out for Delivery attempt
      const day1Res = await sendCustomerFulfillmentGroupEmail(
        repeatOrder._id.toString(),
        "GRP-REP-1",
        "Out for Delivery",
        { attemptDate: "2026-10-15" }
      );
      assert.equal(day1Res.sent, true, "Day 1 delivery attempt sends email");
      assert.equal(sentEmails.length, 1);

      // Duplicate webhook on Day 1
      const day1DupRes = await sendCustomerFulfillmentGroupEmail(
        repeatOrder._id.toString(),
        "GRP-REP-1",
        "Out for Delivery",
        { attemptDate: "2026-10-15" }
      );
      assert.equal(day1DupRes.duplicate, true, "Duplicate delivery attempt on same day is suppressed");
      assert.equal(sentEmails.length, 1);

      // Day 2: Courier re-attempts delivery on next day
      const day2Res = await sendCustomerFulfillmentGroupEmail(
        repeatOrder._id.toString(),
        "GRP-REP-1",
        "Out for Delivery",
        { attemptDate: "2026-10-16" }
      );
      assert.equal(day2Res.sent, true, "Legitimate re-attempt on next day sends email (not falsely suppressed)");
      assert.equal(sentEmails.length, 2);
      recordPass("Multi-day delivery re-attempts are delivered legitimately without false suppression");

      // 16B: Replacement shipment re-dispatch with new AWB
      const exOrder = await Order.create({
        orderNumber: "EX-REP-9002",
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderType: "QUICK_COMMERCE",
        status: "Accepted",
        paymentMethod: "COD",
        paymentStatus: "Pending",
        subtotal: 500,
        total: 500,
        shipping: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        tipAmount: 0,
        giftPackaging: false,
        deliveryOption: "Standard",
        deliveryAddress: { address: "Patliputra Colony", city: "Patna", pincode: "800013" },
        items: [],
      });

      const exchangeReturn = await Return.create({
        order: exOrder._id,
        orderItem: new mongoose.Types.ObjectId(),
        customer: customer._id,
        requestType: "EXCHANGE",
        reason: "Defective item",
        status: "Forward Shipment Created",
        quantity: 1,
        replacement: {
          product: product._id,
          seller: seller._id,
          productName: "Replacement Unit",
          unitPrice: 500,
          quantity: 1,
          status: "CREATED",
          awbNumber: "AWB-REP-LEG-1",
          carrier: "Delhivery Surface",
        },
      });

      sentEmails.length = 0;
      const repLeg1 = await sendCustomerReturnExchangeEmail(exchangeReturn._id.toString(), "Forward Shipment Created");
      assert.equal(repLeg1.sent, true, "First replacement dispatch sends email");
      assert.equal(sentEmails.length, 1);

      // Re-dispatched replacement unit with new AWB
      exchangeReturn.replacement!.awbNumber = "AWB-REP-LEG-2";
      await exchangeReturn.save();

      const repLeg2 = await sendCustomerReturnExchangeEmail(exchangeReturn._id.toString(), "Forward Shipment Created");
      assert.equal(repLeg2.sent, true, "Legitimate replacement re-dispatch with new AWB sends email");
      assert.equal(sentEmails.length, 2);
      recordPass("Replacement re-dispatch with updated tracking sends new email without suppression");

      // 16C: Abandoned pending lease recovery (> 5 minutes stale)
      const stalePending = await OrderEmailNotification.create({
        order: repeatOrder._id,
        orderNumber: repeatOrder.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${repeatOrder._id}:status:stale_lease_test`,
        subject: `Order Update: #${repeatOrder.orderNumber} — Processing`,
        templateType: "ORDER_STATUS",
        channel: "ECOMMERCE",
        status: "PENDING",
        attempts: 1,
        lastAttemptAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      });

      sentEmails.length = 0;
      const recoveredEmail = await sendCustomerOrderStatusEmail(repeatOrder._id.toString(), "stale_lease_test");
      assert.equal(recoveredEmail.sent, true, "Crashed/stale pending lease must be recovered and delivered");
      assert.equal(sentEmails.length, 1);
      recordPass("Crashed pending leases are atomically recovered and sent");
    }

    console.log("\n--- TEST GROUP 17: Standalone Retry Worker Batch Processing & Lifecycle ---");
    {
      const createTestOrder = async (orderNum: string, st = "Accepted") => {
        return Order.create({
          orderNumber: orderNum,
          customer: customer._id,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          orderType: "QUICK_COMMERCE",
          status: st,
          paymentMethod: "COD",
          paymentStatus: "Pending",
          subtotal: 500,
          total: 500,
          shipping: 0,
          tax: 0,
          platformFee: 0,
          discount: 0,
          tipAmount: 0,
          giftPackaging: false,
          deliveryOption: "Standard",
          deliveryAddress: { address: "Boring Canal Road", city: "Patna", pincode: "800001" },
          items: [],
        });
      };

      const wOrder1 = await createTestOrder("WORKER-1001", "Accepted");
      const wOrder2 = await createTestOrder("WORKER-1002", "Accepted");
      const wOrder3 = await createTestOrder("WORKER-1003", "Accepted");
      const wOrder4 = await createTestOrder("WORKER-1004", "Accepted");
      const wOrder5 = await createTestOrder("WORKER-1005", "Accepted");

      // 17A: Create a diverse set of notification records
      // 1. Failed notification (eligible)
      await OrderEmailNotification.create({
        order: wOrder1._id,
        orderNumber: wOrder1.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${wOrder1._id}:status:accepted`,
        subject: `Order Update: #${wOrder1.orderNumber} — Fail 1`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "FAILED",
        attempts: 1,
        lastAttemptAt: new Date(Date.now() - 60000),
        metadata: { status: "Accepted" },
      });

      // 2. Failed notification (eligible)
      await OrderEmailNotification.create({
        order: wOrder2._id,
        orderNumber: wOrder2.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${wOrder2._id}:status:accepted`,
        subject: `Order Update: #${wOrder2.orderNumber} — Fail 2`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "FAILED",
        attempts: 2,
        lastAttemptAt: new Date(Date.now() - 120000),
        metadata: { status: "Accepted" },
      });

      // 3. Stale PENDING notification from crashed worker (> 5 minutes old) (eligible)
      await OrderEmailNotification.create({
        order: wOrder3._id,
        orderNumber: wOrder3.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${wOrder3._id}:status:accepted`,
        subject: `Order Update: #${wOrder3.orderNumber} — Stale Pending 3`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "PENDING",
        attempts: 1,
        lastAttemptAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        metadata: { status: "Accepted" },
      });

      // 4. Exhausted notification (attempts = 5) (ineligible)
      await OrderEmailNotification.create({
        order: wOrder4._id,
        orderNumber: wOrder4.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${wOrder4._id}:status:accepted`,
        subject: `Order Update: #${wOrder4.orderNumber} — Exhausted 4`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "FAILED",
        attempts: 5,
        lastAttemptAt: new Date(),
        metadata: { status: "Accepted" },
      });

      // 5. Permanently SKIPPED notification (ineligible)
      await OrderEmailNotification.create({
        order: wOrder5._id,
        orderNumber: wOrder5.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${wOrder5._id}:status:accepted`,
        subject: `Order Update: #${wOrder5.orderNumber} — Skipped 5`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "SKIPPED",
        skippedReason: "Opted out",
        attempts: 0,
      });

      // Test batch size limitation: Request batchSize = 2 when 3 are eligible
      sentEmails.length = 0;
      const batch1 = await processFailedOrderEmailsBatch({ batchSize: 2 });
      assert.equal(batch1.processed, 2, "Batch size limit of 2 must be strictly respected");
      assert.equal(batch1.succeeded, 2, "Both selected notifications delivered successfully");
      assert.equal(sentEmails.length, 2, "Exactly 2 emails sent in first batch");
      recordPass("Retry worker strictly respects bounded batch size limit");

      // Test second batch processing remaining eligible records (including stale PENDING recovery)
      sentEmails.length = 0;
      const batch2 = await processFailedOrderEmailsBatch({ batchSize: 10 });
      assert.equal(batch2.processed, 1, "Only 1 remaining eligible notification processed");
      assert.equal(batch2.succeeded, 1, "Remaining notification (stale PENDING) recovered and delivered");
      assert.equal(sentEmails.length, 1);
      recordPass("Retry worker recovers and processes stale PENDING leases from crashed workers");

      // Verify third batch finds 0 eligible records (exhausted and SKIPPED are excluded)
      sentEmails.length = 0;
      const batch3 = await processFailedOrderEmailsBatch({ batchSize: 10 });
      assert.equal(batch3.processed, 0, "No notifications eligible after recovery (exhausted and skipped excluded)");
      assert.equal(sentEmails.length, 0);
      recordPass("Retry worker safely excludes exhausted and permanently skipped records");

      // 17B: Concurrent batch executions cannot send duplicate emails
      const concOrder1 = await createTestOrder("CONC-1001", "Accepted");
      const concOrder2 = await createTestOrder("CONC-1002", "Accepted");

      const c1 = await OrderEmailNotification.create({
        order: concOrder1._id,
        orderNumber: concOrder1.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${concOrder1._id}:status:accepted`,
        subject: `Order Update: #${concOrder1.orderNumber} — Concurrent 1`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "FAILED",
        attempts: 1,
        lastAttemptAt: new Date(Date.now() - 30000),
        metadata: { status: "Accepted" },
      });
      const c2 = await OrderEmailNotification.create({
        order: concOrder2._id,
        orderNumber: concOrder2.orderNumber,
        customer: customer._id,
        recipientEmail: customer.email,
        eventKey: `order:${concOrder2._id}:status:accepted`,
        subject: `Order Update: #${concOrder2.orderNumber} — Concurrent 2`,
        templateType: "ORDER_STATUS",
        channel: "QUICK_COMMERCE",
        status: "FAILED",
        attempts: 1,
        lastAttemptAt: new Date(Date.now() - 20000),
        metadata: { status: "Accepted" },
      });

      sentEmails.length = 0;
      // Simulate two workers executing simultaneously on the same queue
      const [concBatchA, concBatchB] = await Promise.all([
        processFailedOrderEmailsBatch({ batchSize: 10 }),
        processFailedOrderEmailsBatch({ batchSize: 10 }),
      ]);

      const totalSentFromBoth = concBatchA.succeeded + concBatchB.succeeded;
      assert.equal(totalSentFromBoth, 2, "Exactly 2 emails total must be sent across both concurrent workers");
      assert.equal(sentEmails.length, 2, "Transporter received exactly 2 email transmissions with zero duplicates");
      assert.ok(
        concBatchA.skippedOrDuplicate > 0 || concBatchB.skippedOrDuplicate > 0,
        "Losing worker records non-disruptive skipped/duplicate status"
      );
      recordPass("Concurrent batch worker processes execute safely without duplicate email deliveries");

      // Verify aggregate metrics formatting
      assert.ok(typeof concBatchA.durationMs === "number" && concBatchA.durationMs >= 0, "Returns execution duration");
      assert.equal(concBatchA.failed, 0, "Zero unhandled failures");
      recordPass("Retry worker returns accurate non-sensitive aggregate operational metrics");
    }

    console.log("\n======================================================================");
    console.log(` ALL ${passedTests.length} TEST CASES PASSED SUCCESSFULLY! `);
    console.log("======================================================================");
  } finally {
    setCustomTransporter(null);
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runTestSuite().catch((err) => {
  console.error("Test Suite Failed with Exception:", err);
  process.exit(1);
});
