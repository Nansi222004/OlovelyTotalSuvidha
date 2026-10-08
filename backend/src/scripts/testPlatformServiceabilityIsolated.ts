import assert from 'node:assert/strict';
import {
  evaluateEcommerce,
  evaluatePlatformQuickCommerce,
  evaluateSellerQuickCommerce,
  PLATFORM_QC_NOT_CONFIGURED,
  toCustomerProductServiceability,
  validatePlatformQuickCommerceFulfillment,
} from '../services/productServiceabilityService';

const platform = {
  warehouseName: 'Test Warehouse',
  warehouseAddress: 'Isolated test address',
  city: 'Indore',
  state: 'Madhya Pradesh',
  pincode: '452001',
  latitude: 22.7196,
  longitude: 75.8577,
  serviceRadiusKm: 25,
};

assert.equal(validatePlatformQuickCommerceFulfillment(platform).valid, true);
assert.equal(validatePlatformQuickCommerceFulfillment({ ...platform, latitude: 91 }).valid, false);
assert.equal(validatePlatformQuickCommerceFulfillment({ ...platform, longitude: 181 }).valid, false);
assert.equal(validatePlatformQuickCommerceFulfillment({ ...platform, serviceRadiusKm: 0 }).valid, false);
assert.equal(validatePlatformQuickCommerceFulfillment({ ...platform, serviceRadiusKm: 301 }).valid, false);

const inside = evaluatePlatformQuickCommerce(platform, 22.72, 75.86);
assert.equal(inside.source, 'PLATFORM_QC');
assert.equal(inside.isServiceable, true);
assert.ok((inside.distanceKm || 0) < platform.serviceRadiusKm);

const outside = evaluatePlatformQuickCommerce(platform, 23.2, 76.4);
assert.equal(outside.isServiceable, false);
assert.ok((outside.distanceKm || 0) > platform.serviceRadiusKm);

const missing = evaluatePlatformQuickCommerce(undefined, 22.72, 75.86);
assert.equal(missing.status, 'CONFIGURATION_ERROR');
assert.equal(missing.code, PLATFORM_QC_NOT_CONFIGURED);
assert.equal(missing.isServiceable, false);
const publicMissing = toCustomerProductServiceability(missing);
assert.deepEqual(publicMissing, {
  channel: 'QUICK_COMMERCE',
  availability: 'UNAVAILABLE',
  isServiceable: false,
  customerMessage: 'This service is not available in your location yet.',
});
assert.equal('code' in publicMissing, false, 'Public DTO must not expose internal configuration code');
assert.equal('source' in publicMissing, false, 'Public DTO must not expose fulfillment source');
assert.equal('serviceRadiusKm' in publicMissing, false, 'Public DTO must not expose configured radius');

assert.equal(toCustomerProductServiceability(inside).availability, 'AVAILABLE');
assert.equal(toCustomerProductServiceability(outside).availability, 'UNAVAILABLE');

const noCustomerLocation = evaluatePlatformQuickCommerce(platform);
assert.equal(noCustomerLocation.status, 'LOCATION_REQUIRED');
assert.equal(noCustomerLocation.isServiceable, null);

const seller = {
  location: { type: 'Point', coordinates: [75.8577, 22.7196] },
  serviceRadiusKm: 10,
};
assert.equal(evaluateSellerQuickCommerce(seller, 22.72, 75.86).isServiceable, true);
assert.equal(evaluateSellerQuickCommerce(seller, 23.2, 76.4).isServiceable, false);

async function testEcommerce() {
  let ecommerceChecks = 0;
  const ecommerceInside = await evaluateEcommerce('452001', async (pincode) => {
    ecommerceChecks += 1;
    assert.equal(pincode, '452001');
    return { isServiceable: true };
  });
  assert.equal(ecommerceInside.source, 'ECOMMERCE_SHIPPING');
  assert.equal(ecommerceInside.isServiceable, true);
  assert.equal(ecommerceChecks, 1);

  const ecommerceOutsideQcRadius = await evaluateEcommerce('110001', async () => ({ isServiceable: true }));
  assert.equal(ecommerceOutsideQcRadius.isServiceable, true, 'QC distance must not affect Ecommerce pincode serviceability');

  // Wholesale is a selling mode, not a fulfillment channel. A wholesale
  // Ecommerce item follows this same pincode path and needs no Platform QC config.
  const wholesaleEcommerce = await evaluateEcommerce('560001', async () => ({ isServiceable: true }));
  assert.equal(wholesaleEcommerce.isServiceable, true);

  // A wholesale Platform QC item follows Platform QC and therefore still
  // requires the canonical platform fulfillment configuration.
  const wholesalePlatformQc = evaluatePlatformQuickCommerce(undefined, 22.72, 75.86);
  assert.equal(wholesalePlatformQc.code, PLATFORM_QC_NOT_CONFIGURED);

  const ecommerceMissingPincode = await evaluateEcommerce(undefined, async () => {
    throw new Error('Shipping provider must not be called without a valid pincode');
  });
  assert.equal(ecommerceMissingPincode.status, 'PINCODE_REQUIRED');
  assert.equal(ecommerceMissingPincode.isServiceable, null);
}

testEcommerce()
  .then(() => console.log('Platform/serviceability isolated tests passed: Platform QC config/radius, Seller QC, Ecommerce pincode independence.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
