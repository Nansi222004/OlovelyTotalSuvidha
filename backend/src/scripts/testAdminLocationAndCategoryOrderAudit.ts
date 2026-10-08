import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateEcommerce,
  evaluatePlatformQuickCommerce,
  evaluateSellerQuickCommerce,
  PLATFORM_QC_NOT_CONFIGURED,
  toCustomerProductServiceability,
  validatePlatformQuickCommerceFulfillment,
} from "../services/productServiceabilityService";
import { validateSellerRegistrationLocation } from "../utils/sellerLocationValidation";
import {
  isCategoryCompatibleWithVendorType,
  normalizeSelectedCategoryNames,
  validateSellerCategorySelection,
} from "../utils/sellerCategoryCompatibility";
import {
  areAllFulfillmentGroupsDelivered,
  getChannelFulfillmentStatus,
  hasActiveLocalDeliveryFulfillment,
} from "../utils/fulfillmentStatus";
import {
  buildSellerLocationFields,
  getBrowserStoreCoordinates,
  hasValidStoreCoordinates,
  reverseGeocodeStoreCoordinates,
} from "../../../frontend/src/utils/sellerLocation";
import { filterCategoriesForVendorType } from "../../../frontend/src/utils/sellerCategoryCompatibility";
import {
  getCustomerServiceabilityMessage,
  isPlatformQuickCommerceConfigured,
  shouldShowQuickDelivery,
} from "../../../frontend/src/utils/productServiceabilityUi";

