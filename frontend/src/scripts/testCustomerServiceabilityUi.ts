import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getCustomerServiceabilityMessage,
  getCustomerServiceabilityTitle,
  isPlatformQuickCommerceConfigured,
  shouldShowPlatformQcAdminWarning,
  shouldShowQuickDelivery,
} from '../utils/productServiceabilityUi';

const configuredPlatformQc = {
  warehouseName: 'Isolated Test Warehouse',
  warehouseAddress: 'Test address',
  city: 'Indore',
  state: 'Madhya Pradesh',
  pincode: '452001',
  latitude: 22.7196,
  longitude: 75.8577,
  serviceRadiusKm: 25,
};

assert.equal(isPlatformQuickCommerceConfigured(configuredPlatformQc), true);
assert.equal(isPlatformQuickCommerceConfigured(undefined), false);
assert.equal(isPlatformQuickCommerceConfigured({ ...configuredPlatformQc, serviceRadiusKm: 301 }), false);

assert.equal(shouldShowQuickDelivery('QUICK_COMMERCE', {
  channel: 'QUICK_COMMERCE',
  availability: 'AVAILABLE',
  isServiceable: true,
}), true, 'Confirmed QC availability shows the positive badge');
assert.equal(shouldShowQuickDelivery('QUICK_COMMERCE', {
  channel: 'QUICK_COMMERCE',
  availability: 'UNAVAILABLE',
  isServiceable: false,
}), false, 'Unavailable Platform QC must not show the positive badge');
assert.equal(shouldShowQuickDelivery('QUICK_COMMERCE', {
  channel: 'QUICK_COMMERCE',
  availability: 'LOCATION_REQUIRED',
  isServiceable: null,
}), false, 'Unconfirmed QC must not show the positive badge');
assert.equal(shouldShowQuickDelivery('ECOMMERCE', {
  channel: 'ECOMMERCE',
  availability: 'AVAILABLE',
  isServiceable: true,
}), false, 'Ecommerce never shows the Quick Delivery badge');

const qcMessage = getCustomerServiceabilityMessage('QUICK_COMMERCE');
assert.equal(qcMessage, 'This service is not available in your location yet.');
assert.equal(qcMessage.includes('configured'), false);
assert.equal(qcMessage.includes('PLATFORM_QC'), false);
assert.equal(qcMessage.includes('support'), false);
assert.equal(
  getCustomerServiceabilityMessage('ECOMMERCE'),
  'Courier delivery is not available for this pincode.'
);
assert.equal(getCustomerServiceabilityTitle('QUICK_COMMERCE'), 'Currently unavailable in your location');
assert.equal(getCustomerServiceabilityTitle('ECOMMERCE'), 'Courier delivery unavailable for this pincode');

assert.equal(shouldShowPlatformQcAdminWarning('admin', 'QUICK_COMMERCE', false), true);
assert.equal(shouldShowPlatformQcAdminWarning('admin', 'ECOMMERCE', false), false);
assert.equal(shouldShowPlatformQcAdminWarning('seller-id', 'QUICK_COMMERCE', false), false);
assert.equal(shouldShowPlatformQcAdminWarning('admin', 'QUICK_COMMERCE', true), false);

const productDetailSource = readFileSync(
  resolve(process.cwd(), '../frontend/src/modules/user/ProductDetail.tsx'),
  'utf8'
);
assert.equal(
  productDetailSource.includes('Platform Quick Commerce fulfillment is not configured'),
  false,
  'Customer Product Detail must not contain the internal configuration message'
);
assert.equal(
  productDetailSource.includes('PLATFORM_QC_FULFILLMENT_NOT_CONFIGURED'),
  false,
  'Customer Product Detail must not map or display the internal reason code'
);
assert.match(productDetailSource, /showQuickDelivery\s*\?/, 'Quick Delivery UI must be gated by confirmed serviceability');
assert.equal(
  productDetailSource.includes('Location Availability Banner'),
  false,
  'Unavailable serviceability must not render above the product image as a large banner'
);
assert.match(
  productDetailSource,
  /!isServiceAvailable\s*\?\s*\([\s\S]*?disabled[\s\S]*?Add to Cart[\s\S]*?disabled[\s\S]*?Buy Now/,
  'Unavailable serviceability must render genuinely disabled purchase controls'
);
assert.match(
  productDetailSource,
  /if \(!isServiceAvailable\)[\s\S]*?return;/,
  'Purchase handlers must retain an interaction guard in addition to disabled controls'
);
assert.match(productDetailSource, /<WishlistButton/, 'Wishlist must remain available independently of serviceability');

console.log('Customer/Admin serviceability UI tests passed.');
