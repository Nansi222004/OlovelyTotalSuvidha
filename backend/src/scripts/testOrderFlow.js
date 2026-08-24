// Test script: Place an order and verify the deliveryAddress snapshot
require('dotenv').config();
const http = require('http');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTdlMDVkZGQ5MzQxMTI1YzhhOGRlYTkiLCJ1c2VyVHlwZSI6IkN1c3RvbWVyIiwicGhvbmUiOiI4ODE3NDY5NTg4IiwiaWF0IjoxNzg3NTU4MjM4LCJleHAiOjE3ODgxNjMwMzh9.q6qQv55Odj7Zi35f-RchCJmxPFCJBDhHQBlNgcGTxT4';

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1' + path,
      method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function run() {
  console.log('=== PHASE 3: Check Customer Location ===');
  const loc = await apiCall('GET', '/customer/location', null);
  console.log('GET /customer/location ->', loc.status);
  console.log('address:', loc.body.data?.address);
  console.log('city:', loc.body.data?.city);
  console.log('lat:', loc.body.data?.latitude, 'lng:', loc.body.data?.longitude);
  console.log();

  console.log('=== PHASE 4: Check Addresses ===');
  const addrs = await apiCall('GET', '/customer/addresses', null);
  console.log('GET /customer/addresses ->', addrs.status);
  addrs.body.data.forEach(a => {
    console.log('Address:', a.address.substring(0, 80));
    console.log('  City:', a.city, '| State:', a.state, '| Pincode:', a.pincode);
    console.log('  Lat:', a.latitude, '| Lng:', a.longitude);
  });
  console.log();

  console.log('=== PHASE 4: Check Cart ===');
  const cart = await apiCall('GET', '/customer/cart', null);
  console.log('GET /customer/cart ->', cart.status);
  if (cart.body.data?.items?.length) {
    console.log('Cart has', cart.body.data.items.length, 'items');
    const firstItem = cart.body.data.items[0];
    console.log('First item product ID:', firstItem.product?._id || firstItem.product?.id);
  } else {
    console.log('Cart is empty - need to add items for order test');
  }
  console.log();

  // Place a test order with the named address
  if (cart.body.data?.items?.length) {
    console.log('=== PHASE 5: Place Test Order ===');
    const orderPayload = {
      items: cart.body.data.items.map(i => ({
        product: { id: i.product?._id || i.product?.id },
        quantity: i.quantity,
      })),
      address: {
        address: 'Corporate House, 208, 169, RNT Marg, near CENTRAL, RNT Marg, Indore, Madhya Pradesh 452001',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '452001',
        landmark: '',
        latitude: 22.7173716,
        longitude: 75.8716678,
      },
      paymentMethod: 'COD',
      fees: { deliveryFee: 0, platformFee: 0 },
    };

    const order = await apiCall('POST', '/customer/orders', orderPayload);
    console.log('POST /customer/orders ->', order.status);
    if (order.status === 201 || order.status === 200) {
      const orderId = order.body.data?._id || order.body.data?.id;
      console.log('Order ID:', orderId);
      console.log('deliveryAddress.address:', order.body.data?.deliveryAddress?.address);
      console.log('deliveryAddress.city:', order.body.data?.deliveryAddress?.city);
      console.log('deliveryAddress.lat:', order.body.data?.deliveryAddress?.latitude);
      console.log('deliveryAddress.lng:', order.body.data?.deliveryAddress?.longitude);
      
      // PHASE 6: Immutability test - change location and verify order still shows old address
      console.log();
      console.log('=== PHASE 6: Immutability Test ===');
      await apiCall('POST', '/customer/location', {
        latitude: 22.7200000,
        longitude: 75.8800000,
        address: 'Location B - New MR-10 Flyover, Indore',
        city: 'Indore', state: 'Madhya Pradesh', pincode: '452011'
      });
      console.log('Location changed to Location B');
      
      // Fetch the original order
      const orderCheck = await apiCall('GET', '/customer/orders/' + orderId, null);
      console.log('GET /customer/orders/' + orderId + ' ->', orderCheck.status);
      console.log('Order.deliveryAddress.address (should be Location A):', orderCheck.body.data?.deliveryAddress?.address);
      
      if (orderCheck.body.data?.deliveryAddress?.address?.includes('Corporate House')) {
        console.log('✅ PASS: Order A still shows Location A (Corporate House) after changing to Location B');
      } else {
        console.log('❌ FAIL: Order A address was changed! Got:', orderCheck.body.data?.deliveryAddress?.address);
      }
      
      return orderId;
    } else {
      console.log('Order failed:', JSON.stringify(order.body, null, 2));
    }
  } else {
    console.log('Skipping order test - cart is empty');
  }
}

run().catch(e => { console.error('Script error:', e); process.exit(1); });
