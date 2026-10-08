export interface ValidatedSellerLocation {
  address: string;
  latitude: number;
  longitude: number;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export function validateSellerRegistrationLocation(body: any):
  | { valid: true; data: ValidatedSellerLocation }
  | { valid: false; message: string } {
  const address = String(body?.address ?? '').trim();
  if (!address) {
    return { valid: false, message: 'A valid store address is required' };
  }

  if (body?.latitude === '' || body?.latitude === null || body?.latitude === undefined
    || body?.longitude === '' || body?.longitude === null || body?.longitude === undefined) {
    return { valid: false, message: 'A valid store map location is required' };
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { valid: false, message: 'The selected store map location is invalid' };
  }

  return {
    valid: true,
    data: {
      address,
      latitude,
      longitude,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
    },
  };
}
