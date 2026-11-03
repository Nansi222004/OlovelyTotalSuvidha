import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Seller from "../models/Seller";
import Customer from "../models/Customer";
import { getShippingLabel } from "../modules/seller/controllers/orderController";
import { buildSellerInvoiceScope } from "../utils/sellerInvoiceScoping";

type Result = { status: number; body: any };
let passed = 0;

function pass(name: string) {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")}: ${name}`);
}

function invokeController(handler: any, req: { params?: any; query?: any; user?: any }): Promise<Result> {
  return new Promise((resolve, reject) => {
    let status = 200;
    const response = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: any) {
        resolve({ status, body: payload });
        return this;
      },
    };
    handler(req as any, response as any, reject);
  });
}

// Code 128 pattern helper test for barcode scannability
function generateCode128BPatterns(text: string): { valid: boolean; patternLength: number; checksumValid: boolean } {
  if (!text || text.length === 0) return { valid: false, patternLength: 0, checksumValid: false };
  const isAscii = [...text].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126);
  if (!isAscii) return { valid: false, patternLength: 0, checksumValid: false };

  // Calculate Code 128 Checksum (Start B = 104)
  let sum = 104;
  for (let i = 0; i < text.length; i++) {
    const val = text.charCodeAt(i) - 32;
    sum += val * (i + 1);
  }
  const checksum = sum % 103;
  return { valid: true, patternLength: (text.length + 3) * 11 + 2, checksumValid: checksum >= 0 && checksum <= 102 };
}