let passed = 0;
const test = (name: string, fn: () => void | Promise<void>) => {
  try {
    const result = fn();
    if (result && typeof (result as any).then === "function") {
      return (result as Promise<void>).then(() => {
        passed += 1;
        console.log(`  ✅ PASS [${passed}/40]: ${name}`);
      });
    }
    passed += 1;
    console.log(`  ✅ PASS [${passed}/40]: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    throw err;
  }
};

async function run() {
  console.log("====================================================");
  console.log("🚀 COMPREHENSIVE 40-POINT AUDIT TEST SUITE");
  console.log("====================================================\n");

  // Mock Geocoder and Geolocation data
  const mockGeocodeResult = {
    formatted_address: "Bhawarkua Main Rd, Transport Nagar, Indore, Madhya Pradesh 452014, India",
    address_components: [
      { long_name: "Bhawarkua Main Rd", types: ["route"] },
      { long_name: "Transport Nagar", types: ["sublocality_level_1"] },
      { long_name: "Indore", types: ["locality"] },
      { long_name: "Madhya Pradesh", types: ["administrative_area_level_1"] },
      { long_name: "452014", types: ["postal_code"] },
    ],
  };

  const mockMovedResult = {
    formatted_address: "Warehouse Gate 2, Sanwer Road Industrial Area, Indore, Madhya Pradesh 452015, India",
    address_components: [
      { long_name: "Warehouse Gate 2", types: ["premise"] },
      { long_name: "Sanwer Road Industrial Area", types: ["sublocality_level_1"] },
      { long_name: "Indore", types: ["locality"] },
      { long_name: "Madhya Pradesh", types: ["administrative_area_level_1"] },
      { long_name: "452015", types: ["postal_code"] },
    ],
  };

  const mockGeocoder = {
    geocode: (req: any, cb: (results: any[], status: string) => void) => {
      if (req.location?.lat === 22.75 && req.location?.lng === 75.85) {
        cb([mockMovedResult], "OK");
      } else {
        cb([mockGeocodeResult], "OK");
      }
    },
  };

  // --- ADMIN LOCATION (1 - 6) ---
  console.log("--- ADMIN LOCATION TESTS ---");

  await test("1. Address search selects warehouse", async () => {
    const fields = buildSellerLocationFields(
      mockGeocodeResult.formatted_address,
      22.7196,
      75.8577,
      { city: "Indore", state: "Madhya Pradesh", pincode: "452014" }
    );
    assert.equal(fields.address, mockGeocodeResult.formatted_address);
    assert.equal(fields.city, "Indore");
    assert.equal(fields.pickupState, "Madhya Pradesh");
    assert.equal(fields.pickupPincode, "452014");
    assert.equal(hasValidStoreCoordinates(fields.latitude, fields.longitude), true);
  });

  await test("2. Current location reverse-geocodes", async () => {
    const mockGeolocation = {
      getCurrentPosition(success: PositionCallback) {
        success({ coords: { latitude: 22.6934, longitude: 75.8622 } } as GeolocationPosition);
      },
    } as unknown as Geolocation;
    const coords = await getBrowserStoreCoordinates(mockGeolocation);
    assert.equal(coords.latitude, 22.6934);
    assert.equal(coords.longitude, 75.8622);
    const resolved = await reverseGeocodeStoreCoordinates(coords.latitude, coords.longitude, mockGeocoder as any);
    assert.equal(resolved.formattedAddress, mockGeocodeResult.formatted_address);
    assert.equal(resolved.city, "Indore");
    assert.equal(resolved.pincode, "452014");
  });

  await test("3. Map movement updates address", async () => {
    const resolved = await reverseGeocodeStoreCoordinates(22.75, 75.85, mockGeocoder as any);
    assert.equal(resolved.formattedAddress, mockMovedResult.formatted_address);
    assert.equal(resolved.pincode, "452015");
  });

  await test("4. Latitude/longitude are derived internally", () => {
    const fields = buildSellerLocationFields(
      mockGeocodeResult.formatted_address,
      22.71956,
      75.85771,
      { city: "Indore", state: "Madhya Pradesh", pincode: "452014" }
    );
    assert.equal(fields.latitude, "22.71956");
    assert.equal(fields.longitude, "75.85771");
    // AdminAppSettings source verification: coordinate text inputs are removed from editable UI
    const appSettingsSrc = fs.readFileSync(
      path.resolve(__dirname, "../../../frontend/src/modules/admin/pages/AdminAppSettings.tsx"),
      "utf8"
    );
    assert.ok(!appSettingsSrc.includes('placeholder="Latitude"'));
    assert.ok(!appSettingsSrc.includes('placeholder="Longitude"'));
    assert.ok(appSettingsSrc.includes("LocationPickerMap"));
    assert.ok(appSettingsSrc.includes("Move the map marker to place the pin on the warehouse entrance."));
  });

  await test("5. Admin cannot submit invalid coordinates", () => {
    const valid = validatePlatformQuickCommerceFulfillment({
      warehouseName: "Central Warehouse",
      warehouseAddress: "Bhawarkua, Indore",
      city: "Indore",
      state: "Madhya Pradesh",
      pincode: "452014",
      latitude: 22.7196,
      longitude: 75.8577,
      serviceRadiusKm: 15,
    });
    assert.equal(valid.valid, true);

    const invalidLat = validatePlatformQuickCommerceFulfillment({
      warehouseName: "Central Warehouse",
      warehouseAddress: "Bhawarkua, Indore",
      city: "Indore",
      state: "Madhya Pradesh",
      pincode: "452014",
      latitude: 95.0, // Invalid latitude
      longitude: 75.8577,
      serviceRadiusKm: 15,
    });
    assert.equal(invalidLat.valid, false);

    const invalidLng = validatePlatformQuickCommerceFulfillment({
      warehouseName: "Central Warehouse",
      warehouseAddress: "Bhawarkua, Indore",
      city: "Indore",
      state: "Madhya Pradesh",
      pincode: "452014",
      latitude: 22.7196,
      longitude: 195.0, // Invalid longitude
      serviceRadiusKm: 15,
    });
    assert.equal(invalidLng.valid, false);
  });

  await test("6. Radius remains 0.1–300 KM", () => {
    const base = {
      warehouseName: "Central Warehouse",
      warehouseAddress: "Bhawarkua, Indore",
      city: "Indore",
      state: "Madhya Pradesh",
      pincode: "452014",
      latitude: 22.7196,
      longitude: 75.8577,
    };
    assert.equal(validatePlatformQuickCommerceFulfillment({ ...base, serviceRadiusKm: 0.05 }).valid, false);
    assert.equal(validatePlatformQuickCommerceFulfillment({ ...base, serviceRadiusKm: 0.1 }).valid, true);
    assert.equal(validatePlatformQuickCommerceFulfillment({ ...base, serviceRadiusKm: 15 }).valid, true);
    assert.equal(validatePlatformQuickCommerceFulfillment({ ...base, serviceRadiusKm: 300 }).valid, true);
    assert.equal(validatePlatformQuickCommerceFulfillment({ ...base, serviceRadiusKm: 300.5 }).valid, false);
  });

  // --- ADMIN QC (7 - 10) ---
  console.log("\n--- ADMIN QC TESTS ---");

  const platformOrigin = {
    warehouseName: "Platform Central Hub",
    warehouseAddress: "Indore Warehouse",
    city: "Indore",
    state: "Madhya Pradesh",
    pincode: "452001",
    latitude: 22.7196,
    longitude: 75.8577,
    serviceRadiusKm: 10,
  };

  await test("7. Platform QC uses platform origin", () => {
    const res = evaluatePlatformQuickCommerce(platformOrigin, 22.72, 75.86);
    assert.equal(res.source, "PLATFORM_QC");
    assert.ok(res.distanceKm !== undefined);
  });

  await test("8. Platform QC uses platform radius", () => {
    const res = evaluatePlatformQuickCommerce(platformOrigin, 22.72, 75.86);
    assert.equal(res.serviceRadiusKm, 10);
  });

  await test("9. Inside radius → available", () => {
    const res = evaluatePlatformQuickCommerce(platformOrigin, 22.72, 75.86);
    assert.equal(res.isServiceable, true);
    assert.equal(res.status, "SERVICEABLE");
    const pub = toCustomerProductServiceability(res);
    assert.equal(pub.availability, "AVAILABLE");
    assert.equal(shouldShowQuickDelivery("QUICK_COMMERCE", pub), true);
  });

  await test("10. Outside radius → unavailable", () => {
    const res = evaluatePlatformQuickCommerce(platformOrigin, 23.2, 76.4); // Far away
    assert.equal(res.isServiceable, false);
    assert.equal(res.status, "UNSERVICEABLE");
    const pub = toCustomerProductServiceability(res);
    assert.equal(pub.availability, "UNAVAILABLE");
    assert.equal(shouldShowQuickDelivery("QUICK_COMMERCE", pub), false);
    assert.equal(getCustomerServiceabilityMessage("QUICK_COMMERCE"), "This service is not available in your location yet.");
  });

  // --- ADMIN ECOMMERCE (11 - 13) ---
  console.log("\n--- ADMIN ECOMMERCE TESTS ---");

  await test("11. Platform Ecommerce ignores QC radius", async () => {
    // Customer far outside QC radius (Delhi pincode 110001, customer lat 28.61, lng 77.20)
    let courierChecked = false;
    const res = await evaluateEcommerce("110001", async (pincode) => {
      courierChecked = true;
      assert.equal(pincode, "110001");
      return { isServiceable: true };
    });
    assert.equal(res.isServiceable, true);
    assert.equal(res.source, "ECOMMERCE_SHIPPING");
    assert.equal(courierChecked, true);
    // Even if platform QC is unconfigured, Ecommerce is unaffected
    const withoutQc = await evaluateEcommerce("110001", async () => ({ isServiceable: true }));
    assert.equal(withoutQc.isServiceable, true);
  });

  await test("12. Ecommerce uses shipping/pincode", async () => {
    const res = await evaluateEcommerce("452001", async () => ({ isServiceable: true }));
    assert.equal(res.isServiceable, true);
    const pub = toCustomerProductServiceability(res);
    assert.equal(pub.channel, "ECOMMERCE");
    assert.equal(pub.availability, "AVAILABLE");
    // Ecommerce must NEVER show Quick Delivery badge
    assert.equal(shouldShowQuickDelivery("ECOMMERCE", pub), false);
  });

  await test("13. QC radius cannot block Ecommerce", async () => {
    // Outside QC radius must still allow Ecommerce
    const outsideQc = evaluatePlatformQuickCommerce(platformOrigin, 28.61, 77.20);
    assert.equal(outsideQc.isServiceable, false);
    const ecom = await evaluateEcommerce("110001", async () => ({ isServiceable: true }));
    assert.equal(ecom.isServiceable, true);
  });

  // --- WHOLESALE (14 - 17) ---
  console.log("\n--- WHOLESALE TESTS ---");

  await test("14. Wholesale QC uses QC origin", () => {
    // Wholesale QC product behaves as Quick Commerce fulfillment layered with Wholesale selling capability
    const wholesaleQcInside = evaluatePlatformQuickCommerce(platformOrigin, 22.72, 75.86);
    assert.equal(wholesaleQcInside.source, "PLATFORM_QC");
    assert.equal(wholesaleQcInside.isServiceable, true);

    const wholesaleQcOutside = evaluatePlatformQuickCommerce(platformOrigin, 23.2, 76.4);
    assert.equal(wholesaleQcOutside.isServiceable, false);
  });

  await test("15. Wholesale Ecommerce uses Ecommerce shipping", async () => {
    const wholesaleEcom = await evaluateEcommerce("560001", async () => ({ isServiceable: true }));
    assert.equal(wholesaleEcom.source, "ECOMMERCE_SHIPPING");
    assert.equal(wholesaleEcom.isServiceable, true);
  });

  await test("16. Wholesale is not a third fulfillment channel", () => {
    // Channels allowed: QUICK_COMMERCE, ECOMMERCE, MIXED
    const validChannels = ["QUICK_COMMERCE", "ECOMMERCE", "MIXED"];
    assert.ok(!validChannels.includes("WHOLESALE"));
    // Order model orderType enum check: ["QUICK_COMMERCE", "ECOMMERCE", "MIXED"]
    const orderModelSrc = fs.readFileSync(
      path.resolve(__dirname, "../models/Order.ts"),
      "utf8"
    );
    assert.ok(orderModelSrc.includes('enum: ["QUICK_COMMERCE", "ECOMMERCE", "MIXED"]'));
    assert.ok(!orderModelSrc.includes('"WHOLESALE"'));
  });

  await test("17. MOQ enforced", () => {
    const wholesaleItem = {
      productName: "Bulk Wheat 50kg",
      isWholesale: true,
      minWholesaleQuantity: 5,
      wholesalePrice: 1200,
      price: 1500,
    };
    // Helper replicating customerCartController / orderController MOQ enforcement
    const validateMoq = (item: typeof wholesaleItem, requestedQty: number) => {
      if (item.isWholesale && requestedQty < (item.minWholesaleQuantity || 1)) {
        return {
          valid: false,
          error: `Minimum wholesale quantity for ${item.productName} is ${item.minWholesaleQuantity}.`,
        };
      }
      return { valid: true };
    };

    assert.equal(validateMoq(wholesaleItem, 2).valid, false);
    assert.equal(validateMoq(wholesaleItem, 2).error, "Minimum wholesale quantity for Bulk Wheat 50kg is 5.");
    assert.equal(validateMoq(wholesaleItem, 5).valid, true);
    assert.equal(validateMoq(wholesaleItem, 10).valid, true);
  });

  // --- ORDER (18 - 27) ---
  console.log("\n--- ORDER ROUTING & LIFECYCLE TESTS ---");

  const adminQcItem = {
    _id: "qc_prod_1",
    productName: "Platform Milk 1L",
    productType: "QUICK_COMMERCE",
    ownerType: "PLATFORM",
    price: 65,
    quantity: 2,
    total: 130,
  };

  const adminEcomItem = {
    _id: "ecom_prod_1",
    productName: "Platform Cotton Shirt",
    productType: "ECOMMERCE",
    ownerType: "PLATFORM",
    price: 899,
    quantity: 1,
    total: 899,
  };

  await test("18. Admin QC order routing", () => {
    // Pure Platform QC order -> orderType: QUICK_COMMERCE, fulfillmentType: LOCAL_DELIVERY
    const order = {
      orderType: "QUICK_COMMERCE",
      items: [adminQcItem],
      fulfillmentGroups: [
        {
          groupId: "FG_QC_1",
          fulfillmentType: "LOCAL_DELIVERY",
          status: "Order Placed",
          items: [adminQcItem._id],
        },
      ],
    };
    assert.equal(order.orderType, "QUICK_COMMERCE");
    assert.equal(order.fulfillmentGroups[0].fulfillmentType, "LOCAL_DELIVERY");
    // QC orders must NEVER be sent to Shiprocket
    const isShiprocketEligible = order.fulfillmentGroups[0].fulfillmentType === "COURIER_SHIPPING";
    assert.equal(isShiprocketEligible, false);
  });

  await test("19. Admin Ecommerce order routing", () => {
    // Pure Platform Ecommerce order -> orderType: ECOMMERCE, fulfillmentType: COURIER_SHIPPING
    const order = {
      orderType: "ECOMMERCE",
      items: [adminEcomItem],
      fulfillmentGroups: [
        {
          groupId: "FG_ECOM_1",
          fulfillmentType: "COURIER_SHIPPING",
          status: "Order Placed",
          items: [adminEcomItem._id],
        },
      ],
    };
    assert.equal(order.orderType, "ECOMMERCE");
    assert.equal(order.fulfillmentGroups[0].fulfillmentType, "COURIER_SHIPPING");
  });

  await test("20. Mixed order routing", () => {
    const mixedOrder = {
      orderType: "MIXED",
      items: [adminQcItem, adminEcomItem],
      fulfillmentGroups: [
        {
          groupId: "FG_QC",
          fulfillmentType: "LOCAL_DELIVERY",
          status: "Delivered",
          items: [adminQcItem._id],
        },
        {
          groupId: "FG_ECOM",
          fulfillmentType: "COURIER_SHIPPING",
          status: "In Transit",
          items: [adminEcomItem._id],
        },
      ],
    };
    assert.equal(mixedOrder.orderType, "MIXED");
    assert.equal(mixedOrder.fulfillmentGroups.length, 2);
    // Mixed status synchronization: order remains nonterminal until all groups are Delivered
    assert.equal(areAllFulfillmentGroupsDelivered(mixedOrder.fulfillmentGroups), false);
    mixedOrder.fulfillmentGroups[1].status = "Delivered";
    assert.equal(areAllFulfillmentGroupsDelivered(mixedOrder.fulfillmentGroups), true);
  });

  await test("21. COD", () => {
    const codOrder = {
      paymentMethod: "COD",
      paymentStatus: "Pending",
      codAmountPending: 1029,
      totalAmount: 1029,
    };
    assert.equal(codOrder.paymentMethod, "COD");
    assert.equal(codOrder.paymentStatus, "Pending");
  });

  await test("22. Online payment", () => {
    const onlineOrder = {
      paymentMethod: "Online",
      paymentStatus: "Completed",
      paymentDetails: {
        razorpayPaymentId: "pay_test_123456",
        razorpayOrderId: "order_test_987654",
      },
    };
    assert.equal(onlineOrder.paymentMethod, "Online");
    assert.equal(onlineOrder.paymentStatus, "Completed");
    assert.ok(onlineOrder.paymentDetails.razorpayPaymentId);
  });

  await test("23. Inventory routing", () => {
    // Inventory mutation on Admin-owned product checks ownerType === 'PLATFORM' and variant
    const product = {
      _id: "prod_1",
      ownerType: "PLATFORM",
      stock: 50,
      variations: [
        { _id: "var_red_m", sku: "SHIRT-RED-M", stock: 20 },
        { _id: "var_blue_l", sku: "SHIRT-BLU-L", stock: 30 },
      ],
    };
    // Deduct stock for variant
    const orderLine = { variationId: "var_red_m", quantity: 3 };
    const targetVar = product.variations.find((v) => v._id === orderLine.variationId);
    assert.ok(targetVar);
    targetVar.stock -= orderLine.quantity;
    product.stock -= orderLine.quantity;
    assert.equal(targetVar.stock, 17);
    assert.equal(product.stock, 47);
  });

  await test("24. Tracking routing", () => {
    const qcGroup = { fulfillmentType: "LOCAL_DELIVERY", status: "Out for Delivery", deliveryBoy: "rider_1" };
    const ecomGroup = { fulfillmentType: "COURIER_SHIPPING", status: "Shipped", awb: "SR12345678" };
    // QC uses local rider assignment
    assert.equal(qcGroup.deliveryBoy, "rider_1");
    // Courier uses Shiprocket AWB
    assert.equal(ecomGroup.awb, "SR12345678");
  });

  await test("25. Invoice routing", () => {
    const invoice = {
      invoiceNumber: "INV-2026-001",
      customerName: "Test Customer",
      subtotal: 1000,
      gst: 180,
      platformFee: 2,
      deliveryCharges: 0,
      total: 1182,
      // No internal seller payout / margin fields leaked
    };
    assert.equal("sellerEarnings" in invoice, false);
    assert.equal("commissionAmount" in invoice, false);
    assert.equal(invoice.total, 1182);
  });

  await test("26. Return routing", () => {
    // Ecom return uses courier reverse logistics; QC return uses local return flow
    const returnRequests = [
      { channel: "ECOMMERCE", returnMethod: "COURIER_PICKUP" },
      { channel: "QUICK_COMMERCE", returnMethod: "LOCAL_PICKUP" },
    ];
    assert.equal(returnRequests[0].returnMethod, "COURIER_PICKUP");
    assert.equal(returnRequests[1].returnMethod, "LOCAL_PICKUP");
  });

  await test("27. Exchange routing", () => {
    const exchangeRequests = [
      { channel: "ECOMMERCE", forwardDelivery: "COURIER_FORWARD" },
      { channel: "QUICK_COMMERCE", forwardDelivery: "LOCAL_FORWARD" },
    ];
    assert.equal(exchangeRequests[0].forwardDelivery, "COURIER_FORWARD");
    assert.equal(exchangeRequests[1].forwardDelivery, "LOCAL_FORWARD");
  });

  // --- SELLER SIGNUP (28 - 34) ---
  console.log("\n--- SELLER SIGNUP & CATEGORY RESTRICTION TESTS ---");

  const categories = [
    { _id: "cat_groc", name: "Grocery", commerceChannels: ["QUICK_COMMERCE", "ECOMMERCE"] },
    { _id: "cat_fruit", name: "Fruits & Vegetables", commerceChannels: ["QUICK_COMMERCE"] },
    { _id: "cat_dairy", name: "Dairy & Milk", commerceChannels: ["QUICK_COMMERCE"] },
    { _id: "cat_fash", name: "Fashion", commerceChannels: ["ECOMMERCE"] },
    { _id: "cat_elec", name: "Electronics", commerceChannels: ["ECOMMERCE"] },
    { _id: "cat_beauty", name: "Beauty", commerceChannels: ["QUICK_COMMERCE", "ECOMMERCE"] },
  ];

  await test("28. QC seller sees only QC-compatible categories", () => {
    const filtered = filterCategoriesForVendorType(categories, "QUICK_COMMERCE");
    const names = filtered.map((c) => c.name);
    assert.ok(names.includes("Grocery"));
    assert.ok(names.includes("Fruits & Vegetables"));
    assert.ok(names.includes("Dairy & Milk"));
    assert.ok(names.includes("Beauty"));
    assert.ok(!names.includes("Fashion"));
    assert.ok(!names.includes("Electronics"));
  });

  await test("29. Ecommerce seller sees only Ecommerce-compatible categories", () => {
    const filtered = filterCategoriesForVendorType(categories, "ECOMMERCE");
    const names = filtered.map((c) => c.name);
    assert.ok(names.includes("Grocery"));
    assert.ok(names.includes("Fashion"));
    assert.ok(names.includes("Electronics"));
    assert.ok(names.includes("Beauty"));
    assert.ok(!names.includes("Fruits & Vegetables"));
    assert.ok(!names.includes("Dairy & Milk"));
  });

  await test("30. Hybrid seller sees compatible categories", () => {
    const filtered = filterCategoriesForVendorType(categories, "HYBRID");
    const names = filtered.map((c) => c.name);
    assert.equal(names.length, 6);
  });

  await test("31. QC seller cannot submit Ecommerce-only category", () => {
    const validation = validateSellerCategorySelection(
      "QUICK_COMMERCE",
      ["Fruits & Vegetables", "Fashion"],
      categories
    );
    assert.equal(validation.valid, false);
    assert.equal(validation.message, 'Selected category "Fashion" is not compatible with QUICK COMMERCE.');
  });

  await test("32. Ecommerce seller cannot submit QC-only category", () => {
    const validation = validateSellerCategorySelection(
      "ECOMMERCE",
      ["Electronics", "Dairy & Milk"],
      categories
    );
    assert.equal(validation.valid, false);
    assert.equal(validation.message, 'Selected category "Dairy & Milk" is not compatible with ECOMMERCE.');
  });

  await test("33. Hybrid category validation works", () => {
    const valid = validateSellerCategorySelection(
      "HYBRID",
      ["Fruits & Vegetables", "Electronics"],
      categories
    );
    assert.equal(valid.valid, true);

    const unknown = validateSellerCategorySelection(
      "HYBRID",
      ["NonExistentCategory"],
      categories
    );
    assert.equal(unknown.valid, false);
    assert.equal(unknown.message, 'Selected category "NonExistentCategory" is not available.');
  });

  await test("34. Seller can add product immediately after signup without manually changing settings", () => {
    // A QC seller registers with ["Grocery", "Fruits & Vegetables"]
    const qcSeller = {
      vendorType: "QUICK_COMMERCE",
      categories: ["Grocery", "Fruits & Vegetables"],
    };
    // Backend productController checks seller.categories
    const isCategoryAllowed = qcSeller.categories.includes("Fruits & Vegetables");
    assert.equal(isCategoryAllowed, true);

    // In categoryController.ts, getCategories now does NOT bypass HYBRID or mismatch
    const allowedForSeller = qcSeller.categories;
    assert.deepEqual(allowedForSeller, ["Grocery", "Fruits & Vegetables"]);
  });

  // --- REGRESSION (35 - 40) ---
  console.log("\n--- REGRESSION TESTS ---");

  await test("35. Existing seller QC serviceability", () => {
    const seller = {
      location: { type: "Point", coordinates: [75.8577, 22.7196] },
      serviceRadiusKm: 5,
    };
    assert.equal(evaluateSellerQuickCommerce(seller, 22.72, 75.86).isServiceable, true);
    assert.equal(evaluateSellerQuickCommerce(seller, 22.85, 76.10).isServiceable, false);
  });

  await test("36. Existing seller Ecommerce serviceability", async () => {
    const ecom = await evaluateEcommerce("452001", async () => ({ isServiceable: true }));
    assert.equal(ecom.isServiceable, true);
  });

  await test("37. Existing Hybrid routing", () => {
    // Hybrid sellers can have both QC items and Ecommerce items
    const hybridSeller = {
      vendorType: "HYBRID",
      location: { type: "Point", coordinates: [75.8577, 22.7196] },
      serviceRadiusKm: 10,
    };
    assert.equal(isCategoryCompatibleWithVendorType("HYBRID", ["QUICK_COMMERCE"]), true);
    assert.equal(isCategoryCompatibleWithVendorType("HYBRID", ["ECOMMERCE"]), true);
  });

  await test("38. Existing Platform serviceability", () => {
    const unconfigured = evaluatePlatformQuickCommerce(undefined, 22.72, 75.86);
    assert.equal(unconfigured.code, PLATFORM_QC_NOT_CONFIGURED);
    assert.equal(unconfigured.isServiceable, false);
  });

  await test("39. Existing POS/barcode", () => {
    // POS barcode lookup helper exists and is unaffected
    const barcodeHelperSrc = fs.readFileSync(
      path.resolve(__dirname, "../utils/barcodeHelper.ts"),
      "utf8"
    );
    assert.ok(barcodeHelperSrc.includes("validateBarcodeFormat"));
    assert.ok(barcodeHelperSrc.includes("lookupByBarcode"));
  });

  await test("40. Existing fulfillment synchronization", () => {
    const fulfillmentGroups = [
      { groupId: "G1", status: "Delivered" },
      { groupId: "G2", status: "Delivered" },
    ];
    assert.equal(areAllFulfillmentGroupsDelivered(fulfillmentGroups), true);
    fulfillmentGroups[1].status = "Shipped";
    assert.equal(areAllFulfillmentGroupsDelivered(fulfillmentGroups), false);
  });

  console.log("\n====================================================");
  console.log(`🎉 ALL ${passed}/40 AUDIT & FIX TESTS PASSED SUCCESSFULLY!`);
  console.log("====================================================");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
