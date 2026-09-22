import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import Product from '../models/Product';
import Customer from '../models/Customer';
import Order from '../models/Order';
import Cart from '../models/Cart';
import CartItem from '../models/CartItem';
import AppSettings from '../models/AppSettings';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api/v1/customer';
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

async function runTests() {
  console.log('🚀 Starting Checkout Delivery Enforcement & Simplification Tests...');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/olovely_total_suvidha';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  // Find customer
  let customer = await Customer.findOne();
  if (!customer) {
    throw new Error('No customer found in DB to run test');
  }

  const token = jwt.sign(
    { userId: customer._id.toString(), userType: 'Customer', phone: customer.phone },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Find active in-stock QC Product without variations (simple product)
  const allProducts = await Product.find({
    status: 'Active',
    publish: true,
  });

  // Prefer simple products without variations to avoid on-the-fly subdocument ID generation
  const qcProduct = allProducts.find(p => p.productType !== 'ECOMMERCE' && (!p.variations || p.variations.length === 0) && p.stock > 5)
    || allProducts.find(p => p.productType !== 'ECOMMERCE' && p.stock > 5);

  const ecomProduct = allProducts.find(p => p.productType === 'ECOMMERCE' && (!p.variations || p.variations.length === 0) && p.stock > 5)
    || allProducts.find(p => p.productType === 'ECOMMERCE' && p.stock > 5);

  if (!qcProduct) {
    throw new Error('Could not find an active Quick Commerce product with stock');
  }
  if (!ecomProduct) {
    throw new Error('Could not find an active Ecommerce product with stock');
  }

  // If variation has title/value/name, use that string
  const qcVariant = (qcProduct.variations && qcProduct.variations.length > 0)
    ? (qcProduct.variations[0].title || qcProduct.variations[0].value || qcProduct.variations[0].name || (qcProduct.variations[0] as any).pack)
    : undefined;
  const ecomVariant = (ecomProduct.variations && ecomProduct.variations.length > 0)
    ? (ecomProduct.variations[0].title || ecomProduct.variations[0].value || ecomProduct.variations[0].name || (ecomProduct.variations[0] as any).pack)
    : undefined;

  console.log(`📦 Found QC Product: "${qcProduct.productName}" (ID: ${qcProduct._id})`);
  console.log('QC Variations:', qcProduct.variations?.map((v: any) => ({ id: v._id?.toString(), title: v.title, stock: v.stock })));
  console.log(`📦 Found Ecommerce Product: "${ecomProduct.productName}" (ID: ${ecomProduct._id})`);
  console.log('Ecom Variations:', ecomProduct.variations?.map((v: any) => ({ id: v._id?.toString(), title: v.title, stock: v.stock })));

  // Clear customer cart before test
  const existingCart = await Cart.findOne({ customer: customer._id });
  if (existingCart) {
    await CartItem.deleteMany({ cart: existingCart._id });
    existingCart.items = [];
    existingCart.total = 0;
    await existingCart.save();
  }

  const createdOrderIds: mongoose.Types.ObjectId[] = [];

  try {
    // ── TEST 1: QC CART RESPONSE HAS INSTANT DELIVERY ─────────────────────────
    console.log('\n--- TEST 1: QC Cart Delivery Information ---');
    await axios.post(
      `${API_BASE}/cart/add?latitude=22.7196&longitude=75.8577`,
      { productId: qcProduct._id.toString(), variation: qcVariant, quantity: 1, latitude: 22.7196, longitude: 75.8577 },
      { headers: authHeaders }
    );

    const cartResQc = await axios.get(`${API_BASE}/cart?latitude=22.7196&longitude=75.8577`, { headers: authHeaders });
    const qcGroup = cartResQc.data.data.groups.quickCommerce;
    console.log(`QC Group Title: "${qcGroup.title}"`);
    console.log(`QC Estimated Delivery Time: "${qcGroup.estimatedDeliveryTime}"`);
    console.log(`QC Selected Delivery Option: "${qcGroup.selectedDeliveryOption}"`);
    console.log(`QC Allowed Options:`, qcGroup.allowedDeliveryOptions);

    if (qcGroup.selectedDeliveryOption !== 'Instant') {
      throw new Error(`Expected QC selectedDeliveryOption to be 'Instant', got '${qcGroup.selectedDeliveryOption}'`);
    }
    if (qcGroup.allowedDeliveryOptions.some((o: any) => o.id === 'Standard')) {
      throw new Error(`QC allowedDeliveryOptions still contains 'Standard'! Should only contain Instant.`);
    }
    console.log('✅ TEST 1 PASSED: Quick Commerce cart authoritatively uses Instant Delivery');

    // ── TEST 2: ORDER NORMALIZATION (LEGACY 'Standard' OVERRIDDEN TO 'Instant') ─
    console.log('\n--- TEST 2: Authoritative QC Order Normalization (Tamper/Legacy Resistance) ---');
    const qcAddress = {
      name: customer.name || 'Test User',
      phone: customer.phone || '9999999999',
      addressLine1: 'Test Address Line',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001',
      latitude: 22.7196,
      longitude: 75.8577,
    };

    // Client maliciously/legacy submits 'Standard' deliveryOption
    const orderResTampered = await axios.post(
      `${API_BASE}/orders`,
      {
        items: [{
          product: { id: qcProduct._id.toString() },
          variant: qcVariant,
          quantity: 1,
        }],
        address: qcAddress,
        paymentMethod: 'COD',
        deliveryOption: 'Standard', // Attempting legacy/tampered option
        deliverySelections: { quickCommerce: 'Standard' },
      },
      { headers: authHeaders }
    );

    const orderId1 = orderResTampered.data.data._id || orderResTampered.data.data.id;
    createdOrderIds.push(new mongoose.Types.ObjectId(orderId1));

    const dbOrder1 = await Order.findById(orderId1);
    if (!dbOrder1) throw new Error('Order not found in DB');

    console.log(`Requested deliveryOption in payload: "Standard"`);
    console.log(`Saved DB Order deliveryOption: "${dbOrder1.deliveryOption}"`);
    console.log(`Saved DB Order fulfillmentType: "${(dbOrder1 as any).fulfillmentType}"`);

    if (dbOrder1.deliveryOption !== 'Instant') {
      throw new Error(`Expected DB order deliveryOption to be authoritatively 'Instant', got '${dbOrder1.deliveryOption}'`);
    }
    console.log('✅ TEST 2 PASSED: Legacy/client-submitted "Standard" normalized to "Instant" authoritatively');

    // ── TEST 3: MALICIOUS CROSS-CHANNEL REJECTION (Courier on QC) ──────────────
    console.log('\n--- TEST 3: Reject Malicious Cross-Channel Delivery (Courier on QC) ---');
    let rejectedQcCourier = false;
    try {
      await axios.post(
        `${API_BASE}/orders`,
        {
          items: [{
            product: { id: qcProduct._id.toString() },
            variant: qcVariant,
            quantity: 1,
          }],
          address: qcAddress,
          paymentMethod: 'COD',
          deliveryOption: 'Courier', // Invalid for QC
          deliverySelections: { quickCommerce: 'Courier' },
        },
        { headers: authHeaders }
      );
    } catch (err: any) {
      if (err.response?.status === 400) {
        rejectedQcCourier = true;
        console.log(`Correctly rejected with 400: "${err.response.data.message}"`);
      }
    }
    if (!rejectedQcCourier) {
      throw new Error('Expected 400 rejection for Courier delivery on Quick Commerce items');
    }
    console.log('✅ TEST 3 PASSED: Cross-channel malicious override (Courier on QC) rejected with HTTP 400');

    // ── TEST 4: ECOMMERCE CART & ORDER COURIER ENFORCEMENT ─────────────────────
    console.log('\n--- TEST 4: Ecommerce Delivery Enforcement ---');
    // Clear cart and add Ecommerce item
    await CartItem.deleteMany({ cart: existingCart!._id });
    await axios.post(
      `${API_BASE}/cart/add?latitude=22.7196&longitude=75.8577`,
      { productId: ecomProduct._id.toString(), variation: ecomVariant, quantity: 1, latitude: 22.7196, longitude: 75.8577 },
      { headers: authHeaders }
    );

    const cartResEcom = await axios.get(`${API_BASE}/cart?latitude=22.7196&longitude=75.8577`, { headers: authHeaders });
    const ecomGroup = cartResEcom.data.data.groups.ecommerce;
    console.log(`Ecommerce Group Title: "${ecomGroup.title}"`);
    console.log(`Ecommerce Selected Delivery Option: "${ecomGroup.selectedDeliveryOption}"`);
    if (ecomGroup.selectedDeliveryOption !== 'Courier') {
      throw new Error(`Expected Ecommerce selectedDeliveryOption to be 'Courier', got '${ecomGroup.selectedDeliveryOption}'`);
    }

    // Malicious attempt: Instant delivery on Ecommerce item
    let rejectedEcomInstant = false;
    try {
      await axios.post(
        `${API_BASE}/orders`,
        {
          items: [{
            product: { id: ecomProduct._id.toString() },
            variant: ecomVariant,
            quantity: 1,
          }],
          address: qcAddress,
          paymentMethod: 'COD',
          deliveryOption: 'Instant', // Invalid for Ecommerce
          deliverySelections: { ecommerce: 'Instant' },
        },
        { headers: authHeaders }
      );
    } catch (err: any) {
      if (err.response?.status === 400) {
        rejectedEcomInstant = true;
        console.log(`Correctly rejected with 400: "${err.response.data.message}"`);
      }
    }
    if (!rejectedEcomInstant) {
      throw new Error('Expected 400 rejection for Instant delivery on Ecommerce items');
    }

    // Valid Ecommerce order placement
    const orderResEcom = await axios.post(
      `${API_BASE}/orders`,
      {
        items: [{
          product: { id: ecomProduct._id.toString() },
          variant: ecomVariant,
          quantity: 1,
        }],
        address: qcAddress,
        paymentMethod: 'COD',
        deliveryOption: 'Courier',
        deliverySelections: { ecommerce: 'Courier' },
      },
      { headers: authHeaders }
    );

    const orderId2 = orderResEcom.data.data._id || orderResEcom.data.data.id;
    createdOrderIds.push(new mongoose.Types.ObjectId(orderId2));

    const dbOrder2 = await Order.findById(orderId2);
    if (!dbOrder2) throw new Error('Ecommerce order not found in DB');
    console.log(`Ecommerce order deliveryOption in DB: "${dbOrder2.deliveryOption}"`);
    if (dbOrder2.deliveryOption !== 'Courier') {
      throw new Error(`Expected Ecommerce order deliveryOption to be 'Courier', got '${dbOrder2.deliveryOption}'`);
    }
    console.log('✅ TEST 4 PASSED: Ecommerce cart and order authoritatively use Courier Delivery');

    // ── TEST 5: MIXED CART & MULTI-SHIPMENT SPLITTING ─────────────────────────
    console.log('\n--- TEST 5: Mixed Cart Independent Delivery & Splitting ---');
    // Add QC item so cart has both QC and Ecommerce
    await axios.post(
      `${API_BASE}/cart/add?latitude=22.7196&longitude=75.8577`,
      { productId: qcProduct._id.toString(), variation: qcVariant, quantity: 1, latitude: 22.7196, longitude: 75.8577 },
      { headers: authHeaders }
    );

    const cartResMixed = await axios.get(`${API_BASE}/cart?latitude=22.7196&longitude=75.8577`, { headers: authHeaders });
    const mixedGroups = cartResMixed.data.data.groups;
    console.log(`Mixed Cart QC Group: items=${mixedGroups.quickCommerce.items.length}, option=${mixedGroups.quickCommerce.selectedDeliveryOption}`);
    console.log(`Mixed Cart Ecom Group: items=${mixedGroups.ecommerce.items.length}, option=${mixedGroups.ecommerce.selectedDeliveryOption}`);

    if (mixedGroups.quickCommerce.selectedDeliveryOption !== 'Instant' || mixedGroups.ecommerce.selectedDeliveryOption !== 'Courier') {
      throw new Error('Mixed cart groups do not have independent Instant and Courier options');
    }

    // Place mixed order
    const orderResMixed = await axios.post(
      `${API_BASE}/orders`,
      {
        items: [
          { product: { id: qcProduct._id.toString() }, variant: qcVariant, quantity: 1 },
          { product: { id: ecomProduct._id.toString() }, variant: ecomVariant, quantity: 1 },
        ],
        address: qcAddress,
        paymentMethod: 'COD',
        deliveryOption: 'Instant',
        deliverySelections: {
          quickCommerce: 'Instant',
          ecommerce: 'Courier',
        },
      },
      { headers: authHeaders }
    );

    const parentOrderId = orderResMixed.data.data._id || orderResMixed.data.data.id;
    createdOrderIds.push(new mongoose.Types.ObjectId(parentOrderId));

    const parentOrder = await Order.findById(parentOrderId);
    if (!parentOrder) throw new Error('Parent order not found');

    console.log(`Parent Order: orderType="${(parentOrder as any).orderType}"`);
    console.log(`Fulfillment Groups count: ${parentOrder.fulfillmentGroups?.length || 0}`);
    for (const fg of (parentOrder.fulfillmentGroups || []) as any[]) {
      console.log(`  Group: groupId="${fg.groupId}", fulfillmentType="${fg.fulfillmentType}", deliveryOption="${fg.deliveryOption}"`);
    }

    const mixedQcGroup = (parentOrder.fulfillmentGroups as any[])?.find((g: any) => g.fulfillmentType === 'LOCAL_DELIVERY');
    const mixedEcomGroup = (parentOrder.fulfillmentGroups as any[])?.find((g: any) => g.fulfillmentType === 'COURIER_SHIPPING');

    if (!mixedQcGroup || mixedQcGroup.deliveryOption !== 'Instant') {
      throw new Error(`Expected QC group to have deliveryOption='Instant', got '${mixedQcGroup?.deliveryOption}'`);
    }
    if (!mixedEcomGroup || mixedEcomGroup.deliveryOption !== 'Courier') {
      throw new Error(`Expected Ecommerce group to have deliveryOption='Courier', got '${mixedEcomGroup?.deliveryOption}'`);
    }
    console.log('✅ TEST 5 PASSED: Mixed cart correctly creates independent Instant (QC) and Courier (Ecommerce) fulfillment groups');

    console.log('\n🎉 ALL 5 INTEGRATION SUITES PASSED SUCCESSFULLY!');
  } finally {
    // Clean up created orders
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
      console.log(`🧹 Cleaned up ${createdOrderIds.length} test order(s)`);
    }
    // Clean up cart items
    if (existingCart) {
      await CartItem.deleteMany({ cart: existingCart._id });
      existingCart.items = [];
      existingCart.total = 0;
      await existingCart.save();
      console.log(`🧹 Restored clean customer cart`);
    }
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err.message);
  if (err.response?.data) {
    console.error('Response data:', err.response.data);
  }
  process.exit(1);
});
