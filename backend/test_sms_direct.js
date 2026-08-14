
const http = require('http');
const https = require('https');

// Load env
require('dotenv').config();

const USERNAME = process.env.SMS_INDIA_HUB_USERNAME || 'DHAKADSNAZZY';
const API_KEY  = process.env.SMS_INDIA_HUB_API_KEY;
const PASSWORD = process.env.SMS_INDIA_HUB_PASSWORD;
const SENDER   = process.env.SMS_INDIA_HUB_SENDER_ID || 'BGADEC';
const DLT_ID   = process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID;
const USE_APIKEY = process.env.SMS_INDIA_HUB_USE_APIKEY === 'true';

const TEST_MOBILE = '916268423925'; // 91 + 10 digit number
const TEST_OTP    = '1234';
const MSG = `Welcome to the DHAKADSNAZZY powered by Appzeto. Your OTP for registration is ${TEST_OTP}.`;

console.log('=== SMS India HUB Direct API Test ===');
console.log('USERNAME      :', USERNAME);
console.log('API_KEY       :', API_KEY ? API_KEY.slice(0,4) + '****' + API_KEY.slice(-4) : 'NOT SET');
console.log('PASSWORD      :', PASSWORD ? '***SET***' : 'NOT SET');
console.log('USE_APIKEY    :', USE_APIKEY);
console.log('SENDER_ID     :', SENDER);
console.log('DLT_TEMPLATE  :', DLT_ID);
console.log('MSG           :', MSG);
console.log('');

function doRequest(label, params) {
  return new Promise((resolve) => {
    const qs = Object.keys(params)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&');
    const urlStr = 'http://cloud.smsindiahub.in/vendorsms/pushsms.aspx?' + qs;
    console.log(`\n--- ${label} ---`);
    console.log('Auth param used:', Object.keys(params).includes('APIKey') ? 'APIKey' : 'password');
    console.log('Full URL (masked):', urlStr.replace(API_KEY || '', '***').replace(PASSWORD || '', '***'));

    const req = http.get(urlStr, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('HTTP Status:', res.statusCode);
        console.log('Response:', data);
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', e => {
      console.error('Request Error:', e.message);
      resolve({ error: e.message });
    });
    req.setTimeout(15000, () => {
      console.error('Request timed out');
      req.destroy();
      resolve({ error: 'timeout' });
    });
  });
}

async function runTests() {
  const baseParams = {
    user: USERNAME,
    msisdn: TEST_MOBILE,
    sid: SENDER,
    msg: MSG,
    fl: '0',
    gwid: '2',
  };
  if (DLT_ID) baseParams.DLT_TE_ID = DLT_ID;

  // Test 1: APIKey= param
  if (API_KEY) {
    const r1 = await doRequest('TEST 1: APIKey= param', { ...baseParams, APIKey: API_KEY });
    if (r1.body && (r1.body.includes('Invalid') || r1.body.includes('Failed'))) {
      console.log('>> FAILED with APIKey param');
    } else if (r1.body && !r1.body.includes('error') && !r1.body.includes('Error')) {
      console.log('>> SUCCESS with APIKey param!');
      return;
    }
  }

  // Test 2: password= param with panel password
  if (PASSWORD) {
    const r2 = await doRequest('TEST 2: password= param (panel password)', { ...baseParams, password: PASSWORD });
    if (r2.body && (r2.body.includes('Invalid') || r2.body.includes('Failed'))) {
      console.log('>> FAILED with password param');
    } else if (r2.body) {
      console.log('>> Result with password param:', r2.body);
    }
  }

  // Test 3: APIKey= with password value (sometimes they are the same)
  if (PASSWORD) {
    const r3 = await doRequest('TEST 3: APIKey= param with PANEL PASSWORD value', { ...baseParams, APIKey: PASSWORD });
    console.log('>> Result:', r3.body);
  }

  // Test 4: Without DLT_TE_ID
  if (API_KEY) {
    const p4 = { ...baseParams, APIKey: API_KEY };
    delete p4.DLT_TE_ID;
    const r4 = await doRequest('TEST 4: APIKey - no DLT_TE_ID', p4);
    console.log('>> Result:', r4.body);
  }

  console.log('\n=== DONE ===');
}

runTests().catch(console.error);
