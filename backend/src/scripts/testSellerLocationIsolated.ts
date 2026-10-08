import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSellerRegistrationLocation } from '../utils/sellerLocationValidation';
import { evaluateEcommerce, evaluateSellerQuickCommerce } from '../services/productServiceabilityService';
import {
  buildSellerLocationFields,
  getBrowserStoreCoordinates,
  reverseGeocodeStoreCoordinates,
} from '../../../frontend/src/utils/sellerLocation';

const googleResult = {
  formatted_address: '8, Surya Nagar, Vijay Nagar, Indore, Madhya Pradesh 452010, India',
  address_components: [
    { long_name: '8', types: ['street_number'] },
    { long_name: 'Surya Nagar', types: ['route'] },
    { long_name: 'Vijay Nagar', types: ['sublocality_level_1'] },
    { long_name: 'Indore', types: ['locality'] },
    { long_name: 'Madhya Pradesh', types: ['administrative_area_level_1'] },
    { long_name: '452010', types: ['postal_code'] },
  ],
};

async function main() {
  const mockGeolocation = {
    getCurrentPosition(success: PositionCallback) {
      success({ coords: { latitude: 22.7533123, longitude: 75.8937456 } } as GeolocationPosition);
    },
  } as unknown as Geolocation;
  const current = await getBrowserStoreCoordinates(mockGeolocation);
  assert.deepEqual(current, { latitude: 22.753312, longitude: 75.893746 });

  const mockGeocoder = {
    geocode(_request: any, callback: (results: any[], status: string) => void) {
      callback([googleResult], 'OK');
    },
  };
  const resolved = await reverseGeocodeStoreCoordinates(current.latitude, current.longitude, mockGeocoder);
  assert.equal(resolved.formattedAddress, googleResult.formatted_address);
  assert.equal(resolved.city, 'Indore');
  assert.equal(resolved.state, 'Madhya Pradesh');
  assert.equal(resolved.pincode, '452010');

  const fields = buildSellerLocationFields(
    resolved.formattedAddress,
    current.latitude,
    current.longitude,
    resolved
  );
  assert.equal(fields.address, googleResult.formatted_address);
  assert.equal(fields.latitude, '22.753312');
  assert.equal(fields.longitude, '75.893746');

  const movedResult = { ...googleResult, formatted_address: '10, New Store Road, Indore, Madhya Pradesh 452011, India' };
  const moved = await reverseGeocodeStoreCoordinates(22.76, 75.9, {
    geocode: (_request, callback) => callback([movedResult], 'OK'),
  });
  assert.equal(moved.formattedAddress, movedResult.formatted_address, 'Moving the marker resolves its new address');

  const deniedGeolocation = {
    getCurrentPosition(_success: PositionCallback, failure: PositionErrorCallback) {
      failure({ code: 1 } as GeolocationPositionError);
    },
  } as unknown as Geolocation;
  await assert.rejects(
    getBrowserStoreCoordinates(deniedGeolocation),
    /Location access was denied/
  );
  await assert.rejects(
    reverseGeocodeStoreCoordinates(22.75, 75.89, {
      geocode: (_request, callback) => callback([], 'ZERO_RESULTS'),
    }),
    /Unable to determine the address/
  );

  for (const vendorType of ['QUICK_COMMERCE', 'ECOMMERCE', 'HYBRID']) {
    const validation = validateSellerRegistrationLocation({ ...fields, vendorType });
    assert.equal(validation.valid, true, `${vendorType} persists address and coordinates`);
    if (validation.valid) {
      assert.deepEqual(validation.data.location.coordinates, [75.893746, 22.753312]);
    }
  }
  assert.equal(validateSellerRegistrationLocation({ ...fields, address: '' }).valid, false);
  assert.equal(validateSellerRegistrationLocation({ ...fields, latitude: '' }).valid, false);

  const seller = {
    location: { type: 'Point', coordinates: [75.893746, 22.753312] },
    serviceRadiusKm: 12,
  };
  assert.equal(evaluateSellerQuickCommerce(seller, 22.754, 75.894).isServiceable, true);
  assert.equal(evaluateSellerQuickCommerce(seller, 23.2, 76.4).isServiceable, false);
  assert.equal((await evaluateEcommerce('452010', async () => ({ isServiceable: true }))).isServiceable, true);

  const signupSource = readFileSync(
    resolve(process.cwd(), '../frontend/src/modules/seller/pages/SellerSignUp.tsx'),
    'utf8'
  );
  assert.equal(signupSource.includes('Store Location (GPS)'), false);
  assert.equal(signupSource.includes('Selected Coordinates:'), false);
  assert.match(signupSource, /Use Current Location/);
  assert.match(signupSource, /reverseGeocodeStoreCoordinates/);
  assert.match(signupSource, /address: formData\.address \|\| formData\.searchLocation/);
  assert.match(signupSource, /latitude: formData\.latitude/);
  assert.match(signupSource, /longitude: formData\.longitude/);
  assert.match(signupSource, /serviceRadiusKm: formData\.serviceRadiusKm/);
  assert.match(signupSource, /vendorType: formData\.vendorType/);

  console.log('Seller location isolated tests passed: geolocation, reverse geocoding, marker/address updates, persistence, and channel routing.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
