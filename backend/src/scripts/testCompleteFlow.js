// Complete end-to-end order flow test
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTdlMDVkZGQ5MzQxMTI1YzhhOGRlYTkiLCJ1c2VyVHlwZSI6IkN1c3RvbWVyIiwicGhvbmUiOiI4ODE3NDY5NTg4IiwiaWF0IjoxNzg3NTU4MjM4LCJleHAiOjE3ODgxNjMwMzh9.q6qQv55Odj7Zi35f-RchCJmxPFCJBDhHQBlNgcGTxT4';

const LOCATION_A = {
  address: 'Corporate House, 208, 169, RNT Marg, near CENTRAL, RNT Marg, Indore, Madhya Pradesh 452001',
  city: 'Indore',
  state: 'Madhya Pradesh',
  pincode: '452001',
  latitude: 22.7173716,
  longitude: 75.8716678,
};

const LOCATION_B = {
  address: 'MR-10 Flyover, New Palasia, Indore, Madhya Pradesh 452001',
  city: 'Indore',
  state: 'Madhya Pradesh',
  pincode: '452001',
  latitude: 22.7300000,
  longitude: 75.8900000,
};

const PRODUCT_ID = '6a86ccd4e047d0122793a972';

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
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch(e) {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function pass(msg) { console.log('✅ PASS:', msg); }
function fail(msg) { console.log('❌ FAIL:', msg); }

async function run() {
  const results = [];

  console.log('\n========== PHASE 3: CUSTOMER LOCATION ==========');
  const profile = await apiCall('GET', '/customer/profile', null);
  console.log('GET /customer/profile ->', profile.status);
  const custAddress = profile.body.data?.address;
  const custLat = profile.body.data?.latitude;
  const custLng = profile.body.data?.longitude;
  console.log('Customer.address:', custAddress);
  console.log('Customer.lat:', custLat, 'lng:', custLng);
  
  if (custAddress === LOCATION_A.address) {
    pass('Customer.address matches Location A named address');
    results.push({ test: 'Customer location address', status: 'PASS' });
  } else {
    fail('Customer.address mismatch. Got: ' + custAddress);
    results.push({ test: 'Customer location address', status: 'FAIL', got: custAddress });
  }

  console.log('\n========== PHASE 4: ADDRESS MODEL ==========');
  const addrs = await apiCall('GET', '/customer/addresses', null);
  console.log('GET /customer/addresses ->', addrs.status);
  const defaultAddr = addrs.body.data?.[0];
  console.log('Default Address.address:', defaultAddr?.address);
  
  if (defaultAddr?.address?.includes('Corporate House')) {
    pass('Address model contains named address, no "Current Location," prefix');
    results.push({ test: 'Address model address', status: 'PASS' });
  } else {
    fail('Address model still has wrong address: ' + defaultAddr?.address);
    results.push({ test: 'Address model address', status: 'FAIL', got: defaultAddr?.address });
  }

  console.log('\n========== PHASE 5: PLACE ORDER ==========');
  // First add item to cart
  console.log('Adding product to cart...');
  const cartAdd = await apiCall('POST', '/customer/cart', {
    productId: PRODUCT_ID,
    quantity: 1,
    latitude: LOCATION_A.latitude,
    longitude: LOCATION_A.longitude,
  });
  console.log('POST /customer/cart ->', cartAdd.status);
  if (cartAdd.status !== 200 && cartAdd.status !== 201) {
    console.log('Cart add failed:', JSON.stringify(cartAdd.body).substring(0, 200));
  }

  // Verify cart
  const cartCheck = await apiCall('GET', '/customer/cart', null);
  console.log('GET /customer/cart ->', cartCheck.status, 'items:', cartCheck.body.data?.items?.length || 0);

  // Place order with Location A
  const orderPayload = {
    items: [{
      product: { id: PRODUCT_ID },
      quantity: 1,
    }],
    address: {
      address: LOCATION_A.address,
      city: LOCATION_A.city,
      state: LOCATION_A.state,
      pincode: LOCATION_A.pincode,
      landmark: '',
      latitude: LOCATION_A.latitude,
      longitude: LOCATION_A.longitude,
    },
    paymentMethod: 'COD',
    fees: { deliveryFee: 0, platformFee: 0 },
  };

  console.log('\nPOST /customer/orders with payload address:', orderPayload.address.address);
  const orderRes = await apiCall('POST', '/customer/orders', orderPayload);
  console.log('POST /customer/orders ->', orderRes.status);

  let orderId = null;
  if (orderRes.status === 201 || orderRes.status === 200) {
    orderId = orderRes.body.data?._id || orderRes.body.data?.id;
    const savedDeliveryAddress = orderRes.body.data?.deliveryAddress;
    console.log('\nOrder created! ID:', orderId);
    console.log('deliveryAddress.address:', savedDeliveryAddress?.address);
    console.log('deliveryAddress.city:', savedDeliveryAddress?.city);
    console.log('deliveryAddress.state:', savedDeliveryAddress?.state);
    console.log('deliveryAddress.pincode:', savedDeliveryAddress?.pincode);
    console.log('deliveryAddress.latitude:', savedDeliveryAddress?.latitude);
    console.log('deliveryAddress.longitude:', savedDeliveryAddress?.longitude);

    if (savedDeliveryAddress?.address?.includes('Corporate House')) {
      pass('Order created with named address (Corporate House)');
      results.push({ test: 'Order delivery address', status: 'PASS', orderId, address: savedDeliveryAddress.address });
    } else {
      fail('Order saved wrong address: ' + savedDeliveryAddress?.address);
      results.push({ test: 'Order delivery address', status: 'FAIL', orderId, got: savedDeliveryAddress?.address });
    }
  } else {
    console.log('Order creation failed:', JSON.stringify(orderRes.body).substring(0, 400));
    results.push({ test: 'Order delivery address', status: 'ERROR', error: orderRes.body });
  }

  if (orderId) {
    console.log('\n========== PHASE 6: IMMUTABILITY TEST ==========');
    // Change location to B
    const locUpdate = await apiCall('POST', '/customer/location', LOCATION_B);
    console.log('Location changed to B:', locUpdate.status, locUpdate.body.data?.address);

    // Verify original order still has Location A
    const orderCheck = await apiCall('GET', '/customer/orders/' + orderId, null);
    console.log('GET /customer/orders/' + orderId + ' ->', orderCheck.status);
    const orderAddr = orderCheck.body.data?.deliveryAddress?.address;
    console.log('Order A delivery address (after location B change):', orderAddr);

    if (orderAddr?.includes('Corporate House')) {
      pass('IMMUTABILITY: Order A still shows Location A after moving to Location B');
      results.push({ test: 'Order immutability', status: 'PASS' });
    } else {
      fail('IMMUTABILITY BREACH: Order A address changed! Got: ' + orderAddr);
      results.push({ test: 'Order immutability', status: 'FAIL', got: orderAddr });
    }

    console.log('\n========== PHASE 7: CUSTOMER ORDER DETAIL ==========');
    const deliveryLat = orderCheck.body.data?.deliveryAddress?.latitude;
    const deliveryLng = orderCheck.body.data?.deliveryAddress?.longitude;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${deliveryLat},${deliveryLng}`;
    console.log('Maps URL for Location A:', mapsUrl);
    
    if (deliveryLat === LOCATION_A.latitude && deliveryLng === LOCATION_A.longitude) {
      pass('Order detail coordinates match Location A (not Location B)');
      results.push({ test: 'Order coordinates snapshot', status: 'PASS' });
    } else {
      fail('Order coordinates wrong. Got: ' + deliveryLat + ',' + deliveryLng);
      results.push({ test: 'Order coordinates snapshot', status: 'FAIL' });
    }

    console.log('\n========== PHASE 11: SELLER-LOCATIONS 401 TEST ==========');
    const sellerLoc = await apiCall('GET', '/customer/orders/' + orderId + '/seller-locations', null);
    console.log('GET /customer/orders/' + orderId + '/seller-locations ->', sellerLoc.status);
    
    if (sellerLoc.status === 200) {
      pass('seller-locations returned 200 (no 401 error)');
      results.push({ test: 'seller-locations 200', status: 'PASS', response: JSON.stringify(sellerLoc.body).substring(0, 100) });
    } else if (sellerLoc.status === 401) {
      fail('seller-locations still returning 401!');
      results.push({ test: 'seller-locations 200', status: 'FAIL', status_code: 401 });
    } else {
      console.log('seller-locations returned:', sellerLoc.status, JSON.stringify(sellerLoc.body).substring(0, 200));
      results.push({ test: 'seller-locations 200', status: 'NOTE', status_code: sellerLoc.status });
    }

    console.log('\n========== PHASE 14: OTP TEST ==========');
    const otpRefresh = await apiCall('POST', '/customer/orders/' + orderId + '/refresh-otp', null);
    console.log('POST /customer/orders/' + orderId + '/refresh-otp ->', otpRefresh.status);
    
    if (otpRefresh.status === 200) {
      pass('OTP refresh returned 200');
      results.push({ test: 'OTP refresh', status: 'PASS' });
    } else {
      console.log('OTP refresh body:', JSON.stringify(otpRefresh.body).substring(0, 200));
      results.push({ test: 'OTP refresh', status: otpRefresh.status === 200 ? 'PASS' : 'FAIL', status_code: otpRefresh.status });
    }
  }

  console.log('\n========== FINAL RESULTS ==========');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${r.test}: ${r.status}${r.got ? ' | Got: ' + r.got.substring(0, 60) : ''}`);
  });

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n${passed}/${results.length} tests passed, ${failed} failed`);
}

run().catch(e => { console.error('Fatal error:', e.message); process.exit(1); });