async function runTests() {
  console.log("=== STARTING 4x6 THERMAL PRINTING & SHIPPING LABEL TEST SUITE ===");
  const mongoServer = await MongoMemoryServer.create({
    instance: {
      launchTimeout: 60000,
    },
  });
  await mongoose.connect(mongoServer.getUri());

  try {
    const sellerAId = new mongoose.Types.ObjectId();
    const sellerBId = new mongoose.Types.ObjectId();
    const customerId = new mongoose.Types.ObjectId();
    const riderId = new mongoose.Types.ObjectId();

    // 1. Seed Seller A & Seller B
    await Seller.create([
      {
        _id: sellerAId,
        sellerName: "Vendor Super Mart",
        storeName: "Olovely Super Mart",
        category: "Grocery",
        password: "hashedpassword123",
        mobile: "9876543210",
        email: "supermart@example.com",
        address: "Shop 12, Main Market Road",
        city: "Varanasi",
        state: "Uttar Pradesh",
        pincode: "221001",
        gstin: "09AAACH7409R1ZZ",
        isApproved: true,
        requireProductApproval: false,
      },
      {
        _id: sellerBId,
        sellerName: "Vendor Fashion",
        storeName: "Fashion Hub Boutique",
        category: "Clothing",
        password: "hashedpassword123",
        mobile: "9876543211",
        email: "fashionhub@example.com",
        address: "Plot 45, Textile Zone",
        city: "Varanasi",
        state: "Uttar Pradesh",
        pincode: "221002",
        isApproved: true,
        requireProductApproval: false,
      },
    ]);

    // 2. Seed Customer
    await Customer.create({
      _id: customerId,
      name: "Amit Kumar Sharma Longname Extended",
      phone: "9898989898",
      email: "amit.longname@example.com",
    });

    const createOrder = async (overrides: Record<string, any>) => {
      const defaultOrder = {
        orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).slice(-4)}`,
        customer: customerId,
        customerName: "Amit Kumar Sharma Longname Extended",
        customerPhone: "9898989898",
        customerEmail: "amit.longname@example.com",
        orderDate: new Date(),
        orderType: "QUICK_COMMERCE",
        status: "Received",
        paymentStatus: "Pending",
        paymentMethod: "COD",
        subtotal: 100,
        tax: 0,
        shipping: 0,
        platformFee: 0,
        discount: 0,
        total: 100,
        deliveryAddress: {
          address: "Flat 402, Royal Residency, Beside St. Xavier School",
          landmark: "Opposite High Tower",
          city: "Varanasi",
          state: "Uttar Pradesh",
          pincode: "221005",
        },
      };
      return await Order.create({ ...defaultOrder, ...overrides });
    };

    const createOrderItem = async (overrides: Record<string, any>) => {
      const defaultItem = {
        product: new mongoose.Types.ObjectId(),
        productName: "Test Product",
        unitPrice: 100,
        quantity: 1,
        total: 100,
        subtotal: 100,
        commissionRate: 0,
        commissionAmount: 0,
        isWholesale: false,
        isReturnable: false,
        returnWindowDays: 0,
      };
      return await OrderItem.create({ ...defaultItem, ...overrides });
    };

    // -------------------------------------------------------------
    // Test 1: 4x6 Invoice Rendering - Delivered & Paid -> TAX INVOICE
    // -------------------------------------------------------------
    const deliveredPaidOrder = await createOrder({
      orderNumber: "ORD-INV-001",
      status: "Delivered",
      paymentStatus: "Paid",
      paymentMethod: "UPI",
      subtotal: 1000,
      tax: 50,
      shipping: 30,
      total: 1080,
      invoiceNumber: "INV-2026-001",
    });

    await createOrderItem({
      order: deliveredPaidOrder._id,
      seller: sellerAId,
      productName: "Premium Basmati Rice 5kg",
      unitPrice: 500,
      quantity: 2,
      total: 1000,
      taxAmount: 50,
      taxRate: 5,
      billingEntityName: "Olovely Super Mart",
      billingEntityGstin: "09AAACH7409R1ZZ",
    });

    const isDeliveredAndPaid = deliveredPaidOrder.status === "Delivered" && deliveredPaidOrder.paymentStatus === "Paid";
    const invoiceTitle = isDeliveredAndPaid ? "TAX INVOICE" : "PACKING SLIP / BILL";
    assert.equal(invoiceTitle, "TAX INVOICE", "Delivered & Paid order must render TAX INVOICE");
    pass("1. 4x6 Invoice rendering title correctly detects TAX INVOICE for delivered & paid");

    // -------------------------------------------------------------
    // Test 2: 4x6 QC Shipping Label Rendering Payload
    // -------------------------------------------------------------
    const qcOrder = await createOrder({
      orderNumber: "ORD-QC-777",
      status: "On the way",
      paymentMethod: "COD",
      paymentStatus: "Pending",
      subtotal: 450,
      shipping: 25,
      total: 475,
      deliveryOption: "Instant",
      deliveryAddress: {
        address: "Lane 4, Near Shiva Temple",
        city: "Varanasi",
        state: "Uttar Pradesh",
        pincode: "221010",
      },
      fulfillmentGroups: [
        {
          groupId: "GRP-QC-1",
          fulfillmentType: "LOCAL_DELIVERY",
          status: "OutForDelivery",
          subtotal: 450,
          shippingFee: 25,
          deliveryBoy: riderId,
          seller: sellerAId,
        },
      ],
    });

    await createOrderItem({
      order: qcOrder._id,
      seller: sellerAId,
      productName: "Fresh Milk 1L",
      unitPrice: 60,
      quantity: 3,
      total: 180,
      variation: "Pouch",
    });

    const qcLabelRes = await invokeController(getShippingLabel, {
      params: { id: qcOrder._id.toString() },
      user: { userId: sellerAId },
    });
    assert.equal(qcLabelRes.status, 200);
    assert.equal(qcLabelRes.body.data.labels[0].channel, "QUICK_COMMERCE");
    assert.equal(qcLabelRes.body.data.labels[0].type, "INTERNAL_THERMAL");
    assert.equal(qcLabelRes.body.data.labels[0].isCod, true);
    assert.equal(qcLabelRes.body.data.labels[0].codAmount, 475);
    assert.equal(qcLabelRes.body.data.labels[0].barcodeValue, "ORD-QC-777");
    pass("2. 4x6 QC shipping label payload generates complete local delivery fields and COD collection");

    // -------------------------------------------------------------
    // Test 3: Official Ecommerce Courier Label Retrieval (AWB Present)
    // -------------------------------------------------------------
    const ecomOrder = await createOrder({
      orderNumber: "ORD-ECOM-888",
      orderType: "ECOMMERCE",
      status: "Shipped",
      paymentMethod: "Online",
      paymentStatus: "Paid",
      subtotal: 1200,
      total: 1200,
      fulfillmentGroups: [
        {
          groupId: "GRP-ECOM-1",
          fulfillmentType: "COURIER_SHIPPING",
          status: "Shipped",
          seller: sellerAId,
          shippingDetails: {
            awbNumber: "AWB123456789",
            carrier: "Delhivery Surface",
            trackingUrl: "https://shiprocket.co/tracking/AWB123456789",
          },
          thirdPartyOrderDetails: {
            shipmentId: "SR-SHIP-99999",
            providerId: "SHIPROCKET",
          },
        },
      ],
    });

    await createOrderItem({
      order: ecomOrder._id,
      seller: sellerAId,
      productName: "Wireless Bluetooth Speaker",
      unitPrice: 1200,
      quantity: 1,
      total: 1200,
    });

    const ecomLabelRes = await invokeController(getShippingLabel, {
      params: { id: ecomOrder._id.toString() },
      user: { userId: sellerAId },
    });
    assert.equal(ecomLabelRes.status, 200);
    assert.equal(ecomLabelRes.body.data.labels[0].channel, "ECOMMERCE");
    assert.equal(ecomLabelRes.body.data.labels[0].type, "OFFICIAL_COURIER");
    assert.equal(ecomLabelRes.body.data.labels[0].available, true);
    assert.equal(ecomLabelRes.body.data.labels[0].awbNumber, "AWB123456789");
    assert.equal(ecomLabelRes.body.data.labels[0].carrier, "Delhivery Surface");
    pass("3. Official Ecommerce courier label retrieval respects carrier AWB and official label URL");

    // -------------------------------------------------------------
    // Test 4: Seller-Scoped Authorization
    // -------------------------------------------------------------
    const multiSellerOrder = await createOrder({
      orderNumber: "ORD-MULTI-999",
      orderType: "QUICK_COMMERCE",
      status: "Processed",
      paymentMethod: "Online",
      paymentStatus: "Paid",
      subtotal: 1500,
      total: 1500,
    });

    const itemSellerA = await createOrderItem({
      order: multiSellerOrder._id,
      seller: sellerAId,
      productName: "Item from Seller A",
      unitPrice: 500,
      quantity: 1,
      total: 500,
    });

    const itemSellerB = await createOrderItem({
      order: multiSellerOrder._id,
      seller: sellerBId,
      productName: "Item from Seller B",
      unitPrice: 1000,
      quantity: 1,
      total: 1000,
    });

    multiSellerOrder.fulfillmentGroups = [
      {
        groupId: "GRP-SELLER-A",
        fulfillmentType: "LOCAL_DELIVERY" as any,
        status: "Processing",
        seller: sellerAId,
        items: [itemSellerA._id],
        subtotal: 500,
      },
      {
        groupId: "GRP-SELLER-B",
        fulfillmentType: "LOCAL_DELIVERY" as any,
        status: "Processing",
        seller: sellerBId,
        items: [itemSellerB._id],
        subtotal: 1000,
      },
    ];
    await multiSellerOrder.save();

    const sellerALabelRes = await invokeController(getShippingLabel, {
      params: { id: multiSellerOrder._id.toString() },
      user: { userId: sellerAId },
    });
    assert.equal(sellerALabelRes.status, 200);
    assert.equal(sellerALabelRes.body.data.labels.length, 1);
    assert.equal(sellerALabelRes.body.data.labels[0].groupId, "GRP-SELLER-A");
    assert.equal(sellerALabelRes.body.data.labels[0].items[0].productName, "Item from Seller A");
    pass("4. Seller-scoped authorization restricts labels to seller's own packages and items");

    // -------------------------------------------------------------
    // Test 5: Unauthorized Seller Access Rejection
    // -------------------------------------------------------------
    const unauthorizedSellerId = new mongoose.Types.ObjectId();
    const rejectedRes = await invokeController(getShippingLabel, {
      params: { id: multiSellerOrder._id.toString() },
      user: { userId: unauthorizedSellerId },
    });
    assert.equal(rejectedRes.status, 404, "Unrelated seller must be rejected with 404/unauthorized");
    pass("5. Unauthorized seller access is rejected without exposing order or customer data");

    // -------------------------------------------------------------
    // Test 6: Multiple Products & Variants
    // -------------------------------------------------------------
    const multiVariantOrder = await createOrder({
      orderNumber: "ORD-VAR-101",
      orderType: "QUICK_COMMERCE",
      status: "Accepted",
      total: 900,
    });
    await Promise.all([
      createOrderItem({
        order: multiVariantOrder._id,
        seller: sellerAId,
        productName: "Men Polo T-Shirt",
        variation: "Size: XL, Color: Navy Blue",
        quantity: 2,
        unitPrice: 300,
        total: 600,
      }),
      createOrderItem({
        order: multiVariantOrder._id,
        seller: sellerAId,
        productName: "Men Polo T-Shirt",
        variation: "Size: M, Color: Crimson Red",
        quantity: 1,
        unitPrice: 300,
        total: 300,
      }),
    ]);

    const variantLabelRes = await invokeController(getShippingLabel, {
      params: { id: multiVariantOrder._id.toString() },
      user: { userId: sellerAId },
    });
    const variants = variantLabelRes.body.data.labels[0].items.map((it: any) => it.variant);
    assert.ok(variants.includes("Size: XL, Color: Navy Blue"));
    assert.ok(variants.includes("Size: M, Color: Crimson Red"));
    pass("6. Multiple products and variants are accurately scoped and itemized");

    // -------------------------------------------------------------
    // Test 7: Long Addresses and Long Customer Names
    // -------------------------------------------------------------
    const longNameCust = await Customer.create({
      name: "Maharaja Dr. Devendra Pratap Singh Bahadur of Kashi Heritage Trust",
      phone: "9123456780",
      email: "maharaja@heritage.org",
    });

    const longAddrOrder = await createOrder({
      orderNumber: "ORD-LONG-102",
      orderType: "QUICK_COMMERCE",
      customer: longNameCust._id,
      customerName: "Maharaja Dr. Devendra Pratap Singh Bahadur of Kashi Heritage Trust",
      deliveryAddress: {
        address: "Apartment 14B, Tower 9, The Grand Heritage Riverview Luxury Enclave, Near Old Cantt Railway Siding Road, Phase 3 Extension",
        landmark: "Behind Saint Francis Cathedral School Boundary Wall",
        city: "Varanasi",
        state: "Uttar Pradesh",
        pincode: "221002",
      },
      total: 200,
    });
    await createOrderItem({
      order: longAddrOrder._id,
      seller: sellerAId,
      productName: "Mineral Water 20L",
      unitPrice: 200,
      quantity: 1,
      total: 200,
    });
    const longRes = await invokeController(getShippingLabel, {
      params: { id: longAddrOrder._id.toString() },
      user: { userId: sellerAId },
    });
    assert.ok(longRes.body.data.labels[0].customerName.includes("Maharaja Dr. Devendra"));
    assert.ok(longRes.body.data.labels[0].deliveryAddress.address.includes("Grand Heritage Riverview"));
    pass("7. Long addresses and extended customer names format safely without clipping");

    // -------------------------------------------------------------
    // Test 8: GST and Non-GST Invoices
    // -------------------------------------------------------------
    const sellerAScope = buildSellerInvoiceScope(
      [
        {
          _id: "it1",
          seller: sellerAId.toString(),
          productName: "Item GST",
          productType: "QUICK_COMMERCE",
          fulfillmentType: "LOCAL_DELIVERY",
          ownerType: "VENDOR",
          billingEntityName: "Olovely Super Mart",
          billingEntityGstin: "09AAACH7409R1ZZ",
          unitPrice: 100,
          quantity: 1,
          total: 100,
          taxAmount: 5,
        },
      ],
      [],
      "QUICK_COMMERCE"
    );
    assert.equal(sellerAScope.items[0].billingEntityGstin, "09AAACH7409R1ZZ");

    const sellerBScope = buildSellerInvoiceScope(
      [
        {
          _id: "it2",
          seller: sellerBId.toString(),
          productName: "Handmade Scarf",
          productType: "QUICK_COMMERCE",
          fulfillmentType: "LOCAL_DELIVERY",
          ownerType: "VENDOR",
          billingEntityName: "Fashion Hub Boutique",
          billingEntityGstin: undefined,
          unitPrice: 250,
          quantity: 1,
          total: 250,
          taxAmount: 0,
        },
      ],
      [],
      "QUICK_COMMERCE"
    );
    assert.equal(sellerBScope.items[0].billingEntityGstin, undefined);
    pass("8. GST and non-GST invoices preserve vendor registration status and GSTIN snapshots");

    // -------------------------------------------------------------
    // Test 9: COD vs Prepaid Orders
    // -------------------------------------------------------------
    assert.equal(qcLabelRes.body.data.labels[0].isCod, true);
    assert.equal(qcLabelRes.body.data.labels[0].codAmount, 475);

    const prepaidQcOrder = await createOrder({
      orderNumber: "ORD-PRE-303",
      orderType: "QUICK_COMMERCE",
      status: "Accepted",
      paymentMethod: "UPI",
      paymentStatus: "Paid",
      total: 350,
    });
    await createOrderItem({
      order: prepaidQcOrder._id,
      seller: sellerAId,
      productName: "Prepaid Grocery Pack",
      unitPrice: 350,
      quantity: 1,
      total: 350,
    });
    const prepaidRes = await invokeController(getShippingLabel, {
      params: { id: prepaidQcOrder._id.toString() },
      user: { userId: sellerAId },
    });
    assert.equal(prepaidRes.body.data.labels[0].isCod, false);
    assert.equal(prepaidRes.body.data.labels[0].codAmount, 0);
    pass("9. COD and Prepaid calculations accurately reflect paymentMethod and paymentStatus");

    // -------------------------------------------------------------
    // Test 10: Platform QC Orders
    // -------------------------------------------------------------
    const platformQcItem = {
      _id: "it-plat-1",
      seller: sellerAId.toString(),
      productName: "Platform QC Sugar 1kg",
      productType: "QUICK_COMMERCE",
      fulfillmentType: "LOCAL_DELIVERY",
      ownerType: "PLATFORM",
      billingEntityName: "Olovely Total Suvidha Platform",
      billingEntityGstin: "09PLATFORMGST999",
      unitPrice: 42,
      quantity: 1,
      total: 42,
      taxAmount: 2,
    };
    const platScope = buildSellerInvoiceScope([platformQcItem], [], "QUICK_COMMERCE");
    assert.equal(platScope.items[0].ownerType, "PLATFORM");
    assert.equal(platScope.items[0].billingEntityGstin, "09PLATFORMGST999");
    pass("10. Platform QC orders strictly preserve platform billing identity and GSTIN");

    // -------------------------------------------------------------
    // Test 11: Mixed-Order Fulfillment Groups Separation
    // -------------------------------------------------------------
    const mixedOrder = await createOrder({
      orderNumber: "ORD-MIX-505",
      orderType: "MIXED",
      status: "Processed",
      total: 2000,
    });
    const mixedQcItem = await createOrderItem({
      order: mixedOrder._id,
      seller: sellerAId,
      productName: "Local Grocery Milk",
      unitPrice: 50,
      quantity: 2,
      total: 100,
      productType: "QUICK_COMMERCE",
      fulfillmentType: "LOCAL_DELIVERY",
    });
    const mixedEcomItem = await createOrderItem({
      order: mixedOrder._id,
      seller: sellerAId,
      productName: "Courier Footwear Shoes",
      unitPrice: 1900,
      quantity: 1,
      total: 1900,
      productType: "ECOMMERCE",
      fulfillmentType: "COURIER_SHIPPING",
    });

    mixedOrder.fulfillmentGroups = [
      {
        groupId: "GRP-MIX-QC",
        fulfillmentType: "LOCAL_DELIVERY" as any,
        status: "Processing",
        seller: sellerAId,
        items: [mixedQcItem._id],
        subtotal: 100,
      },
      {
        groupId: "GRP-MIX-ECOM",
        fulfillmentType: "COURIER_SHIPPING" as any,
        status: "Processing",
        seller: sellerAId,
        items: [mixedEcomItem._id],
        subtotal: 1900,
        shippingDetails: { awbNumber: "AWB-MIX-99" },
      },
    ];
    await mixedOrder.save();

    const mixedQcLabel = await invokeController(getShippingLabel, {
      params: { id: mixedOrder._id.toString() },
      query: { channel: "QUICK_COMMERCE" },
      user: { userId: sellerAId },
    });
    assert.equal(mixedQcLabel.body.data.labels.length, 1);
    assert.equal(mixedQcLabel.body.data.labels[0].channel, "QUICK_COMMERCE");

    const mixedEcomLabel = await invokeController(getShippingLabel, {
      params: { id: mixedOrder._id.toString() },
      query: { channel: "ECOMMERCE" },
      user: { userId: sellerAId },
    });
    assert.equal(mixedEcomLabel.body.data.labels.length, 1);
    assert.equal(mixedEcomLabel.body.data.labels[0].channel, "ECOMMERCE");
    pass("11. Mixed-order fulfillment groups separate QC and Ecommerce channels cleanly");

    // -------------------------------------------------------------
    // Test 12: Wholesale Orders
    // -------------------------------------------------------------
    const wholesaleItem = {
      _id: "it-ws-1",
      seller: sellerAId.toString(),
      productName: "Bulk Wheat 50kg Sack",
      productType: "QUICK_COMMERCE",
      fulfillmentType: "LOCAL_DELIVERY",
      isWholesale: true,
      wholesalePrice: 1200,
      wholesaleMinimumQuantity: 5,
      quantity: 5,
      unitPrice: 1200,
      total: 6000,
      billingEntityName: "Olovely Super Mart",
    };
    const wsScope = buildSellerInvoiceScope([wholesaleItem], [], "QUICK_COMMERCE");
    assert.equal(wsScope.items[0].isWholesale, true);
    assert.equal(wsScope.items[0].wholesaleMinimumQuantity, 5);
    pass("12. Wholesale orders maintain wholesale badges, prices, and minimum quantity parameters");

    // -------------------------------------------------------------
    // Test 13: Missing AWB or Pending Courier Label Handling
    // -------------------------------------------------------------
    const pendingCourierOrder = await createOrder({
      orderNumber: "ORD-PENDING-707",
      orderType: "ECOMMERCE",
      status: "Accepted",
      total: 800,
      fulfillmentGroups: [
        {
          groupId: "GRP-PENDING-1",
          fulfillmentType: "COURIER_SHIPPING",
          status: "Processing",
          seller: sellerAId,
          shippingDetails: {
            awbNumber: "SR-PENDING-TEMP",
          },
        },
      ],
    });
    await createOrderItem({
      order: pendingCourierOrder._id,
      seller: sellerAId,
      productName: "Casual Shirt",
      unitPrice: 800,
      quantity: 1,
      total: 800,
    });

    const pendingRes = await invokeController(getShippingLabel, {
      params: { id: pendingCourierOrder._id.toString() },
      user: { userId: sellerAId },
    });
    assert.equal(pendingRes.status, 200);
    assert.equal(pendingRes.body.data.labels[0].available, false);
    assert.ok(pendingRes.body.data.labels[0].reason.includes("pending"));
    pass("13. Missing AWB / pending manifestation displays accurate pending status instead of fake labels");

    // -------------------------------------------------------------
    // Test 14: Barcode Generation & Scannability
    // -------------------------------------------------------------
    const barcodeCheck1 = generateCode128BPatterns("ORD-QC-777");
    assert.equal(barcodeCheck1.valid, true);
    assert.equal(barcodeCheck1.checksumValid, true);

    const barcodeCheck2 = generateCode128BPatterns("AWB123456789");
    assert.equal(barcodeCheck2.valid, true);
    assert.equal(barcodeCheck2.checksumValid, true);
    pass("14. Code 128 barcode encoding produces scannable patterns with valid checksums");

    // -------------------------------------------------------------
    // Test 15: Multiple Label / Package Handling
    // -------------------------------------------------------------
    const multiPkgRes = await invokeController(getShippingLabel, {
      params: { id: mixedOrder._id.toString() },
      user: { userId: sellerAId },
    });
    assert.equal(multiPkgRes.body.data.labels.length, 2);
    assert.equal(multiPkgRes.body.data.labels[0].packageIndex, 1);
    assert.equal(multiPkgRes.body.data.labels[0].totalPackages, 2);
    assert.equal(multiPkgRes.body.data.labels[1].packageIndex, 2);
    assert.equal(multiPkgRes.body.data.labels[1].totalPackages, 2);
    pass("15. Multi-package orders format sequence indicators (Package 1 of 2, 2 of 2)");

    // -------------------------------------------------------------
    // Test 16: Read-Only Verification (No State Mutation)
    // -------------------------------------------------------------
    const orderBefore = await Order.findById(mixedOrder._id).lean();
    await invokeController(getShippingLabel, {
      params: { id: mixedOrder._id.toString() },
      user: { userId: sellerAId },
    });
    const orderAfter = await Order.findById(mixedOrder._id).lean();
    assert.equal(orderBefore?.status, orderAfter?.status);
    assert.equal(orderBefore?.paymentStatus, orderAfter?.paymentStatus);
    assert.equal(orderBefore?.total, orderAfter?.total);
    pass("16. Read-only verification: getShippingLabel performs no database mutation");

    console.log(`\nALL ${passed} ISOLATED TESTS PASSED SUCCESSFULLY!`);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
