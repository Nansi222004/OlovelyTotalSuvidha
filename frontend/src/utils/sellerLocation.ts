import { parseGoogleGeocodeResult, type ParsedLocationAddress } from './addressUtils';

export interface StoreCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeocoderLike {
  geocode: (
    request: { location: { lat: number; lng: number } },
    callback: (results: any[] | null, status: string) => void
  ) => void;
}

export function hasValidStoreCoordinates(latitude: unknown, longitude: unknown): boolean {
  if (latitude === '' || longitude === '' || latitude === null || longitude === null
    || latitude === undefined || longitude === undefined) return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function getBrowserStoreCoordinates(
  geolocation: Geolocation | undefined = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
): Promise<StoreCoordinates> {
  if (!geolocation) {
    return Promise.reject(new Error('Location is not supported by this browser. Search for your store address instead.'));
  }

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6)),
      }),
      (error) => {
        if (error.code === 1) {
          reject(new Error('Location access was denied. Search for your store address or select it on the map.'));
          return;
        }
        reject(new Error('Unable to get your current location. Search for your store address or try again.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function reverseGeocodeStoreCoordinates(
  latitude: number,
  longitude: number,
  geocoder?: GeocoderLike
): Promise<ParsedLocationAddress> {
  if (!hasValidStoreCoordinates(latitude, longitude)) {
    return Promise.reject(new Error('The selected map location is invalid.'));
  }

  const activeGeocoder = geocoder
    ?? (typeof window !== 'undefined' && window.google?.maps?.Geocoder
      ? new window.google.maps.Geocoder() as unknown as GeocoderLike
      : undefined);

  if (!activeGeocoder) {
    return Promise.reject(new Error('Google address lookup is unavailable. Please search for your store address or try again.'));
  }

  return new Promise((resolve, reject) => {
    activeGeocoder.geocode(
      { location: { lat: latitude, lng: longitude } },
      (results, status) => {
        if (status !== 'OK' || !results?.[0]) {
          reject(new Error('Unable to determine the address. Please move the pin or try again.'));
          return;
        }

        const parsed = parseGoogleGeocodeResult(results[0]);
        if (!parsed.formattedAddress.trim()) {
          reject(new Error('Unable to determine the address. Please move the pin or try again.'));
          return;
        }
        resolve(parsed);
      }
    );
  });
}

export function buildSellerLocationFields(
  address: string,
  latitude: number,
  longitude: number,
  components?: { city?: string; state?: string; pincode?: string }
) {
  return {
    address: address.trim(),
    searchLocation: address.trim(),
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    city: components?.city?.trim() || '',
    pickupState: components?.state?.trim() || '',
    pickupPincode: components?.pincode?.trim() || '',
  };
}
