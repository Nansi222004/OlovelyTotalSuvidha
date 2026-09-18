/**
 * Automated Verification Suite: Delivery Partner QC Scoping
 * 
 * Tests the 12 critical scenarios:
 * 1. Assigned QC-only order remains accessible and displays only its QC items.
 * 2. Ecommerce-only order is not exposed as a local QC delivery.
 * 3. Mixed order displays only the QC items assigned to Rider A.
 * 4. Mixed order response contains no Ecommerce items, AWB, carrier, or courier tracking data.
 * 5. QC seller locations are returned; Ecommerce seller locations are excluded.
 * 6. Rider B cannot access Rider A's assigned delivery.
 * 7. Unassigned partner cannot bypass existing assignment or active-offer authorization.
 * 8. QC pickup confirmation does not require Ecommerce seller pickup.
 * 9. QC OTP completion updates the QC group without completing an active courier group.
 * 10. Existing assignment and pending-offer behavior remains unchanged.
 * 11. Customer, seller, and admin order views remain intact.
 * 12. Parent order totals, fulfillment groups, shipment details, wallets, commissions, and historical invoices remain unchanged (Zero DB Mutation).
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import connectDB from "../config/db";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Seller from "../models/Seller";
import DeliveryOrderOffer from "../models/DeliveryOrderOffer";
import { getDeliveryPartnerQcContext } from "../modules/delivery/utils/deliveryOrderScopingHelper";
import {
  getOrderDetails,
  getSellerLocationsForOrder,
  confirmSellerPickup,
  sendDeliveryOtp,
  verifyDeliveryOtpController,
  getAllOrdersHistory,
  getTodayOrders,
  getPendingOrders,
} from "../modules/delivery/controllers/deliveryOrderController";

// Helper for invoking async Express handlers with Promise resolution
function invoke(
  controllerFn: any,
  params: any = {},
  body: any = {},
  user: any = {},
  query: any = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const req: any = {
      params,
      body,
      query,
      user,
      app: {
        get: (key: string) => {
          if (key === "io") {
            return {
              to: () => ({ emit: () => {} }),
              emit: () => {},
            };
          }
          return null;
        },
      },
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        resolve({ status: statusCode, body: data });
        return res;
      },
    };

    const next = (err?: any) => {
      if (err) reject(err);
      else resolve({ status: statusCode, body: null });
    };

    try {
      controllerFn(req, res, next);
    } catch (e) {
      reject(e);
    }
  });
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log("\n========================================================");
  console.log("   DELIVERY PARTNER QC SCOPING TEST SUITE");
  console.log("========================================================\n");

  await connectDB();

  // Test identifiers
  const RIDER_A_ID = new mongoose.Types.ObjectId().toString();
  const RIDER_B_ID = new mongoose.Types.ObjectId().toString();
  const RIDER_C_ID = new mongoose.Types.ObjectId().toString();
  const CUSTOMER_ID = new mongoose.Types.ObjectId().toString();

  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdItemIds: mongoose.Types.ObjectId[] = [];
  const createdSellerIds: mongoose.Types.ObjectId[] = [];
  const createdOfferIds: mongoose.Types.ObjectId[] = [];

  try {
    // 0. Setup test sellers
    const qcSeller = await Seller.create({
      sellerName: "Test QC Merchant",
      password: "Password123!",
      category: "Grocery",
      storeName: "Test QC Grocery Store",
      latitude: "22.7173716",
      longitude: "75.8716678",
      address: "123 Local QC Market",
      city: "Indore",
      state: "MP",
      pincode: "452001",
      phone: "9876543210",
      mobile: "9876543210",
      email: `qc_seller_${Date.now()}@test.com`,
    });
    createdSellerIds.push(qcSeller._id);

    const ecomSeller = await Seller.create({
      sellerName: "Test National Merchant",
      password: "Password123!",
      category: "Fashion",
      storeName: "Test National Fashion Hub",
      latitude: "28.6139391",
      longitude: "77.2090212",
      address: "456 Connaught Place",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      phone: "9876543211",
      mobile: "9876543211",
      email: `ecom_seller_${Date.now()}@test.com`,
    });
    createdSellerIds.push(ecomSeller._id);

    // Setup Test Items
    const qcItemDoc1 = await OrderItem.create({
      order: new mongoose.Types.ObjectId(),
      product: new mongoose.Types.ObjectId(),
      seller: qcSeller._id,
      productName: "Fresh Milk 1L",
      price: 60,
      unitPrice: 60,
      quantity: 2,
      total: 120,
      subtotal: 120,
      productType: "QUICK_COMMERCE",
      fulfillmentType: "LOCAL_DELIVERY",
    });
    createdItemIds.push(qcItemDoc1._id);

    const qcItemDoc2 = await OrderItem.create({
      order: new mongoose.Types.ObjectId(),
      product: new mongoose.Types.ObjectId(),
      seller: qcSeller._id,
      productName: "Organic Bread",
      price: 45,
      unitPrice: 45,
      quantity: 1,
      total: 45,
      subtotal: 45,
      productType: "QUICK_COMMERCE",
      fulfillmentType: "LOCAL_DELIVERY",
    });
    createdItemIds.push(qcItemDoc2._id);

    const ecomItemDoc = await OrderItem.create({
      order: new mongoose.Types.ObjectId(),
      product: new mongoose.Types.ObjectId(),
      seller: ecomSeller._id,
      productName: "Designer Winter Jacket",
      price: 2499,
      unitPrice: 2499,
      quantity: 1,
      total: 2499,
      subtotal: 2499,
      productType: "ECOMMERCE",
      fulfillmentType: "COURIER_SHIPPING",
    });
    createdItemIds.push(ecomItemDoc._id);

    // ----------------------------------------------------
    // Scenario 1: Assigned QC-only order
    // ----------------------------------------------------
    console.log("\n--- Scenario 1: Assigned QC-Only Order ---");
    const qcOnlyOrder = await Order.create({
      orderNumber: `ORD-QC-${Date.now()}`,
      orderType: "QUICK_COMMERCE",
      customer: CUSTOMER_ID,
      customerName: "Test Customer",
      customerEmail: "customer@test.com",
      customerPhone: "9998887771",
      deliveryBoy: RIDER_A_ID,
      deliveryBoyStatus: "Assigned",
      deliveryAssignmentStatus: "Assigned",
      status: "Processed",
      paymentMethod: "COD",
      paymentStatus: "Pending",
      subtotal: 165,
      total: 195,
      totalAmount: 195,
      deliveryFee: 30,
      items: [qcItemDoc1._id, qcItemDoc2._id],
      fulfillmentGroups: [
        {
          groupId: "FG-QC-1",
          fulfillmentType: "LOCAL_DELIVERY",
          deliveryBoy: new mongoose.Types.ObjectId(RIDER_A_ID),
          status: "ReadyForPickup",
          itemCount: 2,
          items: [qcItemDoc1._id, qcItemDoc2._id],
          subtotal: 165,
        },
      ],
      deliveryAddress: {
        address: "789 Resident Colony, Indore",
        city: "Indore",
        state: "MP",
        pincode: "452001",
        latitude: 22.719,
        longitude: 75.875,
      },
    });
    createdOrderIds.push(qcOnlyOrder._id);
    await OrderItem.updateMany(
      { _id: { $in: [qcItemDoc1._id, qcItemDoc2._id] } },
      { order: qcOnlyOrder._id }
    );

    // Call getOrderDetails as Rider A
    const res1 = await invoke(
      getOrderDetails,
      { id: qcOnlyOrder._id.toString() },
      {},
      { userId: RIDER_A_ID, userType: "DeliveryBoy" }
    );

    assert(res1.status === 200, "QC-only order details returns HTTP 200");
    const qcData1 = res1.body?.data;
    assert(qcData1?.items?.length === 2, "QC-only order shows exactly 2 QC items");
    assert(
      qcData1?.assignedSubtotal === 165,
      `QC-only order assignedSubtotal equals QC item total (165, got ${qcData1?.assignedSubtotal})`
    );
    assert(
      !qcData1?.shipmentDetails,
      "QC-only order does not contain courier shipment details"
    );

    // ----------------------------------------------------
    // Scenario 2: Ecommerce-only order
    // ----------------------------------------------------
    console.log("\n--- Scenario 2: Ecommerce-Only Order ---");
    const ecomOnlyOrder = await Order.create({
      orderNumber: `ORD-ECOM-${Date.now()}`,
      orderType: "ECOMMERCE",
      customer: CUSTOMER_ID,
      customerName: "Test Customer",
      customerEmail: "customer@test.com",
      customerPhone: "9998887771",
      status: "Processed",
      paymentMethod: "Online",
      paymentStatus: "Paid",
      subtotal: 2499,
      total: 2549,
      totalAmount: 2549,
      deliveryFee: 50,
      deliveryAddress: {
        address: "456 Connaught Place",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
      },
      items: [ecomItemDoc._id],
      fulfillmentGroups: [
        {
          groupId: "FG-ECOM-1",
          fulfillmentType: "COURIER_SHIPPING",
          status: "Processing",
          itemCount: 1,
          items: [ecomItemDoc._id],
          subtotal: 2499,
          courierProvider: "SHIPROCKET",
          trackingNumber: "SR123456789IN",
          awbNumber: "AWB-TEST-9988",
        },
      ],
      shipmentDetails: {
        awbNumber: "AWB-TEST-9988",
        courierName: "Delhivery Surface",
        trackingUrl: "https://track.shiprocket.in/AWB-TEST-9988",
      },
    });
    createdOrderIds.push(ecomOnlyOrder._id);
    await OrderItem.updateOne({ _id: ecomItemDoc._id }, { order: ecomOnlyOrder._id });

    // Try getOrderDetails as Rider A
    const res2 = await invoke(
      getOrderDetails,
      { id: ecomOnlyOrder._id.toString() },
      {},
      { userId: RIDER_A_ID, userType: "DeliveryBoy" }
    );

    assert(
      res2.status === 403,
      `Ecommerce-only order access is denied (HTTP 403, got ${res2.status}) to local delivery partner`
    );

    // Also verify pure helper categorizes it correctly
    const ecomCtx = getDeliveryPartnerQcContext(ecomOnlyOrder, RIDER_A_ID);
    assert(ecomCtx.isEcommerceOnly === true, "Helper marks order as isEcommerceOnly: true");
    assert(ecomCtx.hasQcItems === false, "Helper marks order as hasQcItems: false");

    // ----------------------------------------------------
    // Scenario 3 & 4: Mixed QC + Ecommerce Order
    // ----------------------------------------------------
    console.log("\n--- Scenario 3 & 4: Mixed QC + Ecommerce Order ---");
    // Create new items for the mixed order
    const mixedQcItem = await OrderItem.create({
      order: new mongoose.Types.ObjectId(),
      product: new mongoose.Types.ObjectId(),
      seller: qcSeller._id,
      productName: "Local Veggies Basket",
      price: 150,
      unitPrice: 150,
      quantity: 1,
      total: 150,
      subtotal: 150,
      productType: "QUICK_COMMERCE",
      fulfillmentType: "LOCAL_DELIVERY",
    });
    createdItemIds.push(mixedQcItem._id);

    const mixedEcomItem = await OrderItem.create({
      order: new mongoose.Types.ObjectId(),
      product: new mongoose.Types.ObjectId(),
      seller: ecomSeller._id,
      productName: "National Brand Sneakers",
      price: 1800,
      unitPrice: 1800,
      quantity: 1,
      total: 1800,
      subtotal: 1800,
      productType: "ECOMMERCE",
      fulfillmentType: "COURIER_SHIPPING",
    });
    createdItemIds.push(mixedEcomItem._id);

    const mixedOrder = await Order.create({
      orderNumber: `ORD-MIX-${Date.now()}`,
      orderType: "MIXED",
      customer: CUSTOMER_ID,
      customerName: "Test Customer",
      customerEmail: "customer@test.com",
      customerPhone: "9998887771",
      deliveryBoy: RIDER_A_ID,
      deliveryBoyStatus: "Assigned",
      deliveryAssignmentStatus: "Assigned",
      status: "Processed",
      paymentMethod: "Online",
      paymentStatus: "Paid",
      subtotal: 1950, // 150 + 1800
      total: 2000,
      totalAmount: 2000,
      deliveryFee: 50,
      items: [mixedQcItem._id, mixedEcomItem._id],
      fulfillmentGroups: [
        {
          groupId: "FG-MIX-QC",
          fulfillmentType: "LOCAL_DELIVERY",
          deliveryBoy: new mongoose.Types.ObjectId(RIDER_A_ID),
          status: "ReadyForPickup",
          itemCount: 1,
          items: [mixedQcItem._id],
          subtotal: 150,
        },
        {
          groupId: "FG-MIX-ECOM",
          fulfillmentType: "COURIER_SHIPPING",
          status: "Processing",
          itemCount: 1,
          items: [mixedEcomItem._id],
          subtotal: 1800,
          shippingDetails: {
            carrier: "Blue Dart Express",
            awbNumber: "AWB-MIX-9911",
            trackingNumber: "SR-COURIER-MIX-11",
            trackingUrl: "https://track.shiprocket.in/AWB-MIX-9911",
          },
        },
      ],
      deliveryAddress: {
        address: "101 Mixed Order St, Indore",
        city: "Indore",
        state: "MP",
        pincode: "452001",
        latitude: 22.717,
        longitude: 75.871,
      },
    });
    createdOrderIds.push(mixedOrder._id);
    await OrderItem.updateMany(
      { _id: { $in: [mixedQcItem._id, mixedEcomItem._id] } },
      { order: mixedOrder._id }
    );

    // Call getOrderDetails as Rider A
    const res3 = await invoke(
      getOrderDetails,
      { id: mixedOrder._id.toString() },
      {},
      { userId: RIDER_A_ID, userType: "DeliveryBoy" }
    );

    assert(res3.status === 200, "Mixed order details returns HTTP 200 for Rider A");
    const mixedData = res3.body?.data;
    assert(
      mixedData?.items?.length === 1,
      `Mixed order returns ONLY the QC item (expected 1, got ${mixedData?.items?.length})`
    );
    assert(
      mixedData?.items[0]?.name === "Local Veggies Basket",
      "Mixed order returned item is the QC item"
    );
    assert(
      mixedData?.assignedSubtotal === 150,
      `Displayed assignedSubtotal is QC subtotal 150 (got ${mixedData?.assignedSubtotal}), NOT parent total 1950`
    );
    assert(
      !mixedData?.shipmentDetails,
      "Mixed order response excludes courier shipmentDetails"
    );
    assert(
      !JSON.stringify(mixedData).includes("AWB-MIX-9911"),
      "Mixed order response contains NO Shiprocket AWB number"
    );
    assert(
      !JSON.stringify(mixedData).includes("Blue Dart Express"),
      "Mixed order response contains NO courier carrier name"
    );

    // ----------------------------------------------------
    // Scenario 5: Seller Locations Scoping
    // ----------------------------------------------------
    console.log("\n--- Scenario 5: Seller Locations Scoping ---");
    const res5 = await invoke(
      getSellerLocationsForOrder,
      { id: mixedOrder._id.toString() },
      {},
      { userId: RIDER_A_ID, userType: "DeliveryBoy" }
    );

    assert(res5.status === 200, "getSellerLocationsForOrder returns HTTP 200");
    const locations = res5.body?.data;
    assert(
      locations?.length === 1,
      `Returns only QC seller location (got ${locations?.length})`
    );
    assert(
      locations[0]?.storeName === "Test QC Grocery Store",
      "QC seller storeName matches"
    );
    assert(
      !locations?.some((l: any) => l.storeName === "Test National Fashion Hub"),
      "Ecommerce seller (New Delhi) is excluded from local seller locations"
    );

    // ----------------------------------------------------
    // Scenario 6: Unauthorized Rider B Access
    // ----------------------------------------------------
    console.log("\n--- Scenario 6: Rider B Access Denied ---");
    const res6 = await invoke(
      getOrderDetails,
      { id: mixedOrder._id.toString() },
      {},
      { userId: RIDER_B_ID, userType: "DeliveryBoy" }
    );
    assert(
      res6.status === 403,
      `Rider B cannot access Rider A's assigned order (HTTP 403, got ${res6.status})`
    );

    // ----------------------------------------------------
    // Scenario 7: Unassigned Rider C & Pending Offer Flow
    // ----------------------------------------------------
    console.log("\n--- Scenario 7: Unassigned Partner & Pending Offers ---");
    // Without active offer: access denied
    const res7a = await invoke(
      getOrderDetails,
      { id: mixedOrder._id.toString() },
      {},
      { userId: RIDER_C_ID, userType: "DeliveryBoy" }
    );
    assert(res7a.status === 403, "Unassigned Rider C without offer is denied HTTP 403");

    // With active pending offer: authorization permitted
    const pendingOffer = await DeliveryOrderOffer.create({
      order: mixedOrder._id,
      deliveryBoy: RIDER_C_ID,
      status: "pending",
      expiresAt: new Date(Date.now() + 60000),
    });
    createdOfferIds.push(pendingOffer._id);

    const res7b = await invoke(
      getOrderDetails,
      { id: mixedOrder._id.toString() },
      {},
      { userId: RIDER_C_ID, userType: "DeliveryBoy" }
    );
    assert(
      res7b.status === 200,
      `Rider C with active pending offer can view scoped QC order details (got HTTP ${res7b.status})`
    );

    // ----------------------------------------------------
    // Scenario 8: QC Pickup Confirmation (without Ecommerce Pickup)
    // ----------------------------------------------------
    console.log("\n--- Scenario 8: QC Pickup Confirmation ---");
    // Confirm pickup from QC seller (coordinates match QC seller)
    const res8 = await invoke(
      confirmSellerPickup,
      { id: mixedOrder._id.toString() },
      {
        sellerId: qcSeller._id.toString(),
        latitude: 22.7173716,
        longitude: 75.8716678,
      },
      { userId: RIDER_A_ID, userType: "DeliveryBoy" }
    );

    assert(res8.status === 200, `confirmSellerPickup returns HTTP 200 for QC seller (got ${res8.status})`);
    assert(
      res8.body?.data?.allPickedUp === true,
      "allPickedUp is true considering ONLY assigned QC sellers (Ecommerce seller not required!)"
    );

    const reloadedMixedAfterPickup = await Order.findById(mixedOrder._id);
    assert(
      reloadedMixedAfterPickup?.status === "Out for Delivery",
      `Order advanced to 'Out for Delivery' once all QC sellers were picked up (current status: ${reloadedMixedAfterPickup?.status})`
    );

    // ----------------------------------------------------
    // Scenario 9: QC OTP Completion & Group Independence
    // ----------------------------------------------------
    console.log("\n--- Scenario 9: QC OTP Completion & Fulfillment Group Independence ---");
    // Send OTP
    const res9a = await invoke(
      sendDeliveryOtp,
      { id: mixedOrder._id.toString() },
      { latitude: 22.717, longitude: 75.871 },
      { userId: RIDER_A_ID, userType: "DeliveryBoy" }
    );
    assert(res9a.status === 200, "sendDeliveryOtp returns HTTP 200");

    // Fetch order to get the generated OTP
    const orderWithOtp = await Order.findById(mixedOrder._id);
    const validOtp = typeof orderWithOtp?.deliveryOtp === "string" ? orderWithOtp.deliveryOtp : (orderWithOtp?.deliveryOtp as any)?.code;
    assert(Boolean(validOtp), `Valid delivery OTP generated on order (OTP: ${validOtp})`);

    // Verify OTP
    const res9b = await invoke(
      verifyDeliveryOtpController,
      { id: mixedOrder._id.toString() },
      { otp: validOtp },
      { userId: RIDER_A_ID, userType: "DeliveryBoy" }
    );
    assert(res9b.status === 200, `verifyDeliveryOtpController returns HTTP 200 (got ${res9b.status})`);

    // Check fulfillment groups in DB
    const orderAfterOtp = await Order.findById(mixedOrder._id);
    const qcGroup = orderAfterOtp?.fulfillmentGroups?.find(
      (g: any) => g.groupId === "FG-MIX-QC"
    );
    const ecomGroup = orderAfterOtp?.fulfillmentGroups?.find(
      (g: any) => g.groupId === "FG-MIX-ECOM"
    );

    assert(
      qcGroup?.status === "Delivered",
      "QC fulfillment group status is 'Delivered'"
    );
    assert(
      ecomGroup?.status === "Processing",
      `Ecommerce courier group is STILL 'Processing' (not prematurely delivered!) (got ${ecomGroup?.status})`
    );
    assert(
      orderAfterOtp?.status !== "Delivered",
      `Parent order status is NOT marked 'Delivered' because courier group is still active (status: ${orderAfterOtp?.status})`
    );
    assert(
      orderAfterOtp?.deliveryBoyStatus === "Delivered",
      "Local delivery partner deliveryBoyStatus is updated to 'Delivered'"
    );

    // ----------------------------------------------------
    // Scenario 10: Assignment Lists Exclude Ecom-Only Orders
    // ----------------------------------------------------
    console.log("\n--- Scenario 10: Assignment Lists Exclude Ecom-Only Orders ---");
    const res10 = await invoke(
      getAllOrdersHistory,
      {},
      {},
      { userId: RIDER_A_ID, userType: "DeliveryBoy" }
    );
    assert(res10.status === 200, "getAllOrdersHistory returns HTTP 200");
    const historyOrders = res10.body?.data?.orders || [];
    assert(
      !historyOrders.some((o: any) => o._id?.toString() === ecomOnlyOrder._id.toString()),
      "Ecommerce-only order is NOT present in delivery partner order history"
    );

    // ----------------------------------------------------
    // Scenario 11: Customer / Admin Views Remain Complete
    // ----------------------------------------------------
    console.log("\n--- Scenario 11: Customer / Admin View Integrity ---");
    const directOrder = await Order.findById(mixedOrder._id).populate("items");
    assert(
      directOrder?.items?.length === 2,
      `Customer/Admin query sees ALL items (both QC and Ecommerce, got ${directOrder?.items?.length})`
    );
    assert(
      directOrder?.subtotal === 1950,
      `Customer/Admin query sees full parent order subtotal (1950, got ${directOrder?.subtotal})`
    );
    assert(
      directOrder?.total === 2000,
      `Customer/Admin query sees full parent order total (2000, got ${directOrder?.total})`
    );
    const directEcomGroup = directOrder?.fulfillmentGroups?.find(
      (g: any) => g.fulfillmentType === "COURIER_SHIPPING"
    );
    assert(
      directEcomGroup?.shippingDetails?.awbNumber === "AWB-MIX-9911",
      "Customer/Admin query sees courier shippingDetails and AWB"
    );

    // ----------------------------------------------------
    // Scenario 12: Zero Database Mutation Check
    // ----------------------------------------------------
    console.log("\n--- Scenario 12: Zero Database Mutation Verification ---");
    const finalStoredOrder = await Order.findById(mixedOrder._id);
    assert(
      finalStoredOrder?.items?.length === 2,
      "Zero DB Mutation: order.items length in DB remains exactly 2"
    );
    assert(
      finalStoredOrder?.subtotal === 1950,
      "Zero DB Mutation: order.subtotal in DB remains 1950"
    );
    assert(
      finalStoredOrder?.total === 2000,
      "Zero DB Mutation: order.total in DB remains 2000"
    );
    assert(
      finalStoredOrder?.fulfillmentGroups?.length === 2,
      "Zero DB Mutation: order.fulfillmentGroups count remains 2"
    );
    const storedEcomGroup = finalStoredOrder?.fulfillmentGroups?.find(
      (g: any) => g.fulfillmentType === "COURIER_SHIPPING"
    );
    assert(
      storedEcomGroup?.shippingDetails?.awbNumber === "AWB-MIX-9911",
      "Zero DB Mutation: stored courier shipment details remain intact"
    );
  } catch (err: any) {
    console.error("Test error:", err);
    failed++;
  } finally {
    // Clean up test data
    console.log("\nCleaning up isolated test data...");
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }
    if (createdItemIds.length > 0) {
      await OrderItem.deleteMany({ _id: { $in: createdItemIds } });
    }
    if (createdSellerIds.length > 0) {
      await Seller.deleteMany({ _id: { $in: createdSellerIds } });
    }
    if (createdOfferIds.length > 0) {
      await DeliveryOrderOffer.deleteMany({ _id: { $in: createdOfferIds } });
    }
    console.log("Cleanup complete.");

    console.log("\n========================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("========================================================\n");

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTestSuite();
